import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import { timingSafeEqual } from 'node:crypto';
import { isDashboardAuthEnabled, loadConfig } from '@bot-trading/core';

export const SESSION_COOKIE = 'pm_session';

const PUBLIC_PREFIXES = ['/api/auth/login', '/api/auth/logout', '/api/health'];

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function registerAuth(app: FastifyInstance) {
  const cfg = loadConfig();

  if (!isDashboardAuthEnabled()) {
    app.log.warn('Dashboard auth desactivada (DASHBOARD_AUTH_ENABLED=false) — solo para dev local');

    app.get('/api/auth/me', async () => ({
      authenticated: true,
      username: 'local',
      authDisabled: true,
    }));
    app.post('/api/auth/login', async () => ({ ok: true, authDisabled: true }));
    app.post('/api/auth/logout', async () => ({ ok: true }));
    return;
  }

  app.log.info('Dashboard auth activa');

  await app.register(fastifyCookie);
  await app.register(fastifyJwt, {
    secret: cfg.DASHBOARD_SESSION_SECRET!,
    cookie: {
      cookieName: SESSION_COOKIE,
      signed: false,
    },
  });

  app.post<{ Body: { username?: string; password?: string } }>(
    '/api/auth/login',
    async (req, reply) => {
      const { username = '', password = '' } = req.body ?? {};
      const expectedUser = cfg.DASHBOARD_USERNAME;
      const expectedPass = cfg.DASHBOARD_PASSWORD!;

      if (!safeEqual(username, expectedUser) || !safeEqual(password, expectedPass)) {
        app.log.warn({ username }, 'Login fallido — credenciales incorrectas');
        return reply.code(401).send({ error: 'Credenciales inválidas' });
      }

      const token = await reply.jwtSign(
        { sub: username, role: 'admin' },
        { expiresIn: '7d' },
      );

      reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: cfg.DASHBOARD_COOKIE_SECURE,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });

      app.log.info({ username }, 'Login correcto');
      return { ok: true, username };
    },
  );

  app.post('/api/auth/logout', async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', async (req, reply) => {
    try {
      await req.jwtVerify();
      const user = req.user as { sub?: string };
      return { authenticated: true, username: user.sub ?? cfg.DASHBOARD_USERNAME };
    } catch {
      return reply.code(401).send({ authenticated: false });
    }
  });

  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const path = req.url.split('?')[0];
    if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))) {
      return;
    }
    if (!path.startsWith('/api')) {
      return;
    }

    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'No autenticado' });
    }
  });
}

export async function verifyRequest(req: FastifyRequest) {
  if (!isDashboardAuthEnabled()) return true;
  try {
    await req.jwtVerify();
    return true;
  } catch {
    return false;
  }
}

export function isAuthEnabled() {
  return isDashboardAuthEnabled();
}
