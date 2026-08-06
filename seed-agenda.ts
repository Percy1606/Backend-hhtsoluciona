process.env.DATABASE_URL = "mysql://root:@localhost:3306/software_hh_db";

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  const now = new Date();
  
  const formatDate = (date: Date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  // 1. Tarea CRITICA Vencida (> 24h) - Hace 2 días
  const dateCriticaVencida = new Date(now);
  dateCriticaVencida.setDate(now.getDate() - 2);

  // 2. Tarea CRITICA Normal (creada hoy, falta resolver)
  const dateCriticaHoy = new Date(now);

  // 3. Tarea ESPECIAL (48h) que aún no vence (tiene 1 día de antiguedad)
  const dateEspecialOk = new Date(now);
  dateEspecialOk.setDate(now.getDate() - 1);

  // 4. Tarea ESPECIAL (48h) Vencida (> 48h) - Hace 3 días
  const dateEspecialVencida = new Date(now);
  dateEspecialVencida.setDate(now.getDate() - 3);

  // 5. Tarea IMPORTANTE (normal, creada hoy)
  const dateImportanteHoy = new Date(now);

  const mockTareas = [
    {
      id: `task-${dateCriticaVencida.getTime()}`,
      empresa: 'Corporación Aceros Arequipa',
      etapaProceso: 'Negociación',
      actividadInmediata: 'Cerrar contrato anual urgentemente',
      proximoPaso: 'Firma de contrato',
      responsable: 'Steven',
      fechaCompromiso: formatDate(dateCriticaVencida),
      estado: 'PENDIENTE',
      subtareas: []
    },
    {
      id: `task-${dateCriticaHoy.getTime()}`,
      empresa: 'Minera Yanacocha',
      etapaProceso: 'Cotización',
      actividadInmediata: 'Enviar presupuesto corregido',
      proximoPaso: 'Esperar aprobación',
      responsable: 'Steven',
      fechaCompromiso: formatDate(dateCriticaHoy),
      estado: 'EN_PROCESO',
      subtareas: []
    },
    {
      id: `task-${dateImportanteHoy.getTime()}`,
      empresa: 'Alicorp S.A.A.',
      etapaProceso: 'Contacto Inicial',
      actividadInmediata: 'Llamada de presentación',
      proximoPaso: 'Agendar reunión presencial',
      responsable: 'Steven',
      fechaCompromiso: formatDate(dateImportanteHoy),
      estado: 'PENDIENTE',
      subtareas: []
    },
    {
      id: `task-${dateEspecialOk.getTime()}`,
      empresa: 'Banco de Crédito del Perú (BCP)',
      etapaProceso: 'Proyecto en ejecución',
      actividadInmediata: 'Revisión de planos',
      proximoPaso: 'Aprobación técnica',
      responsable: 'Valentina',
      fechaCompromiso: formatDate(dateEspecialOk),
      estado: 'EN_PROCESO',
      subtareas: []
    },
    {
      id: `task-${dateEspecialVencida.getTime()}`,
      empresa: 'Gloria S.A.',
      etapaProceso: 'Seguimiento',
      actividadInmediata: 'Enviar muestras de materiales',
      proximoPaso: 'Llamada confirmación',
      responsable: 'Steven',
      fechaCompromiso: formatDate(dateEspecialVencida),
      estado: 'PENDIENTE',
      subtareas: []
    }
  ];

  try {
    await prisma.$transaction(async (tx) => {
      await tx.tareaEstrategica.deleteMany({});
      // @ts-ignore
      await tx.tareaEstrategica.createMany({
        data: mockTareas
      });
    });
    console.log('✅ Base de datos sembrada correctamente con los escenarios de prueba!');
    console.log('Ahora puedes recargar el frontend para ver los colores y probar el bloqueo.');
  } catch (err) {
    console.error('❌ Error de conexión:', err);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
