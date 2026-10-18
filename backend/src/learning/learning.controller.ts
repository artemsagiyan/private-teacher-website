import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import {
  GradeHomeworkItemDto,
  SubmitHomeworkDto,
  UpdateHomeworkDraftDto,
  UpdateLearningProfileDto,
  UpdateLessonReviewDto,
} from './dto/learning.dto';
import { LearningService } from './learning.service';

@Controller('learning')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Get('profile')
  @Roles(UserRole.STUDENT)
  profile(@CurrentUser() user: User) {
    return this.learning.getMyProfile(user);
  }

  @Patch('profile')
  @Roles(UserRole.STUDENT)
  updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateLearningProfileDto,
  ) {
    return this.learning.updateMyProfile(user, dto);
  }

  @Get('progress')
  @Roles(UserRole.STUDENT)
  progress(
    @CurrentUser() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.learning.getMyProgress(user, this.parsePeriod(from, to));
  }

  @Get('students/:studentId')
  @Roles(UserRole.TEACHER)
  student(
    @CurrentUser() user: User,
    @Param('studentId') studentId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.learning.getStudentOverview(
      user,
      studentId,
      this.parsePeriod(from, to),
    );
  }

  @Get('lessons/:lessonId/review')
  @Roles(UserRole.TEACHER)
  review(
    @CurrentUser() user: User,
    @Param('lessonId') lessonId: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.learning.getReview(user, lessonId, studentId);
  }

  @Put('lessons/:lessonId/review')
  @Roles(UserRole.TEACHER)
  updateReview(
    @CurrentUser() user: User,
    @Param('lessonId') lessonId: string,
    @Query('studentId') studentId: string,
    @Body() dto: UpdateLessonReviewDto,
  ) {
    return this.learning.updateReview(user, lessonId, studentId, dto);
  }

  @Post('lessons/:lessonId/homework/generate')
  @Roles(UserRole.TEACHER)
  generateHomework(
    @CurrentUser() user: User,
    @Param('lessonId') lessonId: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.learning.generateHomework(user, lessonId, studentId);
  }

  @Post('lessons/:lessonId/live-assist')
  @Roles(UserRole.TEACHER)
  liveAssist(
    @CurrentUser() user: User,
    @Param('lessonId') lessonId: string,
    @Body() body: { context?: string; boardText?: string },
  ) {
    return this.learning.liveAssist(user, lessonId, body?.context, body?.boardText);
  }

  @Post('lessons/:lessonId/publish')
  @Roles(UserRole.TEACHER)
  publish(
    @CurrentUser() user: User,
    @Param('lessonId') lessonId: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.learning.publishReview(user, lessonId, studentId);
  }

  @Get('homework')
  @Roles(UserRole.STUDENT)
  homework(@CurrentUser() user: User) {
    return this.learning.listMyHomework(user);
  }

  @Get('homework/:id')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  homeworkById(@CurrentUser() user: User, @Param('id') id: string) {
    return this.learning.getHomework(user, id);
  }

  @Patch('homework/:id')
  @Roles(UserRole.TEACHER)
  updateHomework(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateHomeworkDraftDto,
  ) {
    return this.learning.updateHomeworkDraft(user, id, dto);
  }

  @Post('homework/:id/submit')
  @Roles(UserRole.STUDENT)
  submitHomework(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: SubmitHomeworkDto,
  ) {
    return this.learning.submitHomework(user, id, dto);
  }

  @Patch('homework/items/:itemId/grade')
  @Roles(UserRole.TEACHER)
  grade(
    @CurrentUser() user: User,
    @Param('itemId') itemId: string,
    @Body() dto: GradeHomeworkItemDto,
  ) {
    return this.learning.gradeHomeworkItem(user, itemId, dto);
  }

  private parsePeriod(from?: string, to?: string) {
    const parse = (value: string | undefined, name: string) => {
      if (!value) return undefined;
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) {
        throw new BadRequestException(`Некорректная дата ${name}`);
      }
      return date;
    };
    const fromDate = parse(from, 'from');
    const toDate = parse(to, 'to');
    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException('Дата начала периода позже даты окончания');
    }
    return { from: fromDate, to: toDate };
  }
}
