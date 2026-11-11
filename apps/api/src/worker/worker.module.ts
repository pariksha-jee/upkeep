import { Module } from '@nestjs/common';
import { DbModule } from '../shared/db.module.js';
import { RedisModule } from '../common/redis.provider.js';
import { WorkerCoreModule } from '../worker-core/worker-core.module.js';
import { TunnelsModule } from '../modules/tunnels/tunnels.module.js';
import { DispatcherService } from './dispatcher.js';
import { QueueProcessors } from './processors.js';
import { MaintenanceService } from './maintenance.js';

/**
 * Worker application context (no HTTP listener): dispatcher + queue
 * processors + maintenance jobs. Same image as the API, different entrypoint.
 */
@Module({
  imports: [DbModule, RedisModule, WorkerCoreModule, TunnelsModule],
  providers: [DispatcherService, QueueProcessors, MaintenanceService],
})
export class WorkerModule {}
