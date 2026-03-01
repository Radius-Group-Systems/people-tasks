import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Unscoped queries — for auth tables and migrations
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function getOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] || null;
}

export async function getMany<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await query<T>(text, params);
  return result.rows;
}

// Tenant-scoped database access — sets RLS context per connection
export class TenantDb {
  private client: PoolClient;
  private orgId: string;

  constructor(client: PoolClient, orgId: string) {
    this.client = client;
    this.orgId = orgId;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    return this.client.query<T>(text, params);
  }

  async getOne<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows[0] || null;
  }

  async getMany<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<T[]> {
    const result = await this.query<T>(text, params);
    return result.rows;
  }

  getOrgId(): string {
    return this.orgId;
  }

  async release() {
    // Reset the org context before releasing back to pool
    await this.client.query("RESET ALL");
    this.client.release();
  }
}

export async function tenantDb(orgId: string): Promise<TenantDb> {
  const client = await pool.connect();
  // Set the RLS context for this connection
  await client.query("SELECT set_config('app.current_org_id', $1, false)", [
    orgId,
  ]);
  return new TenantDb(client, orgId);
}

export default pool;
