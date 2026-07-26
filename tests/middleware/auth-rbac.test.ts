import express from 'express';
import request from 'supertest';
import { requireAuth } from '../../src/middleware/auth.middleware';
import { requireRole } from '../../src/middleware/rbac.middleware';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { signAccessToken } from '../../src/common/jwt';

function buildTestApp() {
  const app = express();
  app.use(express.json());

  app.get('/whoami', requireAuth, (req, res) => {
    res.status(200).json({ user: req.user, tenantId: req.tenantId });
  });

  app.get('/admin-only', requireAuth, requireRole('master_admin'), (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use(errorMiddleware);
  return app;
}

describe('requireAuth + requireRole', () => {
  const app = buildTestApp();

  it('rejects requests with no token', async () => {
    const res = await request(app).get('/whoami');
    expect(res.status).toBe(401);
  });

  it('attaches user and tenantId from a valid token', async () => {
    const token = signAccessToken({ sub: 'user-1', role: 'customer', tenantId: 'tenant-1' });
    const res = await request(app).get('/whoami').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 'user-1', role: 'customer', tenantId: 'tenant-1' });
    expect(res.body.tenantId).toBe('tenant-1');
  });

  it('rejects a role that does not match requireRole', async () => {
    const token = signAccessToken({ sub: 'user-1', role: 'customer', tenantId: 'tenant-1' });
    const res = await request(app).get('/admin-only').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('allows a role that matches requireRole', async () => {
    const token = signAccessToken({ sub: 'admin-1', role: 'master_admin', tenantId: null });
    const res = await request(app).get('/admin-only').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
