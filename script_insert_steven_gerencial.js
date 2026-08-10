const mysql = require('mysql2/promise');

async function insertTareaStevenGerencial() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'hh_user',
    password: 'HHT2026Segura',
    database: 'software_hh_db'
  });

  const fechaManana = '11/08/2026';

  const tareaSteven = {
    id: 'task-steven-gerencial-main',
    empresa: 'STEVEN — Cotizaciones, metrados y cartera asignada',
    actividadInmediata: 'Cotizaciones Frío Frías, Metrados Alex Sechura e Informe de Cartera Asignada',
    responsable: 'Steven',
    fechaCompromiso: fechaManana,
    estado: 'PENDIENTE',
    subtareas: [
      {
        id: 'sub-steven-1',
        texto: '1. Terminar cotización de Frío Frías (instalación de analizador de redes, punto caliente y mantenimiento de subestación)',
        responsable: 'Steven',
        fecha: fechaManana,
        completada: false,
        prioridad: 'ALTA'
      },
      {
        id: 'sub-steven-2',
        texto: '2. Trabajar con Mario en los metrados de cada proyecto de Alex en Sechura (separados y claramente identificados)',
        responsable: 'Steven',
        fecha: fechaManana,
        completada: false,
        prioridad: 'ALTA'
      },
      {
        id: 'sub-steven-3',
        texto: '3. Presentar informe del estado actual de todos los clientes asignados y del seguimiento realizado a cada uno',
        responsable: 'Steven',
        fecha: fechaManana,
        completada: false,
        prioridad: 'ALTA'
      }
    ]
  };

  try {
    await connection.execute(
      `INSERT INTO tarea_estrategica (id, empresa, etapaProceso, actividadInmediata, proximoPaso, responsable, fechaCompromiso, estado, subtareas, createdAt, updatedAt) 
       VALUES (?, ?, 'GERENCIAL', ?, 'Coordinación comercial', ?, ?, ?, ?, NOW(), NOW()) 
       ON DUPLICATE KEY UPDATE 
         empresa=VALUES(empresa), 
         actividadInmediata=VALUES(actividadInmediata),
         responsable=VALUES(responsable),
         fechaCompromiso=VALUES(fechaCompromiso),
         estado=VALUES(estado),
         subtareas=VALUES(subtareas)`,
      [
        tareaSteven.id,
        tareaSteven.empresa,
        tareaSteven.actividadInmediata,
        tareaSteven.responsable,
        tareaSteven.fechaCompromiso,
        tareaSteven.estado,
        JSON.stringify(tareaSteven.subtareas)
      ]
    );
    console.log('✅ Tarea Gerencial de Steven con sus 3 actividades agregada exitosamente!');
  } catch (err) {
    console.error('Error insertando tarea gerencial de Steven:', err);
  } finally {
    await connection.end();
  }
}

insertTareaStevenGerencial();
