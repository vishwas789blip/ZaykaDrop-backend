import { Pool, PoolClient, PoolConfig } from "pg";

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

export const withTransaction = async <T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const cleanupExpiredOrders = async (): Promise<void> => {
  try {
    await getPool().query(
      `DELETE FROM orders
       WHERE expired_at IS NOT NULL
         AND expired_at <= NOW()
         AND payment_status <> 'paid'`
    );
  } catch (error) {
    console.error("Failed to cleanup expired orders:", error);
  }
};

const connectDB = async (): Promise<void> => {
  const pool = getPool();
  await pool.query("SELECT 1");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      image TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      is_verified BOOLEAN NOT NULL DEFAULT FALSE,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      formatted_address TEXT NOT NULL,
      is_open BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON restaurants (owner_id);
    CREATE INDEX IF NOT EXISTS idx_restaurants_verified_open ON restaurants (is_verified, is_open);
    CREATE INDEX IF NOT EXISTS idx_restaurants_lat_lng ON restaurants (latitude, longitude);

    CREATE TABLE IF NOT EXISTS menu_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      image TEXT NOT NULL DEFAULT '',
      price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items (restaurant_id);

    CREATE TABLE IF NOT EXISTS addresses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      phone BIGINT NOT NULL,
      formatted_address TEXT NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      pincode TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses (user_id);

    CREATE TABLE IF NOT EXISTS carts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, restaurant_id, item_id)
    );

    CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts (user_id);

    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
      restaurant_name TEXT NOT NULL,
      rider_id TEXT DEFAULT NULL,
      rider_phone TEXT DEFAULT NULL,
      rider_name TEXT DEFAULT NULL,
      rider_latitude DOUBLE PRECISION DEFAULT NULL,
      rider_longitude DOUBLE PRECISION DEFAULT NULL,
      distance DOUBLE PRECISION NOT NULL,
      rider_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
      subtotal NUMERIC(10, 2) NOT NULL,
      delivery_fee NUMERIC(10, 2) NOT NULL,
      platform_fee NUMERIC(10, 2) NOT NULL,
      total_amount NUMERIC(10, 2) NOT NULL,
      address_id TEXT NOT NULL,
      delivery_formatted_address TEXT NOT NULL,
      delivery_mobile BIGINT NOT NULL,
      delivery_latitude DOUBLE PRECISION NOT NULL,
      delivery_longitude DOUBLE PRECISION NOT NULL,
      pickup_formatted_address TEXT,
      pickup_latitude DOUBLE PRECISION,
      pickup_longitude DOUBLE PRECISION,
      status TEXT NOT NULL DEFAULT 'placed' CHECK (
        status IN (
          'placed',
          'accepted',
          'preparing',
          'ready_for_rider',
          'rider_assigned',
          'picked_up',
          'delivered',
          'cancelled'
        )
      ),
      payment_method TEXT NOT NULL CHECK (payment_method IN ('COD', 'Razorpay', 'Stripe')),
      payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
      expired_at TIMESTAMPTZ DEFAULT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders (restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON orders (rider_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

    CREATE TABLE IF NOT EXISTS order_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price NUMERIC(10, 2) NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity >= 1)
    );

    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
  `);

  // Periodic cleanup for expired unpaid orders (replaces MongoDB TTL index)
  await cleanupExpiredOrders();
  const timer = setInterval(cleanupExpiredOrders, 5 * 60 * 1000);
  timer.unref();

  console.log("Connected to PostgreSQL (Restaurant service)");
};

export default connectDB;
