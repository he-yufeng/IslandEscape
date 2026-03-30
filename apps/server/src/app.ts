import Fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'

import { ensureSchema } from './db/client'
import { env } from './env'
import runsRoutes from './routes/runs'
import savesRoutes from './routes/saves'

export async function createApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        process.env.NODE_ENV === 'production'
          ? undefined
          : {
              target: 'pino-pretty',
              options: {
                colorize: true,
              },
            },
    },
  })

  await app.register(cors, { origin: true })
  await app.register(sensible)
  await ensureSchema()

  app.get('/healthz', async () => ({ ok: true }))
  await app.register(runsRoutes)
  await app.register(savesRoutes)

  return app
}
