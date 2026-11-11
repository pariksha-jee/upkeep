import type { PaginationMeta } from '@upkeep/core';

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export function paginate<T>(items: T[], page: number, limit: number, total: number): Paginated<T> {
  return { data: items, meta: { page, limit, total } };
}
