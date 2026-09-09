import { Module } from '@nestjs/common';
import { ObservationsService } from './observations.service';
import { ObservationsController } from './observations.controller';

@Module({
  controllers: [ObservationsController],
  providers: [ObservationsService],
})
export class ObservationsModule {}
