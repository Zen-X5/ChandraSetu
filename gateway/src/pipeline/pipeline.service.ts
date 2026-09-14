import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PipelineRun, PipelineRunDocument, PipelineStage, RunStatus } from './schemas/pipeline.schema';
import { ImagesService } from '../images/images.service';
import { Instrument } from '../images/schemas/raw-image.schema';

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);
  private readonly visionServiceUrl = process.env.VISION_SERVICE_URL || 'http://127.0.0.1:8000';

  constructor(
    @InjectModel(PipelineRun.name) private readonly pipelineRunModel: Model<PipelineRunDocument>,
    private readonly imagesService: ImagesService,
  ) { }

  async createRun(
    sourceImageId: Types.ObjectId,
    referenceImageId?: Types.ObjectId,
    userId?: string,
  ): Promise<PipelineRunDocument> {
    const runId = `run_${crypto.randomUUID().substring(0, 8)}`;
    const run = new this.pipelineRunModel({
      runId,
      sourceImageId,
      referenceImageId,
      currentStage: PipelineStage.INGESTION,
      status: RunStatus.RUNNING,
      initiatedBy: userId ? new Types.ObjectId(userId) : undefined,
    });
    return await run.save();
  }

  async executeGeometryStep(
    runId: string,
    imageAPath: string,
    imageBPath: string,
    xmlAPath?: string,
    xmlBPath?: string,
    instrumentA = 'OHRC',
    instrumentB = 'TMC',
  ): Promise<PipelineRunDocument> {
    const run = await this.pipelineRunModel.findOne({ runId });
    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    run.currentStage = PipelineStage.GEOMETRY;
    await run.save();

    try {
      this.logger.log(`Invoking Camera Geometry & PDS4 alignment engine for run ${runId}...`);

      const payload = {
        image_a: {
          image_id: "image_a",
          instrument: instrumentA,
          image_path: imageAPath,
          xml_label_path: xmlAPath || null,
        },
        image_b: {
          image_id: "image_b",
          instrument: instrumentB,
          image_path: imageBPath,
          xml_label_path: xmlBPath || null,
        },
      };

      const response = await fetch(`${this.visionServiceUrl}/api/v1/geometry/align-coarse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vision service returned status ${response.status}: ${errorText}`);
      }

      const geometryResult = await response.json();
      run.geometryResult = geometryResult;
      run.imageAUrl = `/api/pipeline/run/${runId}/image-a`;
      run.imageBUrl = `/api/pipeline/run/${runId}/image-b`;

      if (geometryResult.status === 'SUCCESS') {
        run.currentStage = PipelineStage.MATCHING;
        this.logger.log(`Step 1 (Camera Geometry Alignment) succeeded for run ${runId}`);

        // Step 2: Invoke Sahid's Signal Processing / Feature Matching Engine
        const imageACommon = geometryResult.details?.image_a_common_ref || imageAPath;
        const imageBCommon = geometryResult.details?.image_b_common_ref || imageBPath;

        const absA = path.isAbsolute(imageACommon) ? imageACommon : path.resolve(process.cwd(), '..', 'vision-service', imageACommon);
        const absB = path.isAbsolute(imageBCommon) ? imageBCommon : path.resolve(process.cwd(), '..', 'vision-service', imageBCommon);

        const matchPayload = {
          image_a_path: absA,
          image_b_path: absB,
          instrument_a: instrumentA,
          instrument_b: instrumentB,
          grid_divisions: 4,
          use_fourier_mellin: true,
          enable_clahe: true,
        };

        const matchResponse = await fetch(`${this.visionServiceUrl}/api/v1/matching/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(matchPayload),
        });

        if (!matchResponse.ok) {
          const matchErr = await matchResponse.text();
          this.logger.error(`Matching module error for run ${runId}: ${matchErr}`);
          run.currentStage = PipelineStage.FAILED;
          run.status = RunStatus.FAILED;
          run.errorMessage = `Matching module error: ${matchErr}`;
          return await run.save();
        }

        const matchingResult = await matchResponse.json();
        run.matchingResult = matchingResult;
        this.logger.log(`Step 2 (Feature Matching) finished for run ${runId} with status: ${matchingResult.status}`);

        // Step 3: Invoke Urmi's RANSAC Validation & Precision Metrics Engine
        run.currentStage = PipelineStage.VALIDATION;
        const registeredOutputPath = path.resolve(process.cwd(), '..', 'vision-service', 'uploads', 'coarse_aligned', `${runId}_image_a_registered.png`);
        const valPayload = {
          candidate_matches: matchingResult.candidate_matches || [],
          coarse_transform: geometryResult.coarse_affine_matrix || null,
          image_a_path: absA,
          image_b_path: absB,
          output_warped_path: registeredOutputPath,
          ransac_threshold_px: 2.5,
          grid_divisions: 4,
        };

        const valResponse = await fetch(`${this.visionServiceUrl}/api/v1/validation/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(valPayload),
        });

        if (!valResponse.ok) {
          const valErr = await valResponse.text();
          this.logger.error(`Validation module error for run ${runId}: ${valErr}`);
          run.currentStage = PipelineStage.FAILED;
          run.status = RunStatus.FAILED;
          run.errorMessage = `Validation module error: ${valErr}`;
          return await run.save();
        }

        const validationResult = await valResponse.json();
        run.validationResult = validationResult;
        run.currentStage = PipelineStage.COMPLETED;
        run.status = RunStatus.COMPLETED;
        this.logger.log(`Step 3 (RANSAC Validation) finished for run ${runId} with status: ${validationResult.status}`);
      } else {
        run.status = RunStatus.FAILED;
        run.currentStage = PipelineStage.FAILED;
        run.errorMessage = `[Step 1 - Geometry] ${geometryResult.message}`;
        this.logger.warn(`Step 1 halted for run ${runId}: ${geometryResult.message}`);
      }

      return await run.save();
    } catch (error: any) {
      this.logger.error(`Error in geometry execution for ${runId}: ${error.message}`);
      run.status = RunStatus.FAILED;
      run.currentStage = PipelineStage.FAILED;
      run.errorMessage = `Geometry module invocation error: ${error.message}`;
      return await run.save();
    }
  }

  async registerPair(
    imageAFile: Express.Multer.File,
    imageBFile: Express.Multer.File,
    xmlAFile?: Express.Multer.File,
    xmlBFile?: Express.Multer.File,
    instrumentA: Instrument = Instrument.OHRC,
    instrumentB: Instrument = Instrument.TMC,
    userId?: string,
  ): Promise<PipelineRunDocument> {
    const runId = `run_${crypto.randomUUID().substring(0, 8)}`;

    const rawImageA = await this.imagesService.saveFile(
      imageAFile.buffer,
      imageAFile.originalname,
      instrumentA,
      runId,
      userId,
    );

    const rawImageB = await this.imagesService.saveFile(
      imageBFile.buffer,
      imageBFile.originalname,
      instrumentB,
      runId,
      userId,
    );

    let xmlAPath: string | undefined;
    let xmlBPath: string | undefined;

    if (xmlAFile) {
      const savedXmlA = await this.imagesService.saveFile(
        xmlAFile.buffer,
        xmlAFile.originalname,
        instrumentA,
        runId,
        userId,
      );
      xmlAPath = savedXmlA.storageRef;
    }

    if (xmlBFile) {
      const savedXmlB = await this.imagesService.saveFile(
        xmlBFile.buffer,
        xmlBFile.originalname,
        instrumentB,
        runId,
        userId,
      );
      xmlBPath = savedXmlB.storageRef;
    }

    const run = new this.pipelineRunModel({
      runId,
      sourceImageId: rawImageA._id,
      referenceImageId: rawImageB._id,
      imageAUrl: `/api/pipeline/run/${runId}/image-a`,
      imageBUrl: `/api/pipeline/run/${runId}/image-b`,
      currentStage: PipelineStage.INGESTION,
      status: RunStatus.RUNNING,
      initiatedBy: userId ? new Types.ObjectId(userId) : undefined,
    });
    await run.save();

    return await this.executeGeometryStep(
      runId,
      rawImageA.storageRef,
      rawImageB.storageRef,
      xmlAPath,
      xmlBPath,
      instrumentA,
      instrumentB,
    );
  }

  async registerSampleDataset(sampleId: string, userId?: string): Promise<PipelineRunDocument> {
    const sampleDir = path.resolve(process.cwd(), '..', 'sample_data', sampleId);
    if (!fs.existsSync(sampleDir)) {
      throw new NotFoundException(`Sample dataset '${sampleId}' not found`);
    }

    const files = fs.readdirSync(sampleDir);
    const imageFiles = files.filter(f => f.endsWith('.png') || f.endsWith('.tif') || f.endsWith('.img'));
    const xmlFiles = files.filter(f => f.endsWith('.xml'));

    if (imageFiles.length < 2) {
      throw new BadRequestException(`Sample dataset requires at least 2 images, found ${imageFiles.length}`);
    }

    const fileA = imageFiles[0];
    const fileB = imageFiles[1];
    const xmlA = xmlFiles.find(x => x.includes(fileA.split('.')[0]));
    const xmlB = xmlFiles.find(x => x.includes(fileB.split('.')[0]));

    const bufA = fs.readFileSync(path.join(sampleDir, fileA));
    const bufB = fs.readFileSync(path.join(sampleDir, fileB));

    const instA = fileA.toLowerCase().includes('ohrc') ? Instrument.OHRC : Instrument.TMC;
    const instB = fileB.toLowerCase().includes('tmc') ? Instrument.TMC : Instrument.OHRC;

    const mockFileA: Express.Multer.File = {
      buffer: bufA,
      originalname: fileA,
      fieldname: 'imageA',
      encoding: '7bit',
      mimetype: 'image/png',
      size: bufA.length,
      stream: null as any,
      destination: '',
      filename: fileA,
      path: '',
    };

    const mockFileB: Express.Multer.File = {
      buffer: bufB,
      originalname: fileB,
      fieldname: 'imageB',
      encoding: '7bit',
      mimetype: 'image/png',
      size: bufB.length,
      stream: null as any,
      destination: '',
      filename: fileB,
      path: '',
    };

    let mockXmlA: Express.Multer.File | undefined;
    if (xmlA) {
      const bufXmlA = fs.readFileSync(path.join(sampleDir, xmlA));
      mockXmlA = {
        buffer: bufXmlA,
        originalname: xmlA,
        fieldname: 'xmlA',
        encoding: '7bit',
        mimetype: 'application/xml',
        size: bufXmlA.length,
        stream: null as any,
        destination: '',
        filename: xmlA,
        path: '',
      };
    }

    let mockXmlB: Express.Multer.File | undefined;
    if (xmlB) {
      const bufXmlB = fs.readFileSync(path.join(sampleDir, xmlB));
      mockXmlB = {
        buffer: bufXmlB,
        originalname: xmlB,
        fieldname: 'xmlB',
        encoding: '7bit',
        mimetype: 'application/xml',
        size: bufXmlB.length,
        stream: null as any,
        destination: '',
        filename: xmlB,
        path: '',
      };
    }

    return await this.registerPair(mockFileA, mockFileB, mockXmlA, mockXmlB, instA, instB, userId);
  }

  async getRun(runId: string): Promise<PipelineRunDocument> {
    const run = await this.pipelineRunModel
      .findOne({ runId })
      .populate('sourceImageId')
      .populate('referenceImageId');

    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }
    return run;
  }

  async getAllRuns(): Promise<PipelineRunDocument[]> {
    return await this.pipelineRunModel
      .find()
      .sort({ createdAt: -1 })
      .populate('sourceImageId')
      .populate('referenceImageId')
      .limit(50);
  }

  async getImagePath(runId: string, type: 'A' | 'B'): Promise<string> {
    const run = await this.pipelineRunModel
      .findOne({ runId })
      .populate('sourceImageId')
      .populate('referenceImageId');

    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    const candidatePaths: string[] = [];

    // 1. For Image A, check if OpenCV co-registered warped image exists
    if (type === 'A') {
      candidatePaths.push(
        path.resolve(process.cwd(), '..', 'vision-service', 'uploads', 'coarse_aligned', `${runId}_image_a_registered.png`),
        path.resolve(process.cwd(), '..', 'uploads', 'coarse_aligned', `${runId}_image_a_registered.png`),
        path.resolve(process.cwd(), '..', 'vision-service', 'uploads', 'coarse_aligned', `image_a_registered.png`),
      );
    }

    // 2. Check coarse-aligned PNG generated by Rashel's module
    if (type === 'A' && run.geometryResult?.details?.image_a_common_ref) {
      candidatePaths.push(run.geometryResult.details.image_a_common_ref);
    } else if (type === 'B' && run.geometryResult?.details?.image_b_common_ref) {
      candidatePaths.push(run.geometryResult.details.image_b_common_ref);
    }

    // 2. Check source/reference raw storage if it is already a browser-viewable format
    const rawDoc = type === 'A' ? (run.sourceImageId as any) : (run.referenceImageId as any);
    if (rawDoc?.storageRef) {
      const ext = path.extname(rawDoc.storageRef).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        candidatePaths.push(rawDoc.storageRef);
      }
      const stem = path.basename(rawDoc.storageRef, ext);
      candidatePaths.push(
        path.resolve(process.cwd(), '..', 'vision-service', 'uploads', 'coarse_aligned', `${stem}_coarse_aligned.png`),
        path.resolve(process.cwd(), '..', 'uploads', 'coarse_aligned', `${stem}_coarse_aligned.png`),
      );
    }

    // 3. Check common known locations on disk
    const filenameA = `image_a_coarse_aligned.png`;
    const filenameB = `image_b_coarse_aligned.png`;
    const targetFilename = type === 'A' ? filenameA : filenameB;

    candidatePaths.push(
      path.resolve(process.cwd(), '..', 'vision-service', 'uploads', 'coarse_aligned', targetFilename),
      path.resolve(process.cwd(), '..', 'uploads', 'coarse_aligned', targetFilename),
      path.resolve(process.cwd(), 'uploads', 'coarse_aligned', targetFilename),
      path.resolve(process.cwd(), '..', 'vision-service', targetFilename),
    );

    for (const p of candidatePaths) {
      if (p && typeof p === 'string') {
        const resolved = path.isAbsolute(p) ? p : path.resolve(process.cwd(), '..', 'vision-service', p);
        if (fs.existsSync(resolved) && !resolved.toLowerCase().endsWith('.img') && !resolved.toLowerCase().endsWith('.xml')) {
          return resolved;
        }
      }
    }

    // 4. On-demand generation: if raw files exist, call vision service to generate
    const rawA = run.sourceImageId as any;
    const rawB = run.referenceImageId as any;
    if (rawA?.storageRef && rawB?.storageRef && fs.existsSync(rawA.storageRef) && fs.existsSync(rawB.storageRef)) {
      try {
        const payload = {
          image_a: { image_id: `${runId}_a`, instrument: rawA.instrument || 'OHRC', image_path: rawA.storageRef, xml_label_path: null },
          image_b: { image_id: `${runId}_b`, instrument: rawB.instrument || 'OHRC', image_path: rawB.storageRef, xml_label_path: null },
        };
        const resp = await fetch(`${this.visionServiceUrl}/api/v1/geometry/align-coarse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (resp.ok) {
          const resJson = await resp.json();
          run.geometryResult = resJson;
          await run.save();
          const targetPath = type === 'A' ? resJson.details?.image_a_common_ref : resJson.details?.image_b_common_ref;
          if (targetPath && fs.existsSync(targetPath)) {
            return targetPath;
          }
        }
      } catch (err: any) {
        this.logger.error(`On-demand alignment failed: ${err.message}`);
      }
    }

    throw new NotFoundException(`Image ${type} for run ${runId} not found on server disk`);
  }
}
