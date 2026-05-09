import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppEnv } from '../config/env.validation';
import { createBullMqConnectionOptions } from './jobs.config';

@Module({
  providers: [
    {
      provide: 'BULLMQ_CONNECTION_OPTIONS',
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnv, true>): { host: string; port: number } =>
        createBullMqConnectionOptions(
          configService.getOrThrow('REDIS_HOST'),
          configService.getOrThrow('REDIS_PORT'),
        ),
    },
  ],
  exports: ['BULLMQ_CONNECTION_OPTIONS'],
})
export class JobsModule {}
