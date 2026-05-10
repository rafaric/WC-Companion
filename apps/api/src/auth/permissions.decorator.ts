import { SetMetadata } from '@nestjs/common';

import { AUTH_PERMISSION_METADATA_KEYS } from './auth.constants';

export function RequirePermissions(...permissions: string[]) {
  return SetMetadata(AUTH_PERMISSION_METADATA_KEYS.REQUIRED_PERMISSIONS, permissions);
}
