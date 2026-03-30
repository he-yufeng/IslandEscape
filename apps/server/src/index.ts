import { createApp } from './app'

const host = '127.0.0.1'
const port = 8787

const app = await createApp()

app.listen({ host, port }).then(() => {
  app.log.info(`server ready on http://${host}:${port}`)
})
