import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PipelineService } from './pipeline.service';
import { PipelineController } from './pipeline.controller';
import { PipelineRun, PipelineRunSchema } from './schemas/pipeline.schema';
import { ImagesModule } from '../images/images.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PipelineRun.name, schema: PipelineRunSchema }]),
    ImagesModule,
  ],
  controllers: [PipelineController],
  providers: [PipelineService],
  exports: [PipelineService, MongooseModule],
})
export class PipelineModule {}
