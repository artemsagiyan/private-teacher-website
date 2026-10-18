import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { CreateMockExamDto, GradeMockExamItemDto, SubmitMockExamDto } from './dto/mock-exam.dto';
import { MockExamsService } from './mock-exams.service';

@Controller('mock-exams')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MockExamsController {
  constructor(private readonly exams: MockExamsService) {}

  @Get()
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  list(@CurrentUser() user: User, @Query('studentId') studentId?: string) { return this.exams.list(user, studentId); }

  @Post()
  @Roles(UserRole.TEACHER)
  create(@CurrentUser() user: User, @Body() dto: CreateMockExamDto) { return this.exams.create(user, dto); }

  @Post('start')
  @Roles(UserRole.STUDENT)
  start(@CurrentUser() user: User) { return this.exams.startForStudent(user); }

  @Get(':id')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  get(@CurrentUser() user: User, @Param('id') id: string) { return this.exams.get(user, id); }

  @Post(':id/submit')
  @Roles(UserRole.STUDENT)
  submit(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: SubmitMockExamDto) { return this.exams.submit(user, id, dto); }

  @Patch(':id/grade')
  @Roles(UserRole.TEACHER)
  grade(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: GradeMockExamItemDto) { return this.exams.grade(user, id, dto); }
}
