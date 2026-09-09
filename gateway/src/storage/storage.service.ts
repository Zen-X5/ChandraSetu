import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;
  private readonly bucketName = process.env.S3_BUCKET || 'chandrasetu-images';
  private readonly localUploadBase = path.resolve(process.cwd(), '..', 'uploads', 'raw');
  private isS3Available = false;

  constructor() {
    this.initStorage();
  }

  private async initStorage() {
    if (!fs.existsSync(this.localUploadBase)) {
      fs.mkdirSync(this.localUploadBase, { recursive: true });
    }

    const endpoint = process.env.S3_ENDPOINT || 'http://127.0.0.1:9000';
    const accessKeyId = process.env.S3_ACCESS_KEY || 'minioadmin';
    const secretAccessKey = process.env.S3_SECRET_KEY || 'minioadmin';
    const region = process.env.S3_REGION || 'us-east-1';

    try {
      this.s3Client = new S3Client({
        endpoint,
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: true,
      });

      await this.ensureBucket();
      this.isS3Available = true;
      this.logger.log(`MinIO / S3 Storage initialized successfully (Bucket: ${this.bucketName}, Endpoint: ${endpoint})`);
    } catch (error: any) {
      this.isS3Available = false;
      this.logger.warn(`MinIO not reachable at ${endpoint}. Using local disk storage fallback (${this.localUploadBase})`);
    }
  }

  private async ensureBucket() {
    if (!this.s3Client) return;
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        this.logger.log(`Bucket ${this.bucketName} does not exist. Creating...`);
        await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
      }
    }
  }

  async uploadFile(
    fileBuffer: Buffer,
    originalFilename: string,
    subfolder = 'default',
    contentType = 'application/octet-stream',
  ): Promise<{ storageRef: string; isS3: boolean; localPath: string }> {
    const sanitizedName = `${Date.now()}_${path.basename(originalFilename)}`;

    const localFolder = path.join(this.localUploadBase, subfolder);
    if (!fs.existsSync(localFolder)) {
      fs.mkdirSync(localFolder, { recursive: true });
    }
    const localFullPath = path.join(localFolder, sanitizedName);
    fs.writeFileSync(localFullPath, fileBuffer);

    if (this.isS3Available && this.s3Client) {
      const s3Key = `${subfolder}/${sanitizedName}`;
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: s3Key,
            Body: fileBuffer,
            ContentType: contentType,
          }),
        );
        const s3Uri = `s3://${this.bucketName}/${s3Key}`;
        this.logger.log(`Uploaded file to MinIO S3: ${s3Uri}`);
        return { storageRef: s3Uri, isS3: true, localPath: localFullPath };
      } catch (err: any) {
        this.logger.warn(`Failed to upload to S3, defaulting to local path: ${err.message}`);
      }
    }

    return { storageRef: localFullPath, isS3: false, localPath: localFullPath };
  }
}
