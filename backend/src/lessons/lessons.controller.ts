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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StorageService } from '../storage/storage.service';
import { User } from '../users/entities/user.entity';
import { SaveBoardDto } from './dto/save-board.dto';
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
    @Body() scene: SaveBoardDto,
  ) {
    return this.lessons.saveBoard(user, id, scene as Record<string, unknown>);
  }

  @Get(':id/board')
  @UseGuards(JwtAuthGuard)
  board(@CurrentUser() user: User, @Param('id') id: string) {
    return this.lessons.getBoard(user, id);
  }

  @Post(':id/board-assets')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  saveBoardAsset(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.lessons.saveBoardAsset(user, id, file);
  }

  @Get(':id/board-assets/:assetId')
  @UseGuards(JwtAuthGuard)
  async boardAsset(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('assetId') assetId: string,
    @Res() response: Response,
  ) {
    const descriptor = await this.lessons.getBoardAsset(user, id, assetId);
    const stream = await this.storage.getObject(descriptor.key);
    response.setHeader('Content-Type', descriptor.contentType);
    stream.pipe(response);
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
