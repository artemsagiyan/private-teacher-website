import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { User } from '../users/entities/user.entity';
import { CreateSlotDto } from './dto/create-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';

@Controller('calendar')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CalendarController {
  constructor(private calendarService: CalendarService) {}

  @Post('slots')
  @Roles(UserRole.TEACHER)
  createSlot(@CurrentUser() user: User, @Body() dto: CreateSlotDto) {
    return this.calendarService.createSlot(user.id, dto);
  }

  @Patch('slots/:id')
  @Roles(UserRole.TEACHER)
  updateSlot(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateSlotDto,
  ) {
    return this.calendarService.updateSlot(user.id, id, dto);
  }

  @Delete('slots/:id')
  @Roles(UserRole.TEACHER)
  deleteSlot(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('cancelSeries') cancelSeries: string,
  ) {
    return this.calendarService.deleteSlot(user.id, id, cancelSeries === 'true');
  }

  @Get('teacher')
  @Roles(UserRole.TEACHER)
  getTeacherSlots(
    @CurrentUser() user: User,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.calendarService.getTeacherSlots(user.id, from, to);
  }

  @Get('student')
  @Roles(UserRole.STUDENT)
  getStudentSlots(
    @CurrentUser() user: User,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.calendarService.getStudentSlots(user.id, from, to);
  }

  @Get('all')
  @Roles(UserRole.ADMIN)
  getAllSlots(@Query('from') from: string, @Query('to') to: string) {
    return this.calendarService.getAllSlots(from, to);
  }
}
