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
const parsed = new url.URL(dbUrl);
const pool = mariadb.createPool({
  host: parsed.hostname,
  port: parseInt(parsed.port || '3306', 10),
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  database: decodeURIComponent(parsed.pathname.substring(1)),
  connectionLimit: 1
});

async function addColumn(conn, query, successMsg) {
  try {
    await conn.query(query);
    console.log(successMsg);
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME' || (e.message && e.message.includes('Duplicate column')) || (e.message && e.message.includes('already exists'))) {
      console.log('Column already exists, skipping.');
    } else {
      throw e;
    }
  }
}

async function main() {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log('Connected to database.');

    await addColumn(conn, "ALTER TABLE gasto ADD COLUMN tipoComprobante VARCHAR(191) DEFAULT 'FACTURA'", 'Added tipoComprobante');
    await addColumn(conn, "ALTER TABLE gasto ADD COLUMN aplicaImpuestos BOOLEAN DEFAULT false", 'Added aplicaImpuestos');
    await addColumn(conn, "ALTER TABLE gasto ADD COLUMN montoSubtotal DECIMAL(18,2) DEFAULT 0.00", 'Added montoSubtotal');
    await addColumn(conn, "ALTER TABLE gasto ADD COLUMN montoIgv DECIMAL(18,2) DEFAULT 0.00", 'Added montoIgv');

  } finally {
    if (conn) conn.end();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
