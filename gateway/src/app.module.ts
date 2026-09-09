import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { ImagesModule } from './images/images.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { ObservationsModule } from './observations/observations.module';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionModule } from './session/session.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MongooseModule.forRoot(process.env.MONGO_URL as string), UserModule, ImagesModule, PipelineModule, ObservationsModule, SessionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
