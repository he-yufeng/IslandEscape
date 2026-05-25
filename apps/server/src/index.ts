import { createApp } from './app'
import { env } from './env'

const host = env.HOST
const port = env.PORT

const app = await createApp()

app.listen({ host, port }).then(() => {
  app.log.info(`server ready on http://${host}:${port}`)
})
