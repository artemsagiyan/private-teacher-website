import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const logDir = '/app/logs';
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  const logStream = fs.createWriteStream(path.join(logDir, 'app.log'), { flags: 'a' });

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = (chunk: any, ...args: any[]) => {
    logStream.write(chunk);
    return (originalStdoutWrite as any)(chunk, ...args);
  };
  process.stderr.write = (chunk: any, ...args: any[]) => {
    logStream.write(chunk);
    return (originalStderrWrite as any)(chunk, ...args);
  };

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Tutor Platform API')
    .setDescription('API платформы онлайн-обучения')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  Logger.log(`Backend running on http://localhost:${port}`, 'Bootstrap');
  Logger.log(`Swagger docs: http://localhost:${port}/api/docs`, 'Bootstrap');
  Logger.log(`Logs: ${logDir}/app.log`, 'Bootstrap');
}
bootstrap();
