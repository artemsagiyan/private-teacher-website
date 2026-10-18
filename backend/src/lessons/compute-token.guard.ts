import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

@Injectable()
export class ComputeTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('compute.secret');
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header('x-compute-token');

    if (!expected || !provided) {
      throw new UnauthorizedException('Недействительный ключ вычислительного узла');
    }

    const expectedBytes = Buffer.from(expected);
    const providedBytes = Buffer.from(provided);
    if (
      expectedBytes.length !== providedBytes.length ||
      !timingSafeEqual(expectedBytes, providedBytes)
    ) {
      throw new UnauthorizedException('Недействительный ключ вычислительного узла');
    }

    return true;
  }
}
