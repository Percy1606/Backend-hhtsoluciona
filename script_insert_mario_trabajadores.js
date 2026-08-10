const mysql = require('mysql2/promise');

async function insertTareaMarioTrabajadores() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'hh_user',
    password: 'HHT2026Segura',
    database: 'software_hh_db'
  });

  const fechaManana = '11/08/2026';

  const tareaMario = {
    id: 'task-mario-trabajadores-main',
    empresa: 'MARIO — Presupuestos Base y Operación Norandino',
    actividadInmediata: 'Formato Metrado/Presupuesto e Instalación/Retiro Analizador Norandino',
    responsable: 'Mario',
    fechaCompromiso: fechaManana,
    estado: 'PENDIENTE',
    subtareas: [
      {
        id: 'sub-mario-1',
        texto: '1. Crear FORMATO DE METRADO Y PRESUPUESTO BASE (IPESA Piura → IPESA Chiclayo → Frío Frías → César Pardo)',
        responsable: 'Mario',
        fecha: fechaManana,
        completada: false,
        prioridad: 'ALTA'
      },
      {
        id: 'sub-mario-2',
        texto: '2. Cooperativa Norandino: Instalación analizador, permanencia 2-3 días máx, retiro, info obtenida y envío a Washington para informe',
        responsable: 'Mario',
        fecha: fechaManana,
        completada: false,
        prioridad: 'ALTA'
      }
    ]
  };

  try {
    await connection.execute(
      `INSERT INTO tarea_estrategica (id, empresa, etapaProceso, actividadInmediata, proximoPaso, responsable, fechaCompromiso, estado, subtareas, createdAt, updatedAt) 
       VALUES (?, ?, 'TRABAJADORES', ?, 'Coordinación operativa', ?, ?, ?, ?, NOW(), NOW()) 
       ON DUPLICATE KEY UPDATE 
         empresa=VALUES(empresa), 
         actividadInmediata=VALUES(actividadInmediata),
         responsable=VALUES(responsable),
         fechaCompromiso=VALUES(fechaCompromiso),
         estado=VALUES(estado),
         subtareas=VALUES(subtareas)`,
      [
        tareaMario.id,
        tareaMario.empresa,
        tareaMario.actividadInmediata,
        tareaMario.responsable,
        tareaMario.fechaCompromiso,
        tareaMario.estado,
        JSON.stringify(tareaMario.subtareas)
      ]
    );
    console.log('✅ Tarea de Trabajadores para Mario agregada exitosamente!');
  } catch (err) {
    console.error('Error insertando tarea de trabajadores para Mario:', err);
  } finally {
    await connection.end();
  }
}

insertTareaMarioTrabajadores();
