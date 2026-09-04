import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { StorageService } from '../storage/storage.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private usersService: UsersService,
    private storage: StorageService,
  ) {}

  @Get('me')
  getMe(@CurrentUser() user: User) {
    return this.usersService.findById(user.id);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: User,
    @Body() body: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, body);
  }

  @Post('change-password')
  changePassword(
    @CurrentUser() user: User,
    @Body() body: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(
      user.id,
      body.oldPassword,
      body.newPassword,
    );
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadAvatar(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.uploadAvatar(user.id, file);
  }

  @Get('me/avatar')
  async avatar(@CurrentUser() user: User, @Res() response: Response) {
    const key = await this.usersService.getAvatarObjectKey(user.id);
    const stream = await this.storage.getObject(key);
    const contentType = key.endsWith('.png')
      ? 'image/png'
      : key.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';
    response.setHeader('Content-Type', contentType);
    stream.pipe(response);
  }
}
