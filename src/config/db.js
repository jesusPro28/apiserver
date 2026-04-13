import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4'
});

const originalGetConnection = pool.getConnection.bind(pool);
pool.getConnection = async () => {
  const conn = await originalGetConnection();
  await conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
  return conn;
};

export default pool;
