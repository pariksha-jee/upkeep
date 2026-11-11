'use client';

import { UpkeepClient } from '@upkeep/api-client';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';

/** Cookie-session client: refresh + retry handled inside UpkeepClient. */
export const api = new UpkeepClient({
  baseUrl: API_URL,
  useCookies: true,
});
