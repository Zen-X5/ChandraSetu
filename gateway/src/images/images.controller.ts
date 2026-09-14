import { Controller, Get, Post, UseInterceptors, UploadedFile, Body, BadRequestException, Param, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImagesService } from './images.service';
import { Instrument } from './schemas/raw-image.schema';
import * as fs from 'fs';
import * as path from 'path';

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

  @Get('file/:id')
  async getFile(@Param('id') id: string, @Res() res: Response) {
    try {
      const img = await this.imagesService.getById(id);
      if (img && img.storageRef && fs.existsSync(img.storageRef)) {
        return res.sendFile(path.resolve(img.storageRef));
      }
    } catch {
      // ignore
    }
    throw new NotFoundException('File not found');
  }

  @Get('aligned/:name')
  async getAlignedImage(@Param('name') name: string, @Res() res: Response) {
    const filePath = path.resolve(process.cwd(), '..', 'uploads', 'coarse_aligned', name);
    const altPath = path.resolve(process.cwd(), '..', 'vision-service', 'uploads', 'coarse_aligned', name);
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    if (fs.existsSync(altPath)) {
      return res.sendFile(altPath);
    }
    throw new NotFoundException('Aligned file not found');
  }
}
