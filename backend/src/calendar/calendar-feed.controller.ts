import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { CalendarService } from './calendar.service';

@Controller('calendar-feed')
export class CalendarFeedController {
  constructor(private readonly calendar: CalendarService) {}

  @Get(':token.ics')
  async get(@Param('token') token: string, @Res() response: Response) {
    const ics = await this.calendar.publicIcs(token);
    response.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.send(ics);
  }
}
