import { Controller, Get, Post, UseInterceptors, UploadedFile, Body, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImagesService } from './images.service';
import { Instrument } from './schemas/raw-image.schema';

@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Get('samples')
  async getSamples() {
    return await this.imagesService.getSampleDatasets();
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingle(
    @UploadedFile() file: Express.Multer.File,
    @Body('instrument') instrument?: Instrument,
  ) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }
    return await this.imagesService.saveFile(
      file.buffer,
      file.originalname,
      instrument || Instrument.OHRC,
    );
  }
}
