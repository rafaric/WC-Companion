import { CanActivate, ForbiddenException, Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest } from './auth.types';
import { AUTH_PERMISSION_METADATA_KEYS } from './auth.constants';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      AUTH_PERMISSION_METADATA_KEYS.REQUIRED_PERMISSIONS,
      [context.getHandler(), context.getClass()],
    );

    if (requiredPermissions === undefined || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userPermissions = request.user?.permissions ?? [];
    const isAllowed = requiredPermissions.every((permission) => userPermissions.includes(permission));

    if (!isAllowed) {
      throw new ForbiddenException('Missing required permissions');
    }

    return true;
  }
}
