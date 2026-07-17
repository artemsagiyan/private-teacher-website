import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  RawBodyRequest,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StorageService } from '../storage/storage.service';
import { User } from '../users/entities/user.entity';
import { LessonsService } from './lessons.service';
import { LivekitLifecycleService } from './livekit-lifecycle.service';

@Controller('lessons')
export class LessonsController {
  constructor(
    private readonly lessons: LessonsService,
    private readonly lifecycle: LivekitLifecycleService,
    private readonly storage: StorageService,
  ) {}

  @Post('livekit-webhook')
  @HttpCode(HttpStatus.OK)
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('authorization') authorization?: string,
  ) {
    const rawBody = request.rawBody?.toString('utf8');
    if (!rawBody) {
      throw new Error('Webhook raw body is missing');
    }
    return this.lifecycle.handleWebhook(rawBody, authorization);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: User) {
    return this.lessons.listForUser(user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  get(@CurrentUser() user: User, @Param('id') id: string) {
    return this.lessons.getForUser(user, id);
  }

  @Get(':id/status')
  @UseGuards(JwtAuthGuard)
  status(@CurrentUser() user: User, @Param('id') id: string) {
    return this.lessons.getStatusForUser(user, id);
  }

  @Post(':id/end')
  @UseGuards(JwtAuthGuard)
  end(@CurrentUser() user: User, @Param('id') id: string) {
    return this.lifecycle.endByTeacher(user, id);
  }

  @Put(':id/board')
  @UseGuards(JwtAuthGuard)
  saveBoard(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() scene: Record<string, unknown>,
  ) {
    return this.lessons.saveBoard(user, id, scene);
  }

  @Get(':id/board')
  @UseGuards(JwtAuthGuard)
  board(@CurrentUser() user: User, @Param('id') id: string) {
    return this.lessons.getBoard(user, id);
  }

  @Get(':id/files/:type')
  @UseGuards(JwtAuthGuard)
  async file(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('type')
    type: 'board' | 'recording' | 'transcript' | 'report',
    @Res() response: Response,
  ) {
    const descriptor = await this.lessons.getFile(user, id, type);
    const stream = await this.storage.getObject(descriptor.objectKey);
    response.setHeader('Content-Type', descriptor.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${descriptor.filename}"`,
    );
    stream.pipe(response);
  }
}
