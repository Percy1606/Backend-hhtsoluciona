const mysql = require('mysql2/promise');

async function insertNuevasActividadesAriana() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'hh_user',
    password: 'HHT2026Segura',
    database: 'software_hh_db'
  });

  const fechaManana = '11/08/2026';

  const nuevasTareasAriana = [
    {
      id: 'task-ariana-1',
      empresa: 'IPESA - ENSA',
      actividadInmediata: 'Gestionar solicitud de corte y reconexión ante ENSA con Paul',
      responsable: 'Ariana',
      fechaCompromiso: fechaManana,
      estado: 'PENDIENTE',
      subtareas: [
        {
          id: 'sub-ariana-1-1',
          texto: 'Gestionar con Paul la solicitud de corte/reconexión e ingreso a ENSA con documentación',
          responsable: 'Ariana',
          fecha: fechaManana,
          completada: false,
          prioridad: 'ALTA'
        }
      ]
    },
    {
      id: 'task-ariana-2',
      empresa: 'Capacitación Comercial HH',
      actividadInmediata: 'Programa Interno de Entrenamiento Comercial HH',
      responsable: 'Ariana',
      fechaCompromiso: fechaManana,
      estado: 'PENDIENTE',
      subtareas: [
        {
          id: 'sub-ariana-2-1',
          texto: 'Material: Explicar informe técnico, cotización, lenguaje verbal/no verbal, preguntas y objeciones',
          responsable: 'Ariana',
          fecha: fechaManana,
          completada: false,
          prioridad: 'MEDIA'
        },
        {
          id: 'sub-ariana-2-2',
          texto: 'Material: Negociación, técnica de cierre comercial y errores a evitar',
          responsable: 'Ariana',
          fecha: fechaManana,
          completada: false,
          prioridad: 'MEDIA'
        }
      ]
    },
    {
      id: 'task-ariana-3',
      empresa: 'CAÑA BRAVA',
      actividadInmediata: 'Ficha de Preparación Comercial - Caña Brava',
      responsable: 'Ariana',
      fechaCompromiso: fechaManana,
      estado: 'PENDIENTE',
      subtareas: [
        {
          id: 'sub-ariana-3-1',
          texto: 'Ficha comercial: Contactos, antecedentes, necesidad, estrategia y servicios a ofrecer',
          responsable: 'Ariana',
          fecha: fechaManana,
          completada: false,
          prioridad: 'ALTA'
        }
      ]
    },
    {
      id: 'task-ariana-4',
      empresa: 'ENOSA',
      actividadInmediata: 'Informe ejecutivo de estado como proveedores de ENOSA',
      responsable: 'Ariana',
      fechaCompromiso: fechaManana,
      estado: 'PENDIENTE',
      subtareas: [
        {
          id: 'sub-ariana-4-1',
          texto: 'Informe ejecutivo: Avance de ingreso de proveedores ENOSA, aprobados, pendientes y responsables',
          responsable: 'Ariana',
          fecha: fechaManana,
          completada: false,
          prioridad: 'ALTA'
        }
      ]
    }
  ];

  try {
    for (const t of nuevasTareasAriana) {
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
        [t.id, t.empresa, t.actividadInmediata, t.responsable, t.fechaCompromiso, t.estado, JSON.stringify(t.subtareas)]
      );
    }
    console.log('✅ 4 Nuevas tareas/actividades agregadas exitosamente a Ariana para el 11/08/2026!');
  } catch (err) {
    console.error('Error insertando tareas de Ariana:', err);
  } finally {
    await connection.end();
  }
}

insertNuevasActividadesAriana();
