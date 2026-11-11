import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { env } from './config/env.js';
import { DbModule } from './shared/db.module.js';
import { RedisModule } from './common/redis.provider.js';
import { WorkerCoreModule } from './worker-core/worker-core.module.js';
import { JwtAuthGuard } from './common/jwt-auth.guard.js';
import { EnvelopeInterceptor } from './common/envelope.interceptor.js';
import { AllExceptionsFilter } from './common/exceptions.filter.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MonitorsModule } from './modules/monitors/monitors.module.js';
import { TunnelsModule } from './modules/tunnels/tunnels.module.js';
import { ChannelsModule } from './modules/channels/channels.module.js';
import { DevicesModule } from './modules/devices/devices.module.js';
import { IncidentsModule } from './modules/incidents/incidents.module.js';
import { SummaryModule } from './modules/summary/summary.module.js';

@Module({
  imports: [
    DbModule,
    RedisModule,
    WorkerCoreModule,
    JwtModule.register({
      global: true,
      secret: env.JWT_ACCESS_SECRET,
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    AuthModule,
    UsersModule,
    HealthModule,
    MonitorsModule,
    TunnelsModule,
    ChannelsModule,
    DevicesModule,
    IncidentsModule,
    SummaryModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
