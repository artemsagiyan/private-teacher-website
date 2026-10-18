import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { FamilyService } from './family.service';
import { CreateFamilyMessageDto } from './dto/create-family-message.dto';

@Controller('family')
export class FamilyController {
  constructor(private readonly family: FamilyService, private readonly config: ConfigService) {}

  @Get('teacher/:studentId/messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  teacherMessages(
    @CurrentUser() user: User,
    @Param('studentId') studentId: string,
  ) {
    return this.family.teacherMessages(user, studentId);
  }

  @Post('teacher/:studentId/messages')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Roles(UserRole.TEACHER)
  sendTeacherMessage(
    @CurrentUser() user: User,
    @Param('studentId') studentId: string,
    @Body() dto: CreateFamilyMessageDto,
  ) {
    return this.family.sendTeacherMessage(user, studentId, dto.body);
  }

  @Get(':token/messages')
  messages(@Param('token') token: string) {
    return this.family.familyMessages(token);
  }

  @Post(':token/messages')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  sendMessage(
    @Param('token') token: string,
    @Body() dto: CreateFamilyMessageDto,
  ) {
    return this.family.sendFamilyMessage(token, dto.body);
  }

  @Get(':token')
  get(
    @Param('token') token: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
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
    return this.family.getByToken(token, { from: fromDate, to: toDate });
  }

  @Post('access')
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: User) { return this.family.createAccess(user, this.config.get<string>('frontendUrl') || 'http://localhost:3000'); }
}
