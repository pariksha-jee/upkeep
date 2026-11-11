import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service.js';
import { CredentialResolver } from './credential-resolver.js';
import { SshTunnelManager } from './ssh-manager.js';
import { OpenVpnManager } from './openvpn-manager.js';
import { CheckExecutor } from './check-executor.js';
import { NotificationDispatcher } from './notify/notification-dispatcher.js';
import {
  CHECKS_QUEUE_TOKEN,
  NOTIFICATIONS_QUEUE_TOKEN,
  createChecksQueue,
  createNotificationsQueue,
} from './queues.js';

/**
 * Engine internals shared by the HTTP API (test-now, tunnel test, channel
 * verify) and the worker process (dispatcher loop, queue processors).
 */
@Global()
@Module({
  providers: [
    CredentialResolver,
    SshTunnelManager,
    OpenVpnManager,
    CheckExecutor,
    NotificationDispatcher,
    { provide: CHECKS_QUEUE_TOKEN, useFactory: createChecksQueue },
    { provide: NOTIFICATIONS_QUEUE_TOKEN, useFactory: createNotificationsQueue },
  ],
  exports: [
    CredentialResolver,
    SshTunnelManager,
    OpenVpnManager,
    CheckExecutor,
    NotificationDispatcher,
    CHECKS_QUEUE_TOKEN,
    NOTIFICATIONS_QUEUE_TOKEN,
  ],
})
export class WorkerCoreModule {}

export { PrismaService };
