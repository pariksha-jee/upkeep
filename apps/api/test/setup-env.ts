/** Test-wide environment defaults (satisfies the production boot guard). */
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL ??= 'postgresql://upkeep:upkeep@localhost:5432/upkeep_test';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-at-least-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-at-least-32-characters';
process.env.ENCRYPTION_KEY ??= 's8PL5xMCAxUdOKMhxl0StMlbUH8JiVFzy0fXbqyzUMA='; // base64(32B) test key
process.env.CORS_ORIGIN ??= 'http://localhost:3000';
