const mysql = require('mysql2/promise');

async function insertTareaGuillermoTrabajadores() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'hh_user',
    password: 'HHT2026Segura',
    database: 'software_hh_db'
  });

  const fechaManana = '11/08/2026';

  const tareaGuillermo = {
    id: 'task-guillermo-trabajadores-main',
    empresa: 'GUILLERMO — Capacitación con casos reales',
    actividadInmediata: 'Explicación práctica de informes de IPESA Piura, IPESA Chiclayo y Frío Frías',
    responsable: 'Guillermo',
    fechaCompromiso: fechaManana,
    estado: 'PENDIENTE',
    subtareas: [
      {
        id: 'sub-guillermo-1',
        texto: '1. Explicar informes de IPESA Piura, IPESA Chiclayo y Frío Frías (Qué encontramos → Riesgo → Recomendación → Propuesta → Cómo explicar al cliente)',
        responsable: 'Guillermo',
        fecha: fechaManana,
        completada: false,
        prioridad: 'ALTA'
      }
    ]
  };

  try {
    await connection.execute(
      `INSERT INTO tarea_estrategica (id, empresa, etapaProceso, actividadInmediata, proximoPaso, responsable, fechaCompromiso, estado, subtareas, createdAt, updatedAt) 
       VALUES (?, ?, 'TRABAJADORES', ?, 'Capacitación técnica', ?, ?, ?, ?, NOW(), NOW()) 
       ON DUPLICATE KEY UPDATE 
         empresa=VALUES(empresa), 
         actividadInmediata=VALUES(actividadInmediata),
         responsable=VALUES(responsable),
         fechaCompromiso=VALUES(fechaCompromiso),
         estado=VALUES(estado),
         subtareas=VALUES(subtareas)`,
      [
        tareaGuillermo.id,
        tareaGuillermo.empresa,
        tareaGuillermo.actividadInmediata,
        tareaGuillermo.responsable,
        tareaGuillermo.fechaCompromiso,
        tareaGuillermo.estado,
        JSON.stringify(tareaGuillermo.subtareas)
      ]
    );
    console.log('✅ Tarea de Trabajadores para Guillermo agregada exitosamente!');
  } catch (err) {
    console.error('Error insertando tarea de trabajadores para Guillermo:', err);
  } finally {
    await connection.end();
  }
}

insertTareaGuillermoTrabajadores();
