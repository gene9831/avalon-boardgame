type HealthRouteContext = {
  body?: unknown
  status: number
}

type HealthStorage = {
  checkHealth?: () => Promise<void> | void
}

type HealthRouter = {
  get: (
    path: string,
    handler: (ctx: HealthRouteContext) => Promise<void>,
  ) => unknown
}

export function installHealthRoute(
  routerValue: unknown,
  storageValue: object,
) {
  const router = routerValue as HealthRouter
  const storage = storageValue as HealthStorage
  router.get('/healthz', async (ctx) => {
    try {
      await storage.checkHealth?.()
      ctx.status = 200
      ctx.body = { status: 'ok' }
    } catch {
      ctx.status = 503
      ctx.body = { status: 'unavailable' }
    }
  })
}
