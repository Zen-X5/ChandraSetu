import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ImagesService } from './images.service';
import { ImagesController } from './images.controller';
import { RawImage, RawImageSchema } from './schemas/raw-image.schema';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: RawImage.name, schema: RawImageSchema }]),
    StorageModule,
  ],
  controllers: [ImagesController],
  providers: [ImagesService],
  exports: [ImagesService, MongooseModule],
})
export class ImagesModule {}
