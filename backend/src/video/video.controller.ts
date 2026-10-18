import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { VideoService } from './video.service';
import {
  CameraLinkQueryDto,
  CameraTokenQueryDto,
  VideoTokenQueryDto,
} from './dto/video-token-query.dto';

@Controller('video')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Get('token')
  @UseGuards(JwtAuthGuard)
  getToken(
    @CurrentUser() user: User,
    @Query() query: VideoTokenQueryDto,
  ) {
    return this.videoService.getToken(user.id, user.role, query.slotId);
  }

  @Post('camera-link')
  @UseGuards(JwtAuthGuard)
  cameraLink(
    @CurrentUser() user: User,
    @Body() body: CameraLinkQueryDto,
  ) {
    return this.videoService.createCameraLink(user, body.lessonId);
  }

  @Post('camera-token')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  cameraToken(@Body() body: CameraTokenQueryDto) {
    return this.videoService.consumeCameraLink(body.code);
  }
}
