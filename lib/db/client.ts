import { Pool, type PoolClient } from "pg";

declare global {
  var __meetBabyPgPool: Pool | undefined;
}

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL 尚未設定。");
  }
  return databaseUrl;
}

function shouldUseSsl(databaseUrl: string): boolean {
  const sslMode = process.env.PGSSLMODE?.trim().toLowerCase();
  if (sslMode === "disable") return false;
  if (sslMode === "require") return true;
  return databaseUrl.includes("supabase.co");
}

export function getDbPool(): Pool {
  if (globalThis.__meetBabyPgPool) {
    return globalThis.__meetBabyPgPool;
  }

  const databaseUrl = getDatabaseUrl();
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

  globalThis.__meetBabyPgPool = pool;
  return pool;
}

export async function withDb<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getDbPool().connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}
