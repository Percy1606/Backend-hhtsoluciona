const fs = require('fs');
const path = require('path');
const url = require('url');
const mariadb = require('mariadb');

// Load environment variables from both .env and .env.local files
const envPaths = [
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '.env.local')
];

envPaths.forEach(envPath => {
  if (fs.existsSync(envPath)) {
    console.log(`Loading env variables from: ${path.basename(envPath)}`);
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        // remove quotes
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
  console.error('DATABASE_URL is not defined in .env or .env.local');
  process.exit(1);
}

console.log('Parsed DB URL:', dbUrl.replace(/:[^:@/]+@/, ':***@')); // Hide password

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
    console.log('Connected to database.');

    // 1. Add area column
    try {
      console.log('Adding area column...');
      await conn.query("ALTER TABLE documento ADD COLUMN area ENUM('LogisticaYRecursos', 'IngenieriaYSupervision', 'GestionDocumentaria', 'OperacionesDeCampo') NULL");
      console.log('Column added successfully.');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME' || (e.message && e.message.includes('Duplicate column')) || (e.message && e.message.includes('already exists'))) {
        console.log('Column already exists.');
      } else {
        throw e;
      }
    }

    // 2. Add index
    try {
      console.log('Adding index...');
      await conn.query("CREATE INDEX documento_area_idx ON documento(area)");
      console.log('Index created successfully.');
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME' || (e.message && e.message.includes('Duplicate key name')) || (e.message && e.message.includes('already exists'))) {
        console.log('Index already exists.');
      } else {
        throw e;
      }
    }

  } finally {
    if (conn) conn.end();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
