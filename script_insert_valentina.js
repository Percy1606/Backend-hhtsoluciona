const mysql = require('mysql2/promise');

async function insertTareasValentina() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'hh_user',
    password: 'HHT2026Segura',
    database: 'software_hh_db'
  });

  const fechaManana = '11/08/2026';

  const tareasValentina = [
    {
      id: 'task-valentina-1',
      empresa: 'VALENTINA — Cartera y Seguimiento',
      actividadInmediata: 'Reporte completo de clientes visitados y evidencias',
      responsable: 'Valentina',
      fechaCompromiso: fechaManana,
      estado: 'PENDIENTE',
      subtareas: [
        {
          id: 'sub-valentina-1-1',
          texto: 'Enviar por correo listado completo de clientes visitados (empresa, contacto, cotización, informe, evidencias/pantallazos)',
          responsable: 'Valentina',
          fecha: fechaManana,
          completada: false,
          prioridad: 'ALTA'
        }
      ]
    },
    {
      id: 'task-valentina-2',
      empresa: 'VALENTINA — Evaluación Financiera',
      actividadInmediata: 'Excel a Mellani para evaluación de Finanzas',
      responsable: 'Valentina',
      fechaCompromiso: fechaManana,
      estado: 'PENDIENTE',
      subtareas: [
        {
          id: 'sub-valentina-2-1',
          texto: 'Enviar a Mellani Excel con Razón Social y RUC de empresas visitadas y en seguimiento para evaluación de Finanzas',
          responsable: 'Valentina',
          fecha: fechaManana,
          completada: false,
          prioridad: 'ALTA'
        }
      ]
    },
    {
      id: 'task-valentina-3',
      empresa: 'VALENTINA — Análisis de Visitas',
      actividadInmediata: 'Informe de causas sobre visitas agendadas',
      responsable: 'Valentina',
      fechaCompromiso: fechaManana,
      estado: 'PENDIENTE',
      subtareas: [
        {
          id: 'sub-valentina-3-1',
          texto: 'Elaborar informe identificando causas de por qué no se consiguen visitas agendadas para corregir',
          responsable: 'Valentina',
          fecha: fechaManana,
          completada: false,
          prioridad: 'MEDIA'
        }
      ]
    },
    {
      id: 'task-valentina-4',
      empresa: 'VALENTINA — Experiencia del Cliente',
      actividadInmediata: 'Encuestas de satisfacción por visitas técnicas',
      responsable: 'Valentina',
      fechaCompromiso: fechaManana,
      estado: 'PENDIENTE',
      subtareas: [
        {
          id: 'sub-valentina-4-1',
          texto: 'Enviar encuesta de satisfacción a clientes con visita técnica realizada (atención, presentación, conocimiento técnico)',
          responsable: 'Valentina',
          fecha: fechaManana,
          completada: false,
          prioridad: 'MEDIA'
        }
      ]
    },
    {
      id: 'task-valentina-5',
      empresa: 'VALENTINA — Cierre Comercial',
      actividadInmediata: 'Reuniones de cierre para cotizaciones enviadas',
      responsable: 'Valentina',
      fechaCompromiso: fechaManana,
      estado: 'PENDIENTE',
      subtareas: [
        {
          id: 'sub-valentina-5-1',
          texto: 'Solicitar reunión con cada cliente que tenga cotización enviada para explicar propuesta y trabajar el cierre',
          responsable: 'Valentina',
          fecha: fechaManana,
          completada: false,
          prioridad: 'ALTA'
        }
      ]
    }
  ];

  try {
    for (const t of tareasValentina) {
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
        [t.id, t.empresa, t.actividadInmediata, t.responsable, t.fechaCompromiso, t.estado, JSON.stringify(t.subtareas)]
      );
    }
    console.log('✅ 5 Tareas de Valentina agregadas a la Agenda de Trabajadores exitosamente!');
  } catch (err) {
    console.error('Error insertando tareas de Valentina:', err);
  } finally {
    await connection.end();
  }
}

insertTareasValentina();
