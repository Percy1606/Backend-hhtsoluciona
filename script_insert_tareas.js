const mysql = require('mysql2/promise');

async function insertTareasConTexto() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'hh_user',
    password: 'HHT2026Segura',
    database: 'software_hh_db'
  });

  const mockTareas = [
    { 
      id: 'task-101', 
      empresa: 'HIELO Y CONGELADOS PARACHIQUE S.A.C - Proyecto prueba', 
      actividadInmediata: 'Seguimiento técnico', 
      responsable: 'Steven', 
      fechaCompromiso: '15/08/2026', 
      estado: 'EN_PROCESO',
      subtareas: [
        { id: 'sub-101-1', texto: 'Inspección técnica inicial', responsable: 'Steven', fecha: '15/08/2026', completada: false, prioridad: 'ALTA' },
        { id: 'sub-101-2', texto: 'Revisión de tableros eléctricos', responsable: 'Steven', fecha: '15/08/2026', completada: false, prioridad: 'MEDIA' },
        { id: 'sub-101-3', texto: 'Pruebas de aislamiento', responsable: 'Steven', fecha: '16/08/2026', completada: false, prioridad: 'ALTA' },
        { id: 'sub-101-4', texto: 'Monitoreo con analizador de redes', responsable: 'Steven', fecha: '16/08/2026', completada: false, prioridad: 'BAJA' },
        { id: 'sub-101-5', texto: 'Elaboración de informe borrador', responsable: 'Steven', fecha: '17/08/2026', completada: false, prioridad: 'MEDIA' },
        { id: 'sub-101-6', texto: 'Entrega de resultados finales', responsable: 'Steven', fecha: '18/08/2026', completada: false, prioridad: 'BAJA' }
      ]
    },
    { 
      id: 'task-102', 
      empresa: 'COOPERATIVA AGRARIA NORANDINO', 
      actividadInmediata: 'Monitoreo de parámetros', 
      responsable: 'Javier', 
      fechaCompromiso: '18/08/2026', 
      estado: 'EN_PROCESO',
      subtareas: [
        { id: 'sub-102-1', texto: 'Toma de lecturas de tensión', responsable: 'Javier', fecha: '18/08/2026', completada: false, prioridad: 'ALTA' },
        { id: 'sub-102-2', texto: 'Análisis de armónicos', responsable: 'Javier', fecha: '18/08/2026', completada: false, prioridad: 'ALTA' },
        { id: 'sub-102-3', texto: 'Calibración de sensores', responsable: 'Javier', fecha: '19/08/2026', completada: false, prioridad: 'MEDIA' },
        { id: 'sub-102-4', texto: 'Evaluación de factor de potencia', responsable: 'Javier', fecha: '19/08/2026', completada: false, prioridad: 'MEDIA' },
        { id: 'sub-102-5', texto: 'Reunión de avance con el cliente', responsable: 'Javier', fecha: '20/08/2026', completada: false, prioridad: 'BAJA' }
      ]
    },
    { 
      id: 'task-103', 
      empresa: 'MAYORSA S.A', 
      actividadInmediata: 'Mantenimiento de subestaciones', 
      responsable: 'Mario', 
      fechaCompromiso: '20/08/2026', 
      estado: 'EN_PROCESO',
      subtareas: [
        { id: 'sub-103-1', texto: 'Corte preventivo y bloqueo de energía', responsable: 'Mario', fecha: '20/08/2026', completada: false, prioridad: 'ALTA' },
        { id: 'sub-103-2', texto: 'Limpieza e inspección de celdas de media tensión', responsable: 'Mario', fecha: '20/08/2026', completada: false, prioridad: 'ALTA' },
        { id: 'sub-103-3', texto: 'Reajuste de contactos y torquímetro', responsable: 'Mario', fecha: '21/08/2026', completada: false, prioridad: 'MEDIA' },
        { id: 'sub-103-4', texto: 'Pruebas de disparo de reles', responsable: 'Mario', fecha: '21/08/2026', completada: false, prioridad: 'BAJA' }
      ]
    },
    { 
      id: 'task-104', 
      empresa: 'ALMACENES BOCA NEGRA S.A', 
      actividadInmediata: 'Instalación de conectores', 
      responsable: 'Angi', 
      fechaCompromiso: '22/08/2026', 
      estado: 'PENDIENTE',
      subtareas: [
        { id: 'sub-104-1', texto: 'Verificación de empalmes existentes', responsable: 'Angi', fecha: '22/08/2026', completada: false, prioridad: 'ALTA' },
        { id: 'sub-104-2', texto: 'Instalación de conectores ponchados', responsable: 'Angi', fecha: '22/08/2026', completada: false, prioridad: 'MEDIA' },
        { id: 'sub-104-3', texto: 'Pruebas de continuidad eléctrica', responsable: 'Angi', fecha: '23/08/2026', completada: false, prioridad: 'BAJA' }
      ]
    },
    { 
      id: 'task-105', 
      empresa: 'SISTEMAS DE ADMINISTRACION HOSPITALARIA S.A.C.', 
      actividadInmediata: 'Auditoría eléctrica', 
      responsable: 'Valentina', 
      fechaCompromiso: '25/08/2026', 
      estado: 'PENDIENTE',
      subtareas: [
        { id: 'sub-105-1', texto: 'Revisión de esquemas unifilares', responsable: 'Valentina', fecha: '25/08/2026', completada: false, prioridad: 'ALTA' },
        { id: 'sub-105-2', texto: 'Inspección de sistemas de puesta a tierra', responsable: 'Valentina', fecha: '25/08/2026', completada: false, prioridad: 'MEDIA' },
        { id: 'sub-105-3', texto: 'Medición de resistencia de pozo', responsable: 'Valentina', fecha: '26/08/2026', completada: false, prioridad: 'MEDIA' },
        { id: 'sub-105-4', texto: 'Elaboración de informe de vulnerabilidades', responsable: 'Valentina', fecha: '27/08/2026', completada: false, prioridad: 'BAJA' }
      ]
    },
    { 
      id: 'task-106', 
      empresa: 'Inmobiliaria Miraflores Peru S.a.C.', 
      actividadInmediata: 'Visita técnica', 
      responsable: 'Ariana', 
      fechaCompromiso: '26/08/2026', 
      estado: 'PENDIENTE',
      subtareas: [
        { id: 'sub-106-1', texto: 'Levantamiento de información en campo', responsable: 'Ariana', fecha: '26/08/2026', completada: false, prioridad: 'ALTA' },
        { id: 'sub-106-2', texto: 'Revisión de tableros generales', responsable: 'Ariana', fecha: '26/08/2026', completada: false, prioridad: 'MEDIA' },
        { id: 'sub-106-3', texto: 'Definición del plan de mantenimiento', responsable: 'Ariana', fecha: '27/08/2026', completada: false, prioridad: 'BAJA' }
      ]
    },
    { 
      id: 'task-107', 
      empresa: 'Fondo Nacional de Desarrollo Pesquero - FONDEPES', 
      actividadInmediata: 'Informe de inspección', 
      responsable: 'Brenda', 
      fechaCompromiso: '28/08/2026', 
      estado: 'PENDIENTE',
      subtareas: [
        { id: 'sub-107-1', texto: 'Consolidación de fotos y hallazgos', responsable: 'Brenda', fecha: '28/08/2026', completada: false, prioridad: 'ALTA' },
        { id: 'sub-107-2', texto: 'Redacción de conclusiones técnicas', responsable: 'Brenda', fecha: '28/08/2026', completada: false, prioridad: 'MEDIA' },
        { id: 'sub-107-3', texto: 'Revisión final y firma gerencial', responsable: 'Brenda', fecha: '29/08/2026', completada: false, prioridad: 'BAJA' }
      ]
    },
    { 
      id: 'task-108', 
      empresa: 'IMPERIO OPERADORES LOGISTICOS S.A.', 
      actividadInmediata: 'Cotización de filtros', 
      responsable: 'Mellani', 
      fechaCompromiso: '29/08/2026', 
      estado: 'PENDIENTE',
      subtareas: [
        { id: 'sub-108-1', texto: 'Solicitud de precios a proveedores', responsable: 'Mellani', fecha: '29/08/2026', completada: false, prioridad: 'ALTA' },
        { id: 'sub-108-2', texto: 'Estructuración del cuadro comparativo', responsable: 'Mellani', fecha: '30/08/2026', completada: false, prioridad: 'BAJA' }
      ]
    },
    { 
      id: 'task-109', 
      empresa: 'ESTACION DE SERVICIO Y GASOCENTRO MIRAFLORES', 
      actividadInmediata: 'Revisión de tableros', 
      responsable: 'Steven', 
      fechaCompromiso: '30/08/2026', 
      estado: 'PENDIENTE',
      subtareas: [
        { id: 'sub-109-1', texto: 'Termografía en interruptores termo-magnéticos', responsable: 'Steven', fecha: '30/08/2026', completada: false, prioridad: 'ALTA' }
      ]
    },
    { 
      id: 'task-110', 
      empresa: 'IPESA SAC', 
      actividadInmediata: 'Verificación de transformador', 
      responsable: 'Javier', 
      fechaCompromiso: '31/08/2026', 
      estado: 'PENDIENTE',
      subtareas: [
        { id: 'sub-110-1', texto: 'Toma de muestra de aceite dieléctrico', responsable: 'Javier', fecha: '31/08/2026', completada: false, prioridad: 'ALTA' },
        { id: 'sub-110-2', texto: 'Inspección de hermetismo y fugas', responsable: 'Javier', fecha: '31/08/2026', completada: false, prioridad: 'MEDIA' }
      ]
    },
    { 
      id: 'task-111', 
      empresa: 'Ipesa S.A.C - Chiclayo', 
      actividadInmediata: 'Mantenimiento preventivo', 
      responsable: 'Mario', 
      fechaCompromiso: '01/09/2026', 
      estado: 'EN_PROCESO',
      subtareas: [
        { id: 'sub-111-1', texto: 'Limpieza de aislares y bornes', responsable: 'Mario', fecha: '01/09/2026', completada: false, prioridad: 'ALTA' },
        { id: 'sub-111-2', texto: 'Ajuste de conexiones con torquímetro', responsable: 'Mario', fecha: '01/09/2026', completada: false, prioridad: 'ALTA' },
        { id: 'sub-111-3', texto: 'Revisión de luces piloto e instrumentos', responsable: 'Mario', fecha: '02/09/2026', completada: false, prioridad: 'MEDIA' },
        { id: 'sub-111-4', texto: 'Pruebas de funcionamiento sin carga', responsable: 'Mario', fecha: '02/09/2026', completada: false, prioridad: 'BAJA' }
      ]
    },
    { 
      id: 'task-112', 
      empresa: 'Costeño alimentos S.A.C', 
      actividadInmediata: 'Pruebas de aislamiento', 
      responsable: 'Angi', 
      fechaCompromiso: '02/09/2026', 
      estado: 'EN_PROCESO',
      subtareas: [
        { id: 'sub-112-1', texto: 'Prueba Megger a motores principales', responsable: 'Angi', fecha: '02/09/2026', completada: false, prioridad: 'ALTA' },
        { id: 'sub-112-2', texto: 'Medición de índice de polarización', responsable: 'Angi', fecha: '02/09/2026', completada: false, prioridad: 'MEDIA' },
        { id: 'sub-112-3', texto: 'Registro de tendencias de aislamiento', responsable: 'Angi', fecha: '03/09/2026', completada: false, prioridad: 'BAJA' }
      ]
    },
    { 
      id: 'task-113', 
      empresa: 'AGRICOLA DEL CHIRA S.A. (CAÑA BRAVA)', 
      actividadInmediata: 'Inspección de pozo a tierra', 
      responsable: 'Valentina', 
      fechaCompromiso: '03/09/2026', 
      estado: 'PENDIENTE',
      subtareas: [
        { id: 'sub-113-1', texto: 'Medición de ohmios en pozos', responsable: 'Valentina', fecha: '03/09/2026', completada: false, prioridad: 'ALTA' },
        { id: 'sub-113-2', texto: 'Mantenimiento con dosis química', responsable: 'Valentina', fecha: '04/09/2026', completada: false, prioridad: 'BAJA' }
      ]
    },
    { 
      id: 'task-114', 
      empresa: 'HOTELERIA PERUANA S.A.C.', 
      actividadInmediata: 'Estudio de calidad de energía', 
      responsable: 'Ariana', 
      fechaCompromiso: '04/09/2026', 
      estado: 'PENDIENTE',
      subtareas: [
        { id: 'sub-114-1', texto: 'Instalación de registrador multifunción', responsable: 'Ariana', fecha: '04/09/2026', completada: false, prioridad: 'ALTA' }
      ]
    },
    { 
      id: 'task-115', 
      empresa: 'UNIVERSIDAD CESAR VALLEJO S.A.C.', 
      actividadInmediata: 'Mantenimiento de celdas', 
      responsable: 'Brenda', 
      fechaCompromiso: '05/09/2026', 
      estado: 'PENDIENTE',
      subtareas: [
        { id: 'sub-115-1', texto: 'Pruebas dieléctricas en vacíos', responsable: 'Brenda', fecha: '05/09/2026', completada: false, prioridad: 'ALTA' }
      ]
    }
  ];

  try {
    for (const t of mockTareas) {
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
    console.log('✅ Subtareas corregidas con campo texto exitosamente');
  } catch (err) {
    console.error('Error insertando tareas y subtareas:', err);
  } finally {
    await connection.end();
  }
}

insertTareasConTexto();
