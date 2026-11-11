export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly details: Array<{ path: string; message: string }> | null;

  constructor(
    status: number,
    code: string,
    message: string,
    requestId: string | null = null,
    details: Array<{ path: string; message: string }> | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
