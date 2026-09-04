import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { TeachersService } from './teachers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { UpdateTeacherProfileDto } from './dto/update-teacher-profile.dto';
import { User } from '../users/entities/user.entity';

@Controller('teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeachersController {
  constructor(private teachersService: TeachersService) {}

  @Get('me')
  @Roles(UserRole.TEACHER)
  getMyProfile(@CurrentUser() user: User) {
    return this.teachersService.findByUserId(user.id);
  }

  @Patch('profile')
  @Roles(UserRole.TEACHER)
  updateProfile(
    @CurrentUser() user: User,
    @Body() body: UpdateTeacherProfileDto,
  ) {
    return this.teachersService.updateProfile(user.id, body);
  }

  @Get('students')
  @Roles(UserRole.TEACHER)
  getStudents(@CurrentUser() user: User) {
    return this.teachersService.getStudents(user.id);
  }

  @Post('invite-code')
  @Roles(UserRole.TEACHER)
  generateInviteCode(@CurrentUser() user: User) {
    return this.teachersService.generateInviteCode(user.id);
  }
}
