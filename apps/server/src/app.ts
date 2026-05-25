import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import Fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import fastifyStatic from '@fastify/static'

import { ensureSchema } from './db/client'
import { env } from './env'
import gameRoutes from './routes/game'

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
  await app.register(gameRoutes)

  const webDistPath = fileURLToPath(new URL('../../../web/dist', import.meta.url))
  if (existsSync(join(webDistPath, 'index.html'))) {
    await app.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
    })

    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url?.startsWith('/api/')) {
        return reply.code(404).send({ error: 'Not Found' })
      }
      return reply.sendFile('index.html')
    })
  }

  return app
}
