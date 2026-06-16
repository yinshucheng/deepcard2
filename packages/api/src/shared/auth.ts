import { MiddlewareHandler } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { createDb } from '../db/client';
import { profiles } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface AuthUser {
  id: string;
  email: string;
}

export interface Env {
  Bindings: {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    DATABASE_URL: string;
    DEV_MODE?: string;
    DEV_USER_EMAIL?: string;
    // LLM（系统默认 provider，OpenAI 兼容）
    LLM_BASE_URL?: string;
    LLM_API_KEY?: string;
    LLM_MODEL?: string;
  };
  Variables: {
    user: AuthUser;
  };
}

// 用 email 生成一个确定性的 UUID v5 风格 ID（简化版：SHA-256 截取）
async function emailToUuid(email: string): Promise<string> {
  const data = new TextEncoder().encode(`deepcard:${email}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  // 格式化为 UUID: 8-4-4-4-12
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    '4' + hex.slice(13, 16), // version 4
    ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20), // variant
    hex.slice(20, 32),
  ].join('-');
}

// Dev mode: 自动创建 profile（如果不存在）
async function ensureDevProfile(
  databaseUrl: string,
  userId: string,
  email: string
): Promise<void> {
  const db = createDb(databaseUrl);
  const [existing] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId));
  if (!existing) {
    await db.insert(profiles).values({ id: userId, email });
  }
}

export const authMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  // Dev mode: X-Dev-User-Email header
  if (c.env.DEV_MODE === 'true') {
    const devEmail =
      c.req.header('X-Dev-User-Email') ?? c.env.DEV_USER_EMAIL;
    if (devEmail) {
      const userId = await emailToUuid(devEmail);
      await ensureDevProfile(c.env.DATABASE_URL, userId, devEmail);
      c.set('user', { id: userId, email: devEmail });
      return next();
    }
  }

  // API Key: Bearer dc_xxxxx
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer dc_')) {
    // TODO: look up API key in db, verify hash
    return c.json({ error: 'API key auth not yet implemented' }, 501);
  }

  // Supabase JWT
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return c.json({ error: '认证失败' }, 401);
    }

    c.set('user', { id: user.id, email: user.email! });
    return next();
  }

  return c.json({ error: '未提供认证信息' }, 401);
};
