export {};

declare global {
  namespace Express {
    interface Request {
      valid?: { body?: unknown; query?: unknown; params?: unknown };
      user?: { id: string; name: string; email: string };
    }
  }
}
