const mysql = require('mysql2/promise');

async function seed() {
  const now = new Date();
  
  const formatDate = (date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const dateCriticaVencida = new Date(now);
  dateCriticaVencida.setDate(now.getDate() - 2);

  const dateCriticaHoy = new Date(now);

  const dateEspecialOk = new Date(now);
  dateEspecialOk.setDate(now.getDate() - 1);

  const dateEspecialVencida = new Date(now);
  dateEspecialVencida.setDate(now.getDate() - 3);

  const dateImportanteHoy = new Date(now);

  const mockTareas = [
    {
      id: `task-A-${dateCriticaVencida.getTime()}`,
      empresa: 'Aceros Arequipa',
      etapaProceso: 'Negociación',
      actividadInmediata: 'Cerrar contrato',
      proximoPaso: 'Firma',
      responsable: 'Steven',
      fechaCompromiso: formatDate(dateCriticaVencida),
      estado: 'PENDIENTE',
    },
    {
      id: `task-B-${dateCriticaHoy.getTime()}`,
      empresa: 'Minera Yanacocha',
      etapaProceso: 'Cotización',
      actividadInmediata: 'Presupuesto urgente',
      proximoPaso: 'Esperar aprobación',
      responsable: 'Steven',
      fechaCompromiso: formatDate(dateCriticaHoy),
      estado: 'EN_PROCESO',
    },
    {
      id: `task-C-${dateImportanteHoy.getTime()}`,
      empresa: 'Alicorp S.A.A.',
      etapaProceso: 'Contacto Inicial',
      actividadInmediata: 'Llamada',
      proximoPaso: 'Reunión',
      responsable: 'Steven',
      fechaCompromiso: formatDate(dateImportanteHoy),
      estado: 'PENDIENTE',
    },
    {
      id: `task-D-${dateEspecialOk.getTime()}`,
      empresa: 'BCP',
      etapaProceso: 'Proyecto en ejecución',
      actividadInmediata: 'Planos',
      proximoPaso: 'Aprobación',
      responsable: 'Valentina',
      fechaCompromiso: formatDate(dateEspecialOk),
      estado: 'EN_PROCESO',
    },
    {
      id: `task-E-${dateEspecialVencida.getTime()}`,
      empresa: 'Gloria S.A.',
      etapaProceso: 'Seguimiento',
      actividadInmediata: 'Muestras',
      proximoPaso: 'Llamada',
      responsable: 'Steven',
      fechaCompromiso: formatDate(dateEspecialVencida),
      estado: 'PENDIENTE',
    }
  ];

  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'software_hh_db'
  });

  try {
    await connection.execute('DELETE FROM tarea_estrategica');
    
    for (const t of mockTareas) {
      await connection.execute(
        `INSERT IGNORE INTO tarea_estrategica 
        (id, empresa, etapaProceso, actividadInmediata, proximoPaso, responsable, fechaCompromiso, estado, updatedAt) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [t.id, t.empresa, t.etapaProceso, t.actividadInmediata, t.proximoPaso, t.responsable, t.fechaCompromiso, t.estado]
      );
    }
    
    console.log('✅ Base de datos (MySQL Nativo) sembrada correctamente!');
  } catch (err) {
    console.error('❌ Error ejecutando seed:', err);
  } finally {
    await connection.end();
  }
}

seed();
