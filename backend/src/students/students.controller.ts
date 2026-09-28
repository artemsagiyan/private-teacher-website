import { Body, Controller, Delete, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { AttachTeacherDto } from './dto/attach-teacher.dto';
import { UpdateParentsDto } from './dto/update-parents.dto';
import { User } from '../users/entities/user.entity';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private studentsService: StudentsService) {}

  @Get('me')
  @Roles(UserRole.STUDENT)
  getMyProfile(@CurrentUser() user: User) {
    return this.studentsService.findByUserId(user.id);
  }

  @Patch('parents')
  @Roles(UserRole.STUDENT)
  updateParents(@CurrentUser() user: User, @Body() body: UpdateParentsDto) {
    return this.studentsService.updateParents(user.id, body);
  }

  @Get('teacher')
  @Roles(UserRole.STUDENT)
  getMyTeacher(@CurrentUser() user: User) {
    return this.studentsService.getMyTeacher(user.id);
  }

  @Post('attach-teacher')
  @Roles(UserRole.STUDENT)
  attachTeacher(@CurrentUser() user: User, @Body() body: AttachTeacherDto) {
    return this.studentsService.attachTeacherByCode(user.id, body.inviteCode);
  }

  @Delete('detach-teacher')
  @Roles(UserRole.STUDENT)
  detachTeacher(@CurrentUser() user: User) {
    return this.studentsService.detachTeacher(user.id);
  }
}
