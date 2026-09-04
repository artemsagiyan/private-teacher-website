import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { VideoService } from './video.service';
import { VideoTokenQueryDto } from './dto/video-token-query.dto';

@Controller('video')
@UseGuards(JwtAuthGuard)
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Get('token')
  getToken(
    @CurrentUser() user: User,
    @Query() query: VideoTokenQueryDto,
  ) {
    return this.videoService.getToken(user.id, user.role, query.slotId);
  }
}
