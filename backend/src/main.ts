import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import helmet from 'helmet';

async function bootstrap() {
  const logDir = process.env.LOG_DIR || '/app/logs';
  if (!fs.existsSync(logDir)) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch {
      // local dev without /app/logs
    }
  }

  let logStream: fs.WriteStream | null = null;
  try {
    logStream = fs.createWriteStream(path.join(logDir, 'app.log'), {
      flags: 'a',
    });
  } catch {
    logStream = null;
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    bodyParser: false,
  });
  const rawBodySaver = (request: any, _response: any, buffer: Buffer) => {
    if (buffer?.length) request.rawBody = Buffer.from(buffer);
  };
  app.use(
    express.json({
      limit: '30mb',
      type: [
        'application/json',
        'application/*+json',
        'application/webhook+json',
      ],
      verify: rawBodySaver,
    }),
  );
  app.use(
    express.urlencoded({
      limit: '30mb',
      extended: true,
      verify: rawBodySaver,
    }),
  );

  if (logStream) {
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
  }

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

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

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const swagger = new DocumentBuilder()
      .setTitle('Tutor Platform API')
      .setDescription('API платформы онлайн-обучения')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swagger);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);

  Logger.log(`Backend running on http://localhost:${port}`, 'Bootstrap');
  if (!isProd) {
    Logger.log(`Swagger docs: http://localhost:${port}/api/docs`, 'Bootstrap');
  }
}
bootstrap();
