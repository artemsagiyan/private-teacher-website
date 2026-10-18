import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { StorageService } from '../storage/storage.service';
import { ComputeTokenGuard } from './compute-token.guard';
import { LessonProcessingService } from './lesson-processing.service';

@Controller('compute/jobs')
@UseGuards(ComputeTokenGuard)
export class ComputeController {
  constructor(
    private readonly processing: LessonProcessingService,
    private readonly storage: StorageService,
  ) {}

  @Post('next')
  @HttpCode(HttpStatus.OK)
  async claim() {
    const job = await this.processing.claimLocalComputeJob();
    if (!job) throw new NotFoundException('Нет заданий для локальной обработки');
    return job;
  }

  @Get(':id/recording')
  async recording(
    @Param('id') id: string,
    @Headers('x-compute-lease') leaseToken: string,
    @Res() response: Response,
  ) {
    const objectKey = await this.processing.localComputeRecording(id, leaseToken);
    const stream = await this.storage.getObject(objectKey);
    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-store');
    stream.on('error', (error) => response.destroy(error));
    stream.pipe(response);
  }

  @Get(':id/transcript')
  async transcript(
    @Param('id') id: string,
    @Headers('x-compute-lease') leaseToken: string,
  ): Promise<unknown> {
    return this.processing.localComputeTranscript(id, leaseToken);
  }

  @Post(':id/transcript')
  @HttpCode(HttpStatus.OK)
  checkpointTranscript(
    @Param('id') id: string,
    @Headers('x-compute-lease') leaseToken: string,
    @Body() body: { transcript?: unknown },
  ) {
    return this.processing.checkpointLocalTranscript(
      id,
      leaseToken,
      body?.transcript,
    );
  }

  @Post(':id/heartbeat')
  @HttpCode(HttpStatus.OK)
  heartbeat(
    @Param('id') id: string,
    @Headers('x-compute-lease') leaseToken: string,
  ) {
    return this.processing.heartbeatLocalComputeJob(id, leaseToken);
  }

  @Post(':id/result')
  @HttpCode(HttpStatus.OK)
  complete(
    @Param('id') id: string,
    @Headers('x-compute-lease') leaseToken: string,
    @Body() body: { transcript?: unknown; report?: unknown },
  ) {
    return this.processing.completeLocalComputeJob(
      id,
      leaseToken,
      body?.transcript,
      body?.report,
    );
  }

  @Post(':id/fail')
  @HttpCode(HttpStatus.OK)
  fail(
    @Param('id') id: string,
    @Headers('x-compute-lease') leaseToken: string,
    @Body() body: { error?: unknown },
  ) {
    const error = typeof body?.error === 'string' ? body.error : 'Ошибка обработки';
    return this.processing.failLocalComputeJob(id, leaseToken, error);
  }
}
