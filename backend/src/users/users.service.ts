import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findById(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['teacher', 'student'],
    });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; phone?: string; avatarUrl?: string },
  ) {
    await this.userRepository.update(userId, data);
    return this.findById(userId);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'passwordHash'],
    });
    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) throw new Error('Неверный текущий пароль');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userRepository.update(userId, { passwordHash });
    return { message: 'Пароль изменён' };
  }

  async findAll(page = 1, limit = 20) {
    const [users, total] = await this.userRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { users, total, page, limit };
  }

  async blockUser(id: string, isBlocked: boolean) {
    await this.userRepository.update(id, { isBlocked });
    return this.findById(id);
  }
}
