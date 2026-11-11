import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from '../compat/express.js';
import { map, type Observable } from 'rxjs';

interface PaginationMetaLike {
  page: number;
  limit: number;
  total: number;
}

/**
 * Wraps every response in the standard envelope (guardrails §6.3):
 *   { success: true, data, meta? }
 * Handlers can set req.rawResponse = true to bypass (used for /openapi.json).
 */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const res = http.getResponse<Response>();
    if (res.statusCode === 204) {
      return next.handle();
    }
    const req = http.getRequest<Request>();
    if (req.rawResponse === true) {
      return next.handle();
    }
    return next.handle().pipe(
      map((data) => {
        if (data !== null && typeof data === 'object' && 'meta' in data && 'data' in data) {
          const payload = data as { data: unknown; meta?: PaginationMetaLike };
          return {
            success: true,
            data: payload.data,
            ...(payload.meta !== undefined ? { meta: payload.meta } : {}),
          };
        }
        return { success: true, data };
      }),
    );
  }
}
