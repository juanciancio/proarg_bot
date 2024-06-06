import dotenv from "dotenv";
import pkg from "pg";
const { Pool } = pkg;
dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: 5432,
  idleTimeoutMillis: 30000, // Tiempo de espera para conexiones inactivas
  connectionTimeoutMillis: 2000, // Tiempo de espera para obtener una nueva conexión
});

export default pool;
