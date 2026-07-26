import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';

function buildTestApp() {
  const app = express();
  const limiter = rateLimit({ windowMs: 60000, max: 2, standardHeaders: true, legacyHeaders: false });
  app.get('/limited', limiter, (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe('rate limiting', () => {
  it('allows requests under the limit and blocks over it', async () => {
    const app = buildTestApp();
    const first = await request(app).get('/limited');
    const second = await request(app).get('/limited');
    const third = await request(app).get('/limited');
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
  });
});
