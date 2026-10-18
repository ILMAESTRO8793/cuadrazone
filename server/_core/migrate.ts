import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import path from "node:path";

/**
 * Aplica las migraciones pendientes de ./drizzle al arrancar en producción.
 * Son aditivas y registradas en __drizzle_migrations, así que repetirlas es seguro.
 */
export async function runMigrations() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL es obligatorio en producción");
  const connection = await mysql.createConnection({ uri: url, multipleStatements: true });
  try {
    await migrate(drizzle(connection), { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
    console.log("[Database] Migraciones al día");
  } finally {
    await connection.end();
  }
}
