declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: 'USER' | 'ADMIN' };
      requestId?: string;
      /** When true, the envelope interceptor passes the response through raw. */
      rawResponse?: boolean;
    }
  }
}

export {};
