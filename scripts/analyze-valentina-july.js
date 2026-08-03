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
    console.log('=== ANÁLISIS DE REGISTROS Y SEGUIMIENTOS DE VALENTINA (JULIO 2026) ===\n');

    // 1. Interacciones de Valentina en Julio
    const ints = await conn.query(`
      SELECT i.id, i.fecha, i.tipo, i.usuario, i.observaciones, c.id as clienteId, c.empresa, c.asignadoA, c.creadoPor, c.fechaCreacion
      FROM interaccion i
      JOIN cliente c ON i.clientId = c.id
      WHERE i.usuario = 'Valentina' AND i.fecha BETWEEN '2026-07-01' AND '2026-07-31 23:59:59'
      ORDER BY i.fecha ASC
    `);

    console.log(`1. Interacciones/Seguimientos realizados por Valentina en Julio: ${ints.length}`);

    let countImages = 0;
    ints.forEach(int => {
      if (int.observaciones && int.observaciones.includes('[IMG]')) {
        countImages++;
      }
    });
    console.log(`   - Interacciones que incluyen imágenes [IMG]: ${countImages}`);

    // 2. Cotizaciones de Valentina o sus clientes en Julio
    const cots = await conn.query(`
      SELECT cot.id, cot.codigo, cot.total, cot.fechaEmision, cot.estado, c.id as clienteId, c.empresa, c.asignadoA
      FROM cotizacion cot
      JOIN cliente c ON cot.clienteId = c.id
      WHERE (c.asignadoA = 'Valentina' OR c.creadoPor = 'Valentina') 
        AND cot.fechaEmision BETWEEN '2026-07-01' AND '2026-07-31 23:59:59'
      ORDER BY cot.fechaEmision ASC
    `);

    console.log(`\n2. Cotizaciones asociadas enviadas/creadas en Julio: ${cots.length}`);
    cots.forEach(c => {
      console.log(`   - [${c.codigo}] ${c.empresa} | Monto: S/ ${c.montoTotal} | Fecha: ${c.fechaEmision} | Estado: ${c.estado}`);
    });

    // 3. Clientes únicos involucrados
    const clienteIds = new Set();
    ints.forEach(i => clienteIds.add(i.clienteId));
    cots.forEach(c => clienteIds.add(c.clienteId));

    console.log(`\n3. Clientes únicos en el período: ${clienteIds.size}`);

    console.log('\n--- MUESTRA DE LÍNEA DE TIEMPO COMPLETA DE CLIENTES (DESDE QUE SE PROSPECTARON) ---');
    for (const cId of Array.from(clienteIds).slice(0, 5)) {
      const c = (await conn.query(`SELECT id, empresa, asignadoA, creadoPor, fechaCreacion, tarifa, etapaComercial FROM cliente WHERE id = ?`, [cId]))[0];
      const allInts = await conn.query(`SELECT fecha, tipo, usuario, observaciones FROM interaccion WHERE clientId = ? ORDER BY fecha ASC`, [cId]);
      const allCots = await conn.query(`SELECT codigo, total, fechaEmision, estado FROM cotizacion WHERE clienteId = ? ORDER BY fechaEmision ASC`, [cId]);

      console.log(`\n🏢 Cliente: ${c.empresa}`);
      console.log(`   Prospectado el: ${c.fechaCreacion} | Creado por: ${c.creadoPor} | Asignado a: ${c.asignadoA} | Tarifa: ${c.tarifa} | Etapa Actual: ${c.etapaComercial}`);
      console.log(`   Cotizaciones (${allCots.length}):`, allCots.map(ct => `${ct.codigo} (S/ ${ct.total})`).join(', '));
      console.log(`   Historial de Interacciones (${allInts.length}):`);
      allInts.forEach(i => {
        const hasImg = i.observaciones && i.observaciones.includes('[IMG]') ? ' 📷 [CON IMAGEN]' : '';
        const previewObs = (i.observaciones || '').replace(/\n/g, ' ').substring(0, 80);
        console.log(`     - [${i.fecha}] (${i.usuario}) ${i.tipo}: ${previewObs}...${hasImg}`);
      });
    }

  } finally {
    conn.end();
    pool.end();
  }
}

main().catch(console.error);
