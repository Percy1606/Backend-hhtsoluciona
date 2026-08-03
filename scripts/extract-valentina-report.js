const fs = require('fs');
const path = require('path');
const url = require('url');
const mariadb = require('mariadb');

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
  const conn = await pool.getConnection();
  try {
    // 1. Cotizaciones enviadas/creadas en Julio por Valentina o sus clientes
    const cotizaciones = await conn.query(`
      SELECT cot.codigo, cot.monto, cot.fecha, cot.estado, cot.moneda, c.empresa, c.ruc, c.tarifa, c.etapaComercial
      FROM cotizacion cot
      JOIN cliente c ON cot.clientId = c.id
      WHERE (c.asignadoA = 'Valentina' OR c.creadoPor = 'Valentina') 
        AND cot.fecha BETWEEN '2026-07-01' AND '2026-07-31 23:59:59'
      ORDER BY cot.fecha ASC
    `);

    // 2. Interacciones de Valentina en Julio
    const interacciones = await conn.query(`
      SELECT i.id, i.fecha, i.tipo, i.usuario, i.observaciones, c.id as clienteId, c.empresa, c.ruc, c.asignadoA, c.creadoPor, c.fechaCreacion, c.tarifa, c.etapaComercial
      FROM interaccion i
      JOIN cliente c ON i.clientId = c.id
      WHERE i.usuario = 'Valentina' AND i.fecha BETWEEN '2026-07-01' AND '2026-07-31 23:59:59'
      ORDER BY i.fecha ASC
    `);

    // 3. Clientes involucrados con su historial completo
    const clientIds = Array.from(new Set(interacciones.map(i => i.clienteId)));
    const clientesHistorial = [];

    for (const cId of clientIds) {
      const cliente = (await conn.query(`SELECT id, empresa, ruc, asignadoA, creadoPor, fechaCreacion, tarifa, etapaComercial FROM cliente WHERE id = ?`, [cId]))[0];
      const allInts = await conn.query(`SELECT fecha, tipo, usuario, observaciones FROM interaccion WHERE clientId = ? ORDER BY fecha ASC`, [cId]);
      const allCots = await conn.query(`SELECT codigo, monto, fecha, estado FROM cotizacion WHERE clientId = ? ORDER BY fecha ASC`, [cId]);

      clientesHistorial.push({
        cliente,
        allInts,
        allCots
      });
    }

    const reportData = {
      cotizaciones,
      interacciones,
      clientesHistorial
    };

    fs.writeFileSync(path.resolve(__dirname, 'valentina_july_dump.json'), JSON.stringify(reportData, null, 2));
    console.log(`DUMP COMPLETO GUARDADO. Cotizaciones: ${cotizaciones.length}, Interacciones: ${interacciones.length}, Clientes: ${clientesHistorial.length}`);

  } finally {
    conn.end();
    pool.end();
  }
}

main().catch(console.error);
