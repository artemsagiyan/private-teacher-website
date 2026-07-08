import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from './entities/student.entity';
import { Teacher } from '../teachers/entities/teacher.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private studentRepository: Repository<Student>,
    @InjectRepository(Teacher)
    private teacherRepository: Repository<Teacher>,
    private notificationsService: NotificationsService,
  ) {}

  async findByUserId(userId: string) {
    const student = await this.studentRepository.findOne({
      where: { userId },
      relations: ['user', 'teacher', 'teacher.user'],
    });
    if (!student) throw new NotFoundException('Ученик не найден');
    return student;
  }

  async attachTeacherByCode(userId: string, inviteCode: string) {
    const student = await this.findByUserId(userId);
    if (student.teacherId) {
      throw new BadRequestException('Уже привязан к преподавателю');
    }

    const teacher = await this.teacherRepository.findOne({
      where: { inviteCode },
      relations: ['user'],
    });
    if (!teacher) throw new NotFoundException('Неверный код преподавателя');

    student.teacherId = teacher.id;
    await this.studentRepository.save(student);

    const studentName =
      `${student.user?.firstName ?? ''} ${student.user?.lastName ?? ''}`.trim();
    await this.notificationsService.notifyTeacherNewStudent(teacher.userId, studentName);

    return student;
  }

  async detachTeacher(userId: string) {
    const student = await this.findByUserId(userId);
    student.teacherId = null;
    return this.studentRepository.save(student);
  }

  async getMyTeacher(userId: string) {
    const student = await this.findByUserId(userId);
    if (!student.teacherId) return null;
    return student.teacher;
  }

  async adminAssignTeacher(studentId: string, teacherId: string) {
    const student = await this.studentRepository.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Ученик не найден');
    student.teacherId = teacherId;
    return this.studentRepository.save(student);
  }
}
