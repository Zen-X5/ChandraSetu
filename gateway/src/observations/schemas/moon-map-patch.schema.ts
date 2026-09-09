import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MoonMapPatchDocument = HydratedDocument<MoonMapPatch>;

@Schema({ _id: false })
export class MapRegionBounds {
    @Prop({ required: true })
    minLat: number;

    @Prop({ required: true })
    maxLat: number;

    @Prop({ required: true })
    minLon: number;

    @Prop({ required: true })
    maxLon: number;
}

@Schema({ _id: false })
export class Bbox2D {
    @Prop({ required: true, type: [Number] })
    min: number[];

    @Prop({ required: true, type: [Number] })
    max: number[];
}

@Schema({ timestamps: false })
export class MoonMapPatch {
    @Prop({
        type: Types.ObjectId,
        ref: 'Observation',
        required: true,
        unique: true,
    })
    observationId: Types.ObjectId;

    @Prop({ type: MapRegionBounds, required: true })
    regionBounds: MapRegionBounds;

    @Prop({ type: Bbox2D, required: true })
    bbox2d: Bbox2D;

    @Prop({ required: true })
    registeredImageRef: string;

    @Prop({ required: true })
    instrumentSource: string;

    @Prop({ required: true })
    confidenceDisplay: number;

    @Prop({ required: true })
    createdAt: Date;
}

export const MoonMapPatchSchema = SchemaFactory.createForClass(MoonMapPatch);