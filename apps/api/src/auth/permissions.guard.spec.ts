import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AUTH_PERMISSIONS } from './auth.constants';
import type { AuthenticatedIdentity } from './auth.types';
import { RequirePermissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

class ProtectedMatchController {
  @RequirePermissions(AUTH_PERMISSIONS.MATCHES_FINALIZE)
  finalize(): void {}
}

interface RequestLike {
  user: AuthenticatedIdentity;
}

function createExecutionContext(userPermissions: string[]): ExecutionContext {
  const request: RequestLike = {
    user: {
      authSubject: 'auth0|123456789',
      email: 'admin@example.com',
      name: 'Admin',
      nickname: 'admin',
      picture: null,
      permissions: userPermissions,
    },
  };
  const handler = ProtectedMatchController.prototype.finalize;

  return {
    getClass: () => ProtectedMatchController,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  it('allows access when the required permission is present', () => {
    const guard = new PermissionsGuard(new Reflector());

    expect(guard.canActivate(createExecutionContext([AUTH_PERMISSIONS.MATCHES_FINALIZE]))).toBe(true);
  });

  it('rejects access when the required permission is missing', () => {
    const guard = new PermissionsGuard(new Reflector());

    expect(() => guard.canActivate(createExecutionContext([]))).toThrow(ForbiddenException);
  });
});
