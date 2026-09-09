import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ObservationDocument = HydratedDocument<Observation>;

export enum MatchStatus {
    MATCHED = 'matched',
    UNMATCHED = 'unmatched',
    UNCERTAIN = 'uncertain',
}

export enum ImageRole {
    SOURCE = 'source',
    REFERENCE = 'reference',
}

@Schema({ _id: false })
export class ObservationImage {
    @Prop({
        type: Types.ObjectId,
        ref: 'RawImage',
        required: true,
    })
    imageId: Types.ObjectId;

    @Prop({ required: true, enum: ImageRole })
    role: ImageRole;

    @Prop()
    instrument?: string;
}

@Schema({ _id: false })
export class MatchedPoint {
    @Prop({ type: [Number], required: true })
    source: number[]; // [x, y] in the source image

    @Prop({ type: [Number], required: true })
    reference: number[]; // [x, y] in the reference image
}

@Schema({ _id: false })
export class ConfidenceMetrics {
    @Prop()
    method?: string;

    @Prop()
    mutualInformationScore?: number;

    @Prop()
    ransacInlierCount?: number;

    @Prop()
    totalCandidates?: number;

    @Prop()
    inlierRatio?: number;

    @Prop()
    rmseX?: number;

    @Prop()
    rmseY?: number;

    @Prop()
    spatialDistributionScore?: number;
}

@Schema({ _id: false })
export class RegionBounds {
    @Prop()
    minLat: number;

    @Prop()
    maxLat: number;

    @Prop()
    minLon: number;

    @Prop()
    maxLon: number;
}

@Schema({ _id: false })
export class FinalTransform {
    @Prop({ type: [[Number]] })
    matrix: number[][];
}

@Schema({ _id: false })
export class ReviewFlag {
    @Prop()
    needsReview: boolean;

    @Prop()
    reason?: string;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    reviewedBy?: Types.ObjectId;

    @Prop()
    reviewerDecision?: string;
}

@Schema({ timestamps: true })
export class Observation {
    @Prop({ required: true, unique: true })
    observationId: string;

    @Prop({ type: Types.ObjectId, ref: 'PipelineRun' })
    runId?: Types.ObjectId;

    @Prop({ type: [ObservationImage], required: true })
    images: ObservationImage[];

    @Prop({ required: true, enum: MatchStatus })
    matchStatus: MatchStatus;

    @Prop({ type: ConfidenceMetrics })
    confidence?: ConfidenceMetrics;

    @Prop({ type: RegionBounds })
    regionBounds?: RegionBounds;

    @Prop({ type: FinalTransform })
    finalTransform?: FinalTransform;

    @Prop({ type: [MatchedPoint] })
    matchedPoints?: MatchedPoint[];

    @Prop()
    registeredImageRef?: string;

    @Prop({ type: ReviewFlag })
    reviewFlag?: ReviewFlag;

    @Prop({ type: Types.ObjectId, ref: 'Observation' })
    duplicateOf?: Types.ObjectId;

    @Prop({ default: false })
    singleImagePlacement: boolean;

    @Prop({ type: Date, default: null })
    deletedAt?: Date | null;

}

export const ObservationSchema = SchemaFactory.createForClass(Observation);

ObservationSchema.index({ deletedAt: 1 });