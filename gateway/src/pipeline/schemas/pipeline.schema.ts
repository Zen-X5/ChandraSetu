import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PipelineRunDocument = HydratedDocument<PipelineRun>;

export enum PipelineStage {
    INGESTION = 'INGESTION',
    GEOMETRY = 'GEOMETRY',
    MATCHING = 'MATCHING',
    VALIDATION = 'VALIDATION',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

export enum RunStatus {
    PENDING = 'PENDING',
    RUNNING = 'RUNNING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

@Schema({ timestamps: true })
export class PipelineRun {
    @Prop({ required: true, unique: true })
    runId: string;

    @Prop({ required: true, type: Types.ObjectId, ref: 'RawImage' })
    sourceImageId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'RawImage' })
    referenceImageId?: Types.ObjectId;

    @Prop({
        required: true,
        enum: PipelineStage,
        default: PipelineStage.INGESTION,
    })
    currentStage: PipelineStage;

    @Prop({
        required: true,
        enum: RunStatus,
        default: RunStatus.RUNNING,
    })
    status: RunStatus;

    @Prop({ type: Object })
    geometryResult?: Record<string, any>;

    @Prop({ type: Object })
    matchingResult?: Record<string, any>;

    @Prop({ type: Object })
    validationResult?: Record<string, any>;

    @Prop()
    errorMessage?: string;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    initiatedBy?: Types.ObjectId;
}

export const PipelineRunSchema = SchemaFactory.createForClass(PipelineRun);
