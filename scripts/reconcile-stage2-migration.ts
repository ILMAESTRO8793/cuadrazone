import mysql from "mysql2/promise";
import { readMigrationFiles } from "drizzle-orm/migrator";
// Recuperación puntual de la migración 0001 interrumpida por un nombre FK demasiado largo.
// Solo admite CREATE TABLE, ADD CONSTRAINT, ADD COLUMN e INSERT IGNORE conocidos.
// No elimina, trunca, reinicializa ni reemplaza ninguna tabla o fila.
const c = await mysql.createConnection(process.env.DATABASE_URL!);

async function verifyForeignKey(table: string, name: string, sql: string) {
  const foreignKey = sql.match(
    /FOREIGN KEY \(([^)]+)\) REFERENCES `([^`]+)`\(`([^`]+)`\)/
  );
  if (!foreignKey) throw new Error(`Clave foránea no verificable: ${name}`);
  const expectedColumns = foreignKey[1]
    .split(",")
    .map(column => column.trim().replace(/^`|`$/g, ""));
  const [rows] = await c.query<mysql.RowDataPacket[]>(
    `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME, ORDINAL_POSITION
       FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_NAME=?
      ORDER BY ORDINAL_POSITION`,
    [table, name]
  );
  if (!rows.length) return false;
  const actualColumns = rows.map(row => row.COLUMN_NAME);
  if (
    actualColumns.length !== expectedColumns.length ||
    actualColumns.some((column, index) => column !== expectedColumns[index]) ||
    rows.some(
      row =>
        row.REFERENCED_TABLE_NAME !== foreignKey[2] ||
        row.REFERENCED_COLUMN_NAME !== foreignKey[3]
    )
  )
    throw new Error(`Clave foránea existente incompatible: ${name}`);
  return true;
}

try {
  const [history] = await c.query<mysql.RowDataPacket[]>(
    "SELECT hash, created_at FROM __drizzle_migrations"
  );
  for (const migration of readMigrationFiles({ migrationsFolder: "drizzle" })) {
    const recorded = history.find(
      row => Number(row.created_at) === migration.folderMillis
    );
    if (recorded) {
      if (recorded.hash !== migration.hash)
        throw new Error(
          "El hash de una migración ya registrada cambió; se requiere revisión manual"
        );
      continue;
    }
    for (const statement of migration.sql) {
      const sql = statement.trim();
      if (!sql) continue;
      let match = sql.match(/^CREATE TABLE `([^`]+)`/);
      if (match) {
        const table = match[1];
        const [existing] = await c.query<mysql.RowDataPacket[]>(
          "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
          [table]
        );
        if (existing.length) {
          const [columns] = await c.query<mysql.RowDataPacket[]>(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
            [table]
          );
          const required = [...sql.matchAll(/^\s*`([^`]+)`\s/gm)].map(
            m => m[1]
          );
          if (
            required.some(
              name => !columns.some(col => col.COLUMN_NAME === name)
            )
          )
            throw new Error(`Tabla parcial incompatible: ${table}`);
          console.log(`Conservar tabla existente ${table}`);
          continue;
        }
      } else if (
        (match = sql.match(/^ALTER TABLE `([^`]+)` ADD CONSTRAINT `([^`]+)`/))
      ) {
        if (await verifyForeignKey(match[1], match[2], sql)) {
          console.log(`Conservar clave ${match[2]}`);
          continue;
        }
      } else if ((match = sql.match(/^ALTER TABLE `([^`]+)` ADD `([^`]+)`/))) {
        const [exists] = await c.query<mysql.RowDataPacket[]>(
          "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?",
          [match[1], match[2]]
        );
        if (exists.length) {
          console.log(`Conservar columna ${match[2]}`);
          continue;
        }
      } else if (!/^INSERT IGNORE INTO `cz_denominations`/.test(sql)) {
        throw new Error("SQL fuera del alcance aditivo de esta recuperación");
      }
      await c.query(sql);
      console.log("Sentencia aditiva aplicada");
    }
    await c.query(
      "INSERT INTO __drizzle_migrations (hash,created_at) VALUES (?,?)",
      [migration.hash, migration.folderMillis]
    );
    console.log("Migración íntegra registrada", migration.folderMillis);
  }
} finally {
  await c.end();
}
