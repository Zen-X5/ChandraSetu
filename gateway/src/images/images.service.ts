import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { RawImage, RawImageDocument, FileFormat, Instrument, UploadStatus } from './schemas/raw-image.schema';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ImagesService {
  constructor(
    @InjectModel(RawImage.name) private readonly rawImageModel: Model<RawImageDocument>,
    private readonly storageService: StorageService,
  ) { }

  private computeHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private detectFormat(filename: string): FileFormat {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.img') return FileFormat.IMG;
    if (ext === '.cub') return FileFormat.CUB;
    if (ext === '.tif' || ext === '.tiff') return FileFormat.TIF;
    if (ext === '.png') return FileFormat.PNG;
    if (ext === '.jpg' || ext === '.jpeg') return FileFormat.JPG;
    return FileFormat.PNG;
  }

  async saveFile(
    fileBuffer: Buffer,
    originalFilename: string,
    instrument: Instrument = Instrument.OHRC,
    subfolder = 'default',
    userId?: string,
  ): Promise<RawImageDocument> {
    const contentHash = this.computeHash(fileBuffer);

    const existing = await this.rawImageModel.findOne({ contentHash });
    if (existing) {
      return existing;
    }

    const { storageRef, localPath } = await this.storageService.uploadFile(
      fileBuffer,
      originalFilename,
      subfolder,
    );

    const imageId = `img_${crypto.randomUUID().substring(0, 8)}`;
    const fileFormat = this.detectFormat(originalFilename);

    const newImage = new this.rawImageModel({
      imageId,
      instrument,
      originalFilename,
      storageRef: localPath,
      fileFormat,
      fileSizeBytes: fileBuffer.length,
      contentHash,
      uploadStatus: UploadStatus.UPLOADED,
      uploadedBy: userId ? new Types.ObjectId(userId) : undefined,
    });

    return await newImage.save();
  }

  async getById(id: string): Promise<RawImageDocument> {
    const img = await this.rawImageModel.findById(id);
    if (!img) {
      throw new NotFoundException(`Raw image ${id} not found`);
    }
    return img;
  }

  async getSampleDatasets(): Promise<any[]> {
    const sampleDir = path.resolve(process.cwd(), '..', 'sample_data');
    if (!fs.existsSync(sampleDir)) {
      return [];
    }

    const folders = fs.readdirSync(sampleDir);
    return folders.map((folder) => {
      const folderPath = path.join(sampleDir, folder);
      const files = fs.readdirSync(folderPath);
      return {
        id: folder,
        name: folder.replace(/_/g, ' ').toUpperCase(),
        path: folderPath,
        files,
      };
    });
  }
}
