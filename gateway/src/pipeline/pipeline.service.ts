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

      if (geometryResult.status === 'SUCCESS') {
        run.currentStage = PipelineStage.MATCHING;
        this.logger.log(`Step 1 (Camera Geometry Alignment) succeeded for run ${runId}`);
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
}
