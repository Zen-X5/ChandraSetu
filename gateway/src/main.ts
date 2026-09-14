import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.PORT ?? 8000;
  await app.listen(port);
  console.log('\n============================================================');
  console.log('              CHANDRASETU PLATFORM IS ONLINE 🚀             ');
  console.log('============================================================');
  console.log('🌕 Web Dashboard:     http://localhost:3000');
  console.log(`⚙️ API Gateway:       http://localhost:${port}/api`);
  console.log('👁️ Vision Engine:     http://localhost:8001');
  console.log('🧠 Inference Engine:  http://localhost:8002');
  console.log('📦 MinIO S3 UI:       http://localhost:9001 (minioadmin / minioadmin)');
  console.log('============================================================\n');
}
bootstrap();
