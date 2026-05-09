import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { AuthenticatedIdentity, AuthenticatedRequest } from './auth.types';

export const CurrentAuthUser = createParamDecorator((_: unknown, context: ExecutionContext): AuthenticatedIdentity => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user;
});
