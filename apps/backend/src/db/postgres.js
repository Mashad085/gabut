import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Ensure .env is loaded regardless of cwd
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const { Pool } = pg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

db.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

// Verify connectivity
export async function testConnection() {
  const client = await db.connect();
  await client.query('SELECT 1');
  client.release();
}

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

export default db;
