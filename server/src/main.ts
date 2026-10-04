import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const uploadDir = join(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');
  mkdirSync(uploadDir, { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  app.setGlobalPrefix('api');
  // 封签照片本地存放，通过 /seal-photos/ 访问
  app.useStaticAssets(uploadDir, { prefix: '/seal-photos/' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`API running on http://localhost:${port}/api`);
}
bootstrap();
