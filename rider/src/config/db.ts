import { Pool, PoolConfig } from "pg";

const getConnectionString = (): string | undefined =>
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URI ||
  process.env.POSTGRES_URL;

const isLocalHost = (host?: string): boolean => {
  if (!host) return true;
  const normalized = host.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
};

const resolveSslConfig = (
  connectionString?: string,
  host?: string
): PoolConfig["ssl"] => {
  const sslEnv = process.env.DATABASE_SSL?.toLowerCase();
  const pgSslMode = process.env.PGSSLMODE?.toLowerCase();

  if (sslEnv === "false" || pgSslMode === "disable") {
    return false;
  }

  const rejectUnauthorized =
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true";

  if (sslEnv === "true" || (pgSslMode && pgSslMode !== "disable")) {
    return { rejectUnauthorized };
  }

  if (connectionString) {
    try {
      const parsed = new URL(connectionString);
      const urlSslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
      if (urlSslMode === "disable") return false;
      if (urlSslMode) return { rejectUnauthorized };
      if (!isLocalHost(parsed.hostname)) return { rejectUnauthorized };
      return false;
    } catch {
      return false;
    }
  }

  return isLocalHost(host) ? false : { rejectUnauthorized };
};

const buildPoolConfig = (): PoolConfig => {
  const connectionString = getConnectionString();

  if (connectionString) {
    return {
      connectionString,
      ssl: resolveSslConfig(connectionString),
    };
  }

  const host = process.env.PGHOST;
  const user = process.env.PGUSER;
  const database = process.env.PGDATABASE;
  const password = process.env.PGPASSWORD;
  const port = process.env.PGPORT ? Number(process.env.PGPORT) : 5432;

  if (!host || !user || !database) {
    throw new Error(
      "PostgreSQL configuration missing. Set DATABASE_URL (or POSTGRES_URI), or provide PGHOST, PGUSER, PGPASSWORD, and PGDATABASE in .env"
    );
  }

  return {
    host,
    port,
    user,
    database,
    ...(password !== undefined ? { password } : {}),
    ssl: resolveSslConfig(undefined, host),
  };
};

let poolInstance: Pool | null = null;

export const getPool = (): Pool => {
  if (!poolInstance) {
    poolInstance = new Pool(buildPoolConfig());
    poolInstance.on("error", (err) => {
      console.error(
        "Unexpected error on idle PostgreSQL client (will reconnect automatically):",
        err.message || err
      );
    });
  }
  return poolInstance;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidUUID = (value: string): boolean => UUID_REGEX.test(value);

const connectDB = async (): Promise<void> => {
  const pool = getPool();
  await pool.query("SELECT 1");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS riders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL UNIQUE,
      picture TEXT NOT NULL,
      phone_number TEXT NOT NULL UNIQUE CHECK (phone_number ~ '^\\d{10}$'),
      aadhar_number TEXT NOT NULL UNIQUE CHECK (aadhar_number ~ '^\\d{12}$'),
      driving_license_number TEXT NOT NULL UNIQUE,
      vehicle_number TEXT NOT NULL,
      is_verified BOOLEAN NOT NULL DEFAULT TRUE,
      rating_average NUMERIC(3, 2) NOT NULL DEFAULT 5.00 CHECK (rating_average >= 0 AND rating_average <= 5),
      rating_count INTEGER NOT NULL DEFAULT 0,
      latitude DOUBLE PRECISION NOT NULL DEFAULT 0,
      longitude DOUBLE PRECISION NOT NULL DEFAULT 0,
      is_available BOOLEAN NOT NULL DEFAULT FALSE,
      last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_riders_available_verified
      ON riders (is_available, is_verified);
    CREATE INDEX IF NOT EXISTS idx_riders_lat_lng
      ON riders (latitude, longitude);
  `);

  console.log("Connected to PostgreSQL (Rider service)");
};

export default connectDB;
