const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seed() {
  const now = new Date();
  
  const formatDate = (date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const dateHace3Dias = new Date(now); dateHace3Dias.setDate(now.getDate() - 3);
  const dateHace2Dias = new Date(now); dateHace2Dias.setDate(now.getDate() - 2);
  const dateAyer = new Date(now); dateAyer.setDate(now.getDate() - 1);
  const dateHoy = new Date(now);
  const dateManana = new Date(now); dateManana.setDate(now.getDate() + 1);

  const genId = () => Math.random().toString(36).substr(2, 9);

  const mockTareas = [
    {
      id: `steven-${genId()}`,
      empresa: 'Corporación Aceros Arequipa',
      etapaProceso: 'Negociación',
      actividadInmediata: 'Cerrar contrato',
      proximoPaso: 'Firma',
      responsable: 'Steven',
      fechaCompromiso: formatDate(dateHoy),
      estado: 'EN_PROCESO',
      subtareas: JSON.stringify([
        {
          id: genId(),
          fecha: formatDate(dateHace2Dias), // Fuego
          texto: 'Enviar borrador del contrato legal a gerencia',
          completada: false,
          prioridad: 'ALTA', // Crítica
          responsable: 'Steven'
        },
        {
          id: genId(),
          fecha: formatDate(dateHoy), // Día a día
          texto: 'Llamada de seguimiento con el abogado',
          completada: false,
          prioridad: 'MEDIA', // Normal
          responsable: 'Steven'
        },
        {
          id: genId(),
          fecha: formatDate(dateHoy), // Día a día completado
          texto: 'Actualizar CRM con datos de facturación',
          completada: true,
          prioridad: 'MEDIA', // Normal
          responsable: 'Steven'
        }
      ])
    },
    {
      id: `angie-${genId()}`,
      empresa: 'Alicorp S.A.A.',
      etapaProceso: 'Recuperación',
      actividadInmediata: 'Cobranza atrasada',
      proximoPaso: 'Depósito',
      responsable: 'Angie',
      fechaCompromiso: formatDate(dateHoy),
      estado: 'PENDIENTE',
      subtareas: JSON.stringify([
        {
          id: genId(),
          fecha: formatDate(dateHace3Dias), // Fuego (Especial vencida)
          texto: 'Verificar comprobante de pago observado',
          completada: false,
          prioridad: 'BAJA', // Especial
          responsable: 'Angie'
        },
        {
          id: genId(),
          fecha: formatDate(dateAyer), // Especial en curso (1 día)
          texto: 'Conciliación bancaria',
          completada: false,
          prioridad: 'BAJA', // Especial
          responsable: 'Angie'
        }
      ])
    },
    {
      id: `javier-${genId()}`,
      empresa: 'Minera Yanacocha',
      etapaProceso: 'Cotización',
      actividadInmediata: 'Presupuesto 2027',
      proximoPaso: 'Aprobación',
      responsable: 'Javier',
      fechaCompromiso: formatDate(dateHoy),
      estado: 'EN_PROCESO',
      subtareas: JSON.stringify([
        {
          id: genId(),
          fecha: formatDate(dateAyer), // Fuego (Normal vencida)
          texto: 'Ajustar cálculo de flete',
          completada: false,
          prioridad: 'MEDIA', 
          responsable: 'Javier'
        },
        {
          id: genId(),
          fecha: formatDate(dateHoy), // Día a día
          texto: 'Revisión final de costos',
          completada: false,
          prioridad: 'MEDIA_ALTA', // Importante
          responsable: 'Javier'
        },
        {
          id: genId(),
          fecha: formatDate(dateManana), // Futuro (No debe verse)
          texto: 'Agendar reunión de presentación',
          completada: false,
          prioridad: 'MEDIA',
          responsable: 'Javier'
        }
      ])
    },
    {
      id: `mellani-${genId()}`,
      empresa: 'Banco de Crédito del Perú (BCP)',
      etapaProceso: 'Proyecto en ejecución',
      actividadInmediata: 'Revisión de planos',
      proximoPaso: 'Aprobación técnica',
      responsable: 'Mellani',
      fechaCompromiso: formatDate(dateHoy),
      estado: 'EN_PROCESO',
      subtareas: JSON.stringify([
        {
          id: genId(),
          fecha: formatDate(dateHoy), // Día a día
          texto: 'Pedir firmas de conformidad técnica en obra',
          completada: false,
          prioridad: 'MEDIA_ALTA', 
          responsable: 'Mellani'
        }
      ])
    }
  ];

  try {
    await prisma.tareaEstrategica.deleteMany({});
    
    for (const t of mockTareas) {
      await prisma.tareaEstrategica.create({
        data: {
          id: t.id,
          empresa: t.empresa,
          etapaProceso: t.etapaProceso,
          actividadInmediata: t.actividadInmediata,
          proximoPaso: t.proximoPaso,
          responsable: t.responsable,
          fechaCompromiso: t.fechaCompromiso,
          estado: t.estado,
          subtareas: t.subtareas
        }
      });
    }
    
    console.log('✅ Base de datos (Prisma) sembrada masivamente con Actividades para Auditoría.');
  } catch (err) {
    console.error('❌ Error ejecutando seed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
