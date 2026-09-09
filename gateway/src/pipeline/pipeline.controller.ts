import { Controller, Get, Post, Param, Body, UseInterceptors, UploadedFiles, BadRequestException } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { PipelineService } from './pipeline.service';
import { Instrument } from '../images/schemas/raw-image.schema';

@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) { }

  @Post('register')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'imageA', maxCount: 1 },
      { name: 'imageB', maxCount: 1 },
      { name: 'xmlA', maxCount: 1 },
      { name: 'xmlB', maxCount: 1 },
    ]),
  )
  async registerImages(
    @UploadedFiles()
    files: {
      imageA?: Express.Multer.File[];
      imageB?: Express.Multer.File[];
      xmlA?: Express.Multer.File[];
      xmlB?: Express.Multer.File[];
    },
    @Body('instrumentA') instrumentA?: Instrument,
    @Body('instrumentB') instrumentB?: Instrument,
  ) {
    if (!files?.imageA?.[0] || !files?.imageB?.[0]) {
      throw new BadRequestException('Both Image A and Image B must be provided');
    }

    return await this.pipelineService.registerPair(
      files.imageA[0],
      files.imageB[0],
      files.xmlA?.[0],
      files.xmlB?.[0],
      instrumentA || Instrument.OHRC,
      instrumentB || Instrument.TMC,
    );
  }

  @Post('register-sample')
  async registerSample(@Body('sampleId') sampleId: string) {
    if (!sampleId) {
      throw new BadRequestException('sampleId is required');
    }
    return await this.pipelineService.registerSampleDataset(sampleId);
  }

  @Get('run/:runId')
  async getRunStatus(@Param('runId') runId: string) {
    return await this.pipelineService.getRun(runId);
  }
}
