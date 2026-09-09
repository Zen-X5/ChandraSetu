import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum UserRole {
    SCIENTIST = 'scientist',
    ADMIN = 'admin',
}

@Schema({ timestamps: true })
export class User {
    @Prop({ required: true, unique: true })
    userId: string;

    @Prop({ required: true })
    name: string;

    @Prop({ required: true, enum: UserRole })
    role: UserRole;

    @Prop({ required: true, unique: true })
    email: string;

    @Prop({ required: true, select: false })
    password: string;

    @Prop({ type: Date, default: null })
    deletedAt?: Date | null;

    createdAt?: Date;
    updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ deletedAt: 1 });