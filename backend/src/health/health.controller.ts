import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { StorageService } from '../storage/storage.service';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
  ) {}

  @Get()
  async check() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
      });
    }
    const storageOk = await this.storage.ping();
    return {
      status: storageOk ? 'ok' : 'degraded',
      database: 'ok',
      storage: storageOk ? 'ok' : 'degraded',
      time: new Date().toISOString(),
    };
  }
}
