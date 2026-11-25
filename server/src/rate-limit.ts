import type express from "express";

/**
 * A small fixed-window limiter kept in memory. It is enough for one API process.
 * If you run several processes or put the API behind a proxy, move this to a shared store,
 * and set `app.set("trust proxy", …)` so `req.ip` is the phone's address.
 */
export function rateLimit(options: {
  name: string;
  limit: number;
  windowMs: number;
  key: (req: express.Request) => string | null;
  message?: string;
}): express.RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Forget finished windows so the map does not grow forever.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, options.windowMs);
  sweep.unref();

  return (req, res, next) => {
    const key = options.key(req);
    if (!key) {
      next();
      return;
    }
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + options.windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > options.limit) {
      const seconds = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(seconds));
      const minutes = Math.max(1, Math.ceil(seconds / 60));
      res.status(429).json({
        error: options.message ?? `Too many tries. Wait ${minutes} ${minutes === 1 ? "minute" : "minutes"} and try again.`,
      });
      return;
    }
    next();
  };
}

export function clientIp(req: express.Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}
