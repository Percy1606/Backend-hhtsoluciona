const mysql = require('mysql2/promise');

async function agruparTareasValentina() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'hh_user',
    password: 'HHT2026Segura',
    database: 'software_hh_db'
  });

  const fechaManana = '11/08/2026';

  const tareaUnicaValentina = {
    id: 'task-valentina-main',
    empresa: 'VALENTINA — Cartera, seguimiento y experiencia del cliente',
    actividadInmediata: 'Gestión integral de cartera, informes, encuestas y cierres comerciales',
    responsable: 'Valentina',
    fechaCompromiso: fechaManana,
    estado: 'PENDIENTE',
    subtareas: [
      {
        id: 'sub-val-1',
        texto: '1. Enviar por correo listado completo de clientes visitados (empresa, contacto, cotización, informe, evidencias/pantallazos)',
        responsable: 'Valentina',
        fecha: fechaManana,
        completada: false,
        prioridad: 'ALTA'
      },
      {
        id: 'sub-val-2',
        texto: '2. Enviar a Mellani Excel con Razón Social y RUC de empresas visitadas y en seguimiento para evaluación de Finanzas',
        responsable: 'Valentina',
        fecha: fechaManana,
        completada: false,
        prioridad: 'ALTA'
      },
      {
        id: 'sub-val-3',
        texto: '3. Elaborar informe identificando causas de por qué todavía no estamos consiguiendo visitas agendadas para corregir',
        responsable: 'Valentina',
        fecha: fechaManana,
        completada: false,
        prioridad: 'MEDIA'
      },
      {
        id: 'sub-val-4',
        texto: '4. Enviar encuesta de satisfacción a todos los clientes donde ya realizamos visita técnica (atención, conocimiento, mejoras)',
        responsable: 'Valentina',
        fecha: fechaManana,
        completada: false,
        prioridad: 'MEDIA'
      },
      {
        id: 'sub-val-5',
        texto: '5. Solicitar reunión con cada cliente al que le hayamos enviado cotización para explicar la propuesta y trabajar el cierre',
        responsable: 'Valentina',
        fecha: fechaManana,
        completada: false,
        prioridad: 'ALTA'
      }
    ]
  };

  try {
    // Eliminar tareas individuales anteriores de Valentina
    await connection.execute(
      `DELETE FROM tarea_estrategica WHERE id IN ('task-valentina-1', 'task-valentina-2', 'task-valentina-3', 'task-valentina-4', 'task-valentina-5')`
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
        tareaUnicaValentina.id,
        tareaUnicaValentina.empresa,
        tareaUnicaValentina.actividadInmediata,
        tareaUnicaValentina.responsable,
        tareaUnicaValentina.fechaCompromiso,
        tareaUnicaValentina.estado,
        JSON.stringify(tareaUnicaValentina.subtareas)
      ]
    );
    console.log('✅ Tarea principal agrupadada con sus 5 actividades para Valentina creada exitosamente!');
  } catch (err) {
    console.error('Error agrupando tareas de Valentina:', err);
  } finally {
    await connection.end();
  }
}

agruparTareasValentina();
