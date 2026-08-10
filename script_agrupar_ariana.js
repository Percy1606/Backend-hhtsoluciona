const mysql = require('mysql2/promise');

async function agruparTareasAriana() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'hh_user',
    password: 'HHT2026Segura',
    database: 'software_hh_db'
  });

  const fechaManana = '11/08/2026';

  const tareaUnicaAriana = {
    id: 'task-ariana-main',
    empresa: 'ARIANA — Gestión Comercial, Proveedores y Capacitación Interna',
    actividadInmediata: 'Corte/Reconexión ENSA, Capacitación Comercial, Ficha Caña Brava e Informe ENOSA',
    responsable: 'Ariana',
    fechaCompromiso: fechaManana,
    estado: 'PENDIENTE',
    subtareas: [
      {
        id: 'sub-ari-1',
        texto: '1. IPESA: Gestionar con Paul la solicitud de corte/reconexión e ingreso ante ENSA con documentación requerida',
        responsable: 'Ariana',
        fecha: fechaManana,
        completada: false,
        prioridad: 'ALTA'
      },
      {
        id: 'sub-ari-2',
        texto: '2. Capacitación comercial: Preparar programa interno (explicar informe, cotización, lenguaje verbal/no verbal, objeciones y cierres)',
        responsable: 'Ariana',
        fecha: fechaManana,
        completada: false,
        prioridad: 'MEDIA'
      },
      {
        id: 'sub-ari-3',
        texto: '3. Caña Brava: Preparar reunión y Ficha de Preparación Comercial (antecedentes, necesidad, estrategia y propuesta)',
        responsable: 'Ariana',
        fecha: fechaManana,
        completada: false,
        prioridad: 'ALTA'
      },
      {
        id: 'sub-ari-4',
        texto: '4. ENOSA: Elaborar informe ejecutivo del estado actual como proveedores (aprobados, pendientes, responsable y fecha)',
        responsable: 'Ariana',
        fecha: fechaManana,
        completada: false,
        prioridad: 'ALTA'
      }
    ]
  };

  try {
    // Eliminar tareas individuales anteriores de Ariana
    await connection.execute(
      `DELETE FROM tarea_estrategica WHERE id IN ('task-ariana-1', 'task-ariana-2', 'task-ariana-3', 'task-ariana-4')`
    );

    // Insertar la tarea agrupada única
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
        tareaUnicaAriana.id,
        tareaUnicaAriana.empresa,
        tareaUnicaAriana.actividadInmediata,
        tareaUnicaAriana.responsable,
        tareaUnicaAriana.fechaCompromiso,
        tareaUnicaAriana.estado,
        JSON.stringify(tareaUnicaAriana.subtareas)
      ]
    );
    console.log('✅ Tarea principal agrupada con sus 4 actividades para Ariana creada exitosamente!');
  } catch (err) {
    console.error('Error agrupando tareas de Ariana:', err);
  } finally {
    await connection.end();
  }
}

agruparTareasAriana();
