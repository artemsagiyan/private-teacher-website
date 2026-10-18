import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { CreatePaymentDto, UpdatePaymentDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('teacher')
  @Roles(UserRole.TEACHER)
  teacher(@CurrentUser() user: User) { return this.payments.listForTeacher(user); }

  @Get('student')
  @Roles(UserRole.STUDENT)
  student(@CurrentUser() user: User) { return this.payments.listForStudent(user); }

  @Post()
  @Roles(UserRole.TEACHER)
  create(@CurrentUser() user: User, @Body() dto: CreatePaymentDto) { return this.payments.create(user, dto); }

  @Patch(':id')
  @Roles(UserRole.TEACHER)
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdatePaymentDto) { return this.payments.update(user, id, dto); }
}
