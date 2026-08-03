const fs = require('fs');
const path = require('path');
const url = require('url');
const mariadb = require('mariadb');

const envPaths = [
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '.env.local')
];

envPaths.forEach(envPath => {
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    });
  }
});

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is not defined');
  process.exit(1);
}

const parsed = new url.URL(dbUrl);
const pool = mariadb.createPool({
  host: parsed.hostname,
  port: parseInt(parsed.port || '3306', 10),
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  database: decodeURIComponent(parsed.pathname.substring(1)),
  connectionLimit: 1
});

async function main() {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log('Connected to MariaDB.');

    const addCol = async (sql) => {
      try {
        await conn.query(sql);
        console.log('Success:', sql);
      } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME' || (e.message && e.message.includes('Duplicate column')) || (e.message && e.message.includes('already exists'))) {
          console.log('Column already exists, skipping.');
        } else {
          console.error('Error adding column:', e.message);
        }
      }
    };

    await addCol("ALTER TABLE ficha_tecnica ADD COLUMN costoMovilidad DECIMAL(18, 2) DEFAULT 0.00");
    await addCol("ALTER TABLE ficha_tecnica ADD COLUMN costoViaticos DECIMAL(18, 2) DEFAULT 0.00");
    await addCol("ALTER TABLE ficha_tecnica ADD COLUMN costoOtros DECIMAL(18, 2) DEFAULT 0.00");
    await addCol("ALTER TABLE ficha_tecnica ADD COLUMN costoTotal DECIMAL(18, 2) DEFAULT 0.00");
    await addCol("ALTER TABLE ficha_tecnica ADD COLUMN observacionesCostos TEXT NULL");
    await addCol("ALTER TABLE ficha_tecnica ADD COLUMN gastosImputados TINYINT(1) NOT NULL DEFAULT 0");

    console.log('Alter table completed successfully.');
  } finally {
    if (conn) conn.end();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
