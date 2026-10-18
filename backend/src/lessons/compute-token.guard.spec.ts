import { UnauthorizedException } from '@nestjs/common';
import { ComputeTokenGuard } from './compute-token.guard';

describe('ComputeTokenGuard', () => {
  const requestContext = (token?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ header: () => token }),
      }),
    }) as any;

  it('allows requests with the configured compute token', () => {
    const guard = new ComputeTokenGuard({
      get: () => 'worker-secret',
    } as any);

    expect(guard.canActivate(requestContext('worker-secret'))).toBe(true);
  });

  it('rejects missing or incorrect compute tokens', () => {
    const guard = new ComputeTokenGuard({
      get: () => 'worker-secret',
    } as any);

    expect(() => guard.canActivate(requestContext())).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(requestContext('wrong-secret'))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects worker requests when the server secret is not configured', () => {
    const guard = new ComputeTokenGuard({ get: () => '' } as any);

    expect(() => guard.canActivate(requestContext('worker-secret'))).toThrow(
      UnauthorizedException,
    );
  });
});
