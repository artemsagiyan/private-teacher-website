import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Repository } from 'typeorm';
import { Teacher } from './entities/teacher.entity';
import { Student } from '../students/entities/student.entity';

@Injectable()
export class TeachersService {
  constructor(
    @InjectRepository(Teacher)
    private teacherRepository: Repository<Teacher>,
    @InjectRepository(Student)
    private studentRepository: Repository<Student>,
  ) {}

  async findByUserId(userId: string) {
    const teacher = await this.teacherRepository.findOne({
      where: { userId },
      relations: ['user', 'students', 'students.user'],
    });
    if (!teacher) throw new NotFoundException('Преподаватель не найден');
    return teacher;
  }

  async findById(id: string) {
    const teacher = await this.teacherRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!teacher) throw new NotFoundException('Преподаватель не найден');
    return teacher;
  }

  async updateProfile(userId: string, data: { bio?: string; subjects?: string }) {
    const teacher = await this.findByUserId(userId);
    Object.assign(teacher, data);
    return this.teacherRepository.save(teacher);
  }

  async getStudents(userId: string) {
    const teacher = await this.findByUserId(userId);
    return this.studentRepository.find({
      where: { teacherId: teacher.id },
      relations: ['user'],
    });
  }

  async generateInviteCode(userId: string) {
    const teacher = await this.findByUserId(userId);
    teacher.inviteCode = uuidv4().slice(0, 8).toUpperCase();
    await this.teacherRepository.save(teacher);
    return { inviteCode: teacher.inviteCode };
  }

  async findByInviteCode(code: string) {
    return this.teacherRepository.findOne({
      where: { inviteCode: code },
      relations: ['user'],
    });
  }

  async findAll() {
    return this.teacherRepository.find({ relations: ['user'] });
  }

  async getDashboard(userId: string) {
    const teacher = await this.findByUserId(userId);
    const studentsCount = await this.studentRepository.count({
      where: { teacherId: teacher.id },
    });
    return { teacher, studentsCount };
  }
}
