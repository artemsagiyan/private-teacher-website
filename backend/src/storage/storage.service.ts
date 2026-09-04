import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { Readable } from 'stream';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Client;
  readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('storage.bucket');
    this.client = new Client({
      endPoint: this.config.get<string>('storage.endPoint'),
      port: this.config.get<number>('storage.port'),
      useSSL: this.config.get<boolean>('storage.useSSL'),
      accessKey: this.config.get<string>('storage.accessKey'),
      secretKey: this.config.get<string>('storage.secretKey'),
      region: this.config.get<string>('storage.region'),
      pathStyle: true,
    });
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.listBuckets();
      return true;
    } catch {
      return false;
    }
  }

  async onModuleInit() {
    try {
      if (!(await this.client.bucketExists(this.bucket))) {
        await this.client.makeBucket(
          this.bucket,
          this.config.get<string>('storage.region'),
        );
      }
      this.logger.log(`Storage bucket ready: ${this.bucket}`);
    } catch (error) {
      this.logger.error(
        `Storage is not ready: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async putBuffer(
    objectKey: string,
    body: Buffer,
    contentType = 'application/octet-stream',
  ) {
    await this.client.putObject(this.bucket, objectKey, body, body.length, {
      'Content-Type': contentType,
    });
    return objectKey;
  }

  async putJson(objectKey: string, value: unknown) {
    return this.putBuffer(
      objectKey,
      Buffer.from(JSON.stringify(value)),
      'application/json; charset=utf-8',
    );
  }

  async putText(objectKey: string, value: string) {
    return this.putBuffer(
      objectKey,
      Buffer.from(value, 'utf8'),
      'text/plain; charset=utf-8',
    );
  }

  async getObject(objectKey: string): Promise<Readable> {
    return this.client.getObject(this.bucket, objectKey);
  }

  async getBuffer(objectKey: string): Promise<Buffer> {
    const stream = await this.getObject(objectKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async getJson<T>(objectKey: string): Promise<T> {
    const buffer = await this.getBuffer(objectKey);
    return JSON.parse(buffer.toString('utf8')) as T;
  }

  async exists(objectKey: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, objectKey);
      return true;
    } catch (error: any) {
      if (error?.code === 'NotFound' || error?.code === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }

  async deleteObject(objectKey: string) {
    await this.client.removeObject(this.bucket, objectKey);
  }

  async presignedGetUrl(objectKey: string, expiresSeconds = 3600) {
    return this.client.presignedGetObject(
      this.bucket,
      objectKey,
      expiresSeconds,
    );
  }
}
