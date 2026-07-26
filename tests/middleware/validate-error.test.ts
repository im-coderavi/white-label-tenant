import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validateBody } from '../../src/middleware/validate.middleware';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { NotFoundError } from '../../src/common/errors';

function buildTestApp() {
  const app = express();
  app.use(express.json());

  const schema = z.object({ name: z.string().min(1) });
  app.post('/echo', validateBody(schema), (req, res) => {
    res.status(200).json({ received: req.body });
  });

  app.get('/boom', (_req, _res, next) => {
    next(new NotFoundError('Widget not found'));
  });

  app.use(errorMiddleware);
  return app;
}

describe('validateBody + errorMiddleware', () => {
  const app = buildTestApp();

  it('passes through valid input', async () => {
    const res = await request(app).post('/echo').send({ name: 'ok' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: { name: 'ok' } });
  });

  it('rejects invalid input with 400', async () => {
    const res = await request(app).post('/echo').send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('maps AppError subclasses to their status code', async () => {
    const res = await request(app).get('/boom');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Widget not found');
  });
});
