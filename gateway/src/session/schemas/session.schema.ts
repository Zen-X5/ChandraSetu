import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SessionDocument = Session & Document;

@Schema({ timestamps: true })
export class Session {
    @Prop({ required: true, type: String, ref: 'User' })
    user_id!: string;

    @Prop({ required: true, unique: true })
    access_token!: string;

    @Prop({ required: true })
    access_token_expires_at!: Date;

    @Prop({ default: '' })
    refresh_token!: string;

    @Prop()
    user_agent!: string;

    @Prop({ default: 'sms-nucleus' })
    sso_agent!: string;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
