import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RawImageDocument = HydratedDocument<RawImage>;

export enum Instrument {
    OHRC = 'OHRC',
    TMC = 'TMC',
    IIRS = 'IIRS',
}

export enum FileFormat {
    IMG = '.img',
    CUB = '.cub',
    TIF = '.tif',
}

export enum MetadataStatus {
    COMPLETE = 'complete',
    PARTIAL = 'partial',
    MISSING = 'missing',
}

export enum UploadStatus {
    UPLOADED = 'uploaded',
    VALIDATED = 'validated',
    REJECTED = 'rejected',
}

@Schema({ _id: false })
export class CornerCoordinates {
    @Prop()
    minLat?: number;

    @Prop()
    maxLat?: number;

    @Prop()
    minLon?: number;

    @Prop()
    maxLon?: number;
}

@Schema({ _id: false })
export class Pds4Metadata {
    @Prop()
    rawLabelRef?: string;

    @Prop()
    projection?: string;

    @Prop({ type: CornerCoordinates })
    cornerCoordinates?: CornerCoordinates;

    @Prop()
    resolutionMPerPixel?: number;

    @Prop()
    acquisitionTimestamp?: Date;

    @Prop()
    metadataStatus?: MetadataStatus;
}

@Schema({ timestamps: true })
export class RawImage {
    @Prop({ required: true, unique: true })
    imageId: string;

    @Prop({ required: true, enum: Instrument })
    instrument: Instrument;

    @Prop({ required: true })
    originalFilename: string;

    @Prop({ required: true })
    storageRef: string;

    @Prop({ required: true, enum: FileFormat })
    fileFormat: FileFormat;

    @Prop({ required: true })
    fileSizeBytes: number;

    @Prop({ required: true, unique: true })
    contentHash: string;

    @Prop({ type: Pds4Metadata })
    pds4Metadata?: Pds4Metadata;

    @Prop({
        required: true,
        enum: UploadStatus,
        default: UploadStatus.UPLOADED,
    })
    uploadStatus: UploadStatus;

    @Prop()
    rejectionReason?: string;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    uploadedBy?: Types.ObjectId;
}

export const RawImageSchema = SchemaFactory.createForClass(RawImage);