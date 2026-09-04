import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { User } from '../users/entities/user.entity';
import { CreateBookingDto } from './dto/create-booking.dto';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post()
  @Roles(UserRole.STUDENT)
  createBooking(
    @CurrentUser() user: User,
    @Body() body: CreateBookingDto,
  ) {
    return this.bookingsService.createBooking(
      user.id,
      body.slotId,
      body.isRecurring ?? false,
    );
  }

  @Delete(':id/student')
  @Roles(UserRole.STUDENT)
  cancelByStudent(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('cancelSeries') cancelSeries: string,
  ) {
    return this.bookingsService.cancelByStudent(
      user.id,
      id,
      cancelSeries === 'true',
    );
  }

  @Delete(':id/teacher')
  @Roles(UserRole.TEACHER)
  cancelByTeacher(@CurrentUser() user: User, @Param('id') id: string) {
    return this.bookingsService.cancelByTeacher(user.id, id);
  }

  @Get('my')
  @Roles(UserRole.STUDENT)
  getMyBookings(@CurrentUser() user: User) {
    return this.bookingsService.getStudentBookings(user.id);
  }

  @Get('upcoming')
  @Roles(UserRole.STUDENT)
  getUpcoming(@CurrentUser() user: User) {
    return this.bookingsService.getUpcomingStudentBookings(user.id);
  }

  @Get('teacher')
  @Roles(UserRole.TEACHER)
  getTeacherBookings(@CurrentUser() user: User) {
    return this.bookingsService.getTeacherBookings(user.id);
  }
}
