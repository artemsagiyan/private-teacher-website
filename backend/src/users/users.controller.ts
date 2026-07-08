import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from './entities/user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: User) {
    return this.usersService.findById(user.id);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: User,
    @Body() body: { firstName?: string; lastName?: string; phone?: string },
  ) {
    return this.usersService.updateProfile(user.id, body);
  }

  @Post('change-password')
  changePassword(
    @CurrentUser() user: User,
    @Body() body: { oldPassword: string; newPassword: string },
  ) {
    return this.usersService.changePassword(user.id, body.oldPassword, body.newPassword);
  }
}
