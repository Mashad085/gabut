import pg from 'pg';

const { Pool } = pg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

db.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

// Query helper with automatic client release
export const query = async (text, params) => {
  const start = Date.now();
  const res = await db.query(text, params);
  const duration = Date.now() - start;
  
  if (process.env.NODE_ENV === 'development' && duration > 100) {
    console.log('Slow query:', { text, duration, rows: res.rowCount });
  }
  
  return res;
};

// Transaction helper
export const withTransaction = async (callback) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
