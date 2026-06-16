import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { registry } from '../../shared/registry';
import { authMiddleware, type Env } from '../../shared/auth';
import { errorToHttpStatus } from '../../shared/errors';
import { createDb } from '../../db/client';

export function createRestApp() {
  const app = new Hono<Env>();

  // Global middleware
  app.use('*', logger());
  app.use(
    '*',
    cors({
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
    })
  );

  // Health check (no auth)
  app.get('/health', (c) =>
    c.json({ status: 'ok', timestamp: new Date().toISOString() })
  );

  // Auth-protected API routes
  const api = new Hono<Env>();
  api.use('*', authMiddleware);

  // Register all operations from registry
  for (const op of registry.getAll()) {
    const method = op.rest.method.toLowerCase() as
      | 'get'
      | 'post'
      | 'put'
      | 'patch'
      | 'delete';

    const handler = async (c: any) => {
      const db = createDb(c.env.DATABASE_URL);
      const user = c.get('user');

      let input: Record<string, unknown>;
      if (method === 'get' || method === 'delete') {
        input = { ...c.req.param(), ...c.req.query() };
      } else {
        const body = await c.req.json().catch(() => ({}));
        input = { ...body, ...c.req.param() };
      }

      // Validate
      const parsed = op.inputSchema.safeParse(input);
      if (!parsed.success) {
        return c.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: parsed.error.issues
                .map((i: any) => i.message)
                .join(', '),
            },
          },
          400
        );
      }

      const result = await op.execute(parsed.data, {
        userId: user.id,
        db,
        llm: {
          baseUrl: c.env.LLM_BASE_URL,
          apiKey: c.env.LLM_API_KEY,
          model: c.env.LLM_MODEL,
        },
      });

      if (result.success) {
        return c.json({ data: result.data });
      }

      return c.json(
        { error: result.error },
        errorToHttpStatus(result.error.code)
      );
    };

    api[method](op.rest.path, handler);
  }

  app.route('/api', api);

  return app;
}
