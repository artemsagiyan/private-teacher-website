import {
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { isGoogleOAuthEnabled } from '../../common/google-oauth';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  canActivate(context: ExecutionContext) {
    if (!isGoogleOAuthEnabled()) {
      throw new NotFoundException('Google OAuth не настроен');
    }
    return super.canActivate(context);
  }
}
