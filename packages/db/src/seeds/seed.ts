/**
 * Idempotent development seed: demo user, one email channel, two monitors
 * (self-health + a public endpoint) and bindings. Safe to run repeatedly.
 */
import { hash } from 'argon2';
import { prisma } from '../client.js';

const DEMO_EMAIL = 'demo@upkeep.dev';
const DEMO_PASSWORD = 'demo12345';

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: 'Demo User',
      passwordHash: await hash(DEMO_PASSWORD),
    },
  });

  let channel = await prisma.channel.findFirst({
    where: { userId: user.id, type: 'EMAIL', label: 'Primary email' },
  });
  if (!channel) {
    channel = await prisma.channel.create({
      data: {
        userId: user.id,
        type: 'EMAIL',
        label: 'Primary email',
        config: { kind: 'EMAIL', to: DEMO_EMAIL },
        verifiedAt: new Date(),
      },
    });
  }

  const monitors: Array<{
    key: string;
    data: {
      name: string;
      type: 'HTTP';
      target: string;
      method: string;
      intervalSeconds: number;
      expectedStatusCodes: number[];
    };
  }> = [
    {
      key: 'Upkeep API (self)',
      data: {
        name: 'Upkeep API (self)',
        type: 'HTTP' as const,
        target: 'http://127.0.0.1:4000/health/live',
        method: 'GET',
        intervalSeconds: 60,
        expectedStatusCodes: [200],
      },
    },
    {
      key: 'Example (public)',
      data: {
        name: 'Example (public)',
        type: 'HTTP' as const,
        target: 'https://example.com',
        method: 'GET',
        intervalSeconds: 300,
        expectedStatusCodes: [200, 301, 302],
      },
    },
  ];

  for (const m of monitors) {
    const existing = await prisma.monitor.findFirst({
      where: { userId: user.id, name: m.key },
    });
    const monitor = existing
      ? existing
      : await prisma.monitor.create({
          data: { userId: user.id, ...m.data, nextCheckAt: new Date() },
        });
    await prisma.alertBinding.upsert({
      where: { monitorId_channelId: { monitorId: monitor.id, channelId: channel.id } },
      update: {},
      create: { monitorId: monitor.id, channelId: channel.id },
    });
  }

  process.stdout.write(`Seeded demo user ${DEMO_EMAIL} / ${DEMO_PASSWORD}\n`);
}

main()
  .catch((err: unknown) => {
    process.stderr.write(`Seed failed: ${String(err)}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
