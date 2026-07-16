import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessToken } from 'livekit-server-sdk';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { CalendarSlot } from '../calendar/entities/calendar-slot.entity';
import { Student } from '../students/entities/student.entity';
import { Teacher } from '../teachers/entities/teacher.entity';

@Injectable()
export class VideoService {
  constructor(
    private config: ConfigService,
    @InjectRepository(Booking) private bookingRepo: Repository<Booking>,
    @InjectRepository(CalendarSlot) private slotRepo: Repository<CalendarSlot>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(Teacher) private teacherRepo: Repository<Teacher>,
  ) {}

  async getToken(userId: string, role: string, slotId: string) {
    if (role === 'student') {
      const student = await this.studentRepo.findOne({ where: { userId } });
      if (!student) throw new ForbiddenException();
      const booking = await this.bookingRepo.findOne({
        where: { studentId: student.id, slotId, status: BookingStatus.CONFIRMED },
      });
      if (!booking) throw new ForbiddenException('Нет подтверждённой записи на этот урок');
    } else if (role === 'teacher') {
      const teacher = await this.teacherRepo.findOne({ where: { userId } });
      if (!teacher) throw new ForbiddenException();
      const slot = await this.slotRepo.findOne({ where: { id: slotId, teacherId: teacher.id } });
      if (!slot) throw new ForbiddenException('Этот слот не принадлежит вам');
    }

    const apiKey = this.config.get<string>('livekit.apiKey');
    const apiSecret = this.config.get<string>('livekit.apiSecret');

    const at = new AccessToken(apiKey, apiSecret, { identity: userId });
    at.addGrant({
      roomJoin: true,
      room: `lesson-${slotId}`,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return {
      token: await at.toJwt(),
      room: `lesson-${slotId}`,
    };
  }
}
