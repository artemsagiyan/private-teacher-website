import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { StorageService } from '../storage/storage.service';
import { toPublicUser } from '../common/public-user';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private storage: StorageService,
  ) {}

  async findById(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'firstName',
        'lastName',
        'role',
        'phone',
        'avatarUrl',
        'isBlocked',
        'isEmailVerified',
        'createdAt',
        'passwordHash',
      ],
    });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return toPublicUser(user, Boolean(user.passwordHash));
  }

  async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; phone?: string },
  ) {
    await this.userRepository.update(userId, data);
    return this.findById(userId);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'passwordHash'],
    });
    if (!user) throw new NotFoundException('Пользователь не найден');
    if (!user.passwordHash) {
      throw new BadRequestException(
        'У аккаунта нет пароля. Задайте его через «Забыли пароль» или выйдите и войдите через Google.',
      );
    }
    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Неверный текущий пароль');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userRepository.update(userId, { passwordHash });
    return { message: 'Пароль изменён' };
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Файл не получен');
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Допустимы JPEG, PNG или WebP');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Максимальный размер файла — 2 МБ');
    }
    const ext =
      file.mimetype === 'image/png'
        ? 'png'
        : file.mimetype === 'image/webp'
          ? 'webp'
          : 'jpg';
    const objectKey = `avatars/${userId}.${ext}`;
    await this.storage.putBuffer(objectKey, file.buffer, file.mimetype);
    await this.userRepository.update(userId, { avatarUrl: objectKey });
    return this.findById(userId);
  }

  async getAvatarObjectKey(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'avatarUrl'],
    });
    if (!user?.avatarUrl) throw new NotFoundException('Аватар не загружен');
    if (user.avatarUrl.startsWith('http')) {
      throw new BadRequestException('Аватар задан внешней ссылкой');
    }
    return user.avatarUrl;
  }
}
