import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Repository } from 'typeorm';
import { RegistrationCode } from './entities/registration-code.entity';
import { User } from '../users/entities/user.entity';
import { Teacher } from '../teachers/entities/teacher.entity';
import { Student } from '../students/entities/student.entity';
import { Booking } from '../bookings/entities/booking.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(RegistrationCode)
    private codeRepository: Repository<RegistrationCode>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Teacher)
    private teacherRepository: Repository<Teacher>,
    @InjectRepository(Student)
    private studentRepository: Repository<Student>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
  ) {}

  async generateRegistrationCode(adminId: string, expiresInDays = 7) {
    const code = this.codeRepository.create({
      code: uuidv4().slice(0, 10).toUpperCase(),
      expiresAt: new Date(Date.now() + expiresInDays * 86400000),
      createdByAdminId: adminId,
    });
    return this.codeRepository.save(code);
  }

  async listCodes() {
    return this.codeRepository.find({ order: { createdAt: 'DESC' } });
  }

  async listUsers(page = 1, limit = 20, search?: string) {
    const qb = this.userRepository
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      qb.where('user.email ILIKE :search OR user.firstName ILIKE :search', {
        search: `%${search}%`,
      });
    }

    const [users, total] = await qb.getManyAndCount();
    return { users, total, page, limit };
  }

  async blockUser(userId: string, isBlocked: boolean) {
    await this.userRepository.update(userId, { isBlocked });
    return this.userRepository.findOne({ where: { id: userId } });
  }

  async assignTeacherToStudent(studentId: string, teacherId: string) {
    await this.studentRepository.update({ id: studentId }, { teacherId });
    return { message: 'Преподаватель назначен' };
  }

  async getStats() {
    const [totalStudents, totalTeachers, totalBookings, totalUsers] = await Promise.all([
      this.studentRepository.count(),
      this.teacherRepository.count(),
      this.bookingRepository.count(),
      this.userRepository.count(),
    ]);
    return { totalUsers, totalStudents, totalTeachers, totalBookings };
  }

  async listTeachers() {
    return this.teacherRepository.find({
      relations: ['user'],
      order: { user: { createdAt: 'DESC' } } as any,
    });
  }
}
