import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { User } from '../users/entities/user.entity';
import {
  AssignTeacherDto,
  BlockUserDto,
  GenerateCodeDto,
} from './dto/admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Post('codes')
  generateCode(@CurrentUser() user: User, @Body() body: GenerateCodeDto) {
    return this.adminService.generateRegistrationCode(
      user.id,
      body.expiresInDays,
    );
  }

  @Get('codes')
  listCodes() {
    return this.adminService.listCodes();
  }

  @Get('users')
  listUsers(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('search') search: string,
  ) {
    return this.adminService.listUsers(+page || 1, +limit || 20, search);
  }

  @Patch('users/:id/block')
  blockUser(@Param('id') id: string, @Body() body: BlockUserDto) {
    return this.adminService.blockUser(id, body.isBlocked);
  }

  @Patch('assign')
  assignTeacher(@Body() body: AssignTeacherDto) {
    return this.adminService.assignTeacherToStudent(
      body.studentId,
      body.teacherId,
    );
  }

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('teachers')
  listTeachers() {
    return this.adminService.listTeachers();
  }

  @Get('students')
  listStudents() {
    return this.adminService.listStudents();
  }
}
