import { User } from '../users/entities/user.entity';

export type PublicUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: User['role'];
  phone?: string;
  avatarUrl?: string;
  isBlocked: boolean;
  isEmailVerified: boolean;
  hasPassword: boolean;
  createdAt: Date;
};

export function toPublicUser(
  user: User,
  hasPassword = Boolean((user as any).passwordHash),
): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    isBlocked: user.isBlocked,
    isEmailVerified: user.isEmailVerified,
    hasPassword,
    createdAt: user.createdAt,
  };
}
