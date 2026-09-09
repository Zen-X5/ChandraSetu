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
import { AuthModule } from './auth/auth.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGO_URL as string),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'very_secret_superKey',
      signOptions: { expiresIn: '30d' },
    }),
    UserModule,
    ImagesModule,
    PipelineModule,
    ObservationsModule,
    SessionModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
