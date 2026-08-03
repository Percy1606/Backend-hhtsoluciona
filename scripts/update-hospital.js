const fs = require('fs');
const path = require('path');
const url = require('url');
const mariadb = require('mariadb');

// Load environment variables from .env
const envPath = path.resolve(__dirname, '..', '.env');
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
    console.log('--- Buscando cliente HOSPITAL PRIVADO DEL PERU S.A.C ---');

    const clients = await conn.query("SELECT id, empresa, asignadoA, creadoPor FROM cliente WHERE empresa LIKE '%HOSPITAL%'");
    console.log('Clientes encontrados:', clients);

    if (clients.length === 0) {
      console.log('No se encontró el cliente.');
      return;
    }

    for (const c of clients) {
      console.log(`Actualizando cliente ID ${c.id}...`);
      await conn.query("UPDATE cliente SET asignadoA = 'Valentina', creadoPor = 'Valentina' WHERE id = ?", [c.id]);
      
      const interacciones = await conn.query("SELECT id, fecha, usuario, tipo, observaciones FROM interaccion WHERE clientId = ?", [c.id]);
      console.log(`Interacciones de cliente ${c.id}:`, interacciones);

      const updatedInts = await conn.query("UPDATE interaccion SET usuario = 'Valentina' WHERE clientId = ?", [c.id]);
      console.log(`Interacciones actualizadas: ${updatedInts.affectedRows}`);
    }

    console.log('--- Actualización exitosa ---');
  } finally {
    if (conn) conn.end();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
