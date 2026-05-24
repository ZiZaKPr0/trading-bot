import type { FastifyInstance } from 'fastify';
import {
  getSettingsView,
  reloadConfig,
  updateEnvSettings,
} from '@bot-trading/core';

export async function registerSettingsRoutes(app: FastifyInstance) {
  app.get('/api/settings', async () => {
    return getSettingsView();
  });

  app.put<{ Body: Record<string, string> }>('/api/settings', async (req, reply) => {
    const body = req.body ?? {};
    if (typeof body !== 'object' || Array.isArray(body)) {
      return reply.code(400).send({ error: 'Body inválido' });
    }

    try {
      const result = updateEnvSettings(body);
      reloadConfig();
      app.log.info('Configuración actualizada desde dashboard');
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error guardando configuración';
      app.log.warn({ err }, 'Error actualizando settings');
      return reply.code(400).send({ error: message });
    }
  });
}
