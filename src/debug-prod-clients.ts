import { PrismaService } from './prisma/prisma.service';

async function main() {
  const prisma = new PrismaService();
  await prisma.onModuleInit();
  
  const clients = await prisma.cliente.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      empresa: true,
      creadoPor: true,
      asignadoA: true,
      etapaComercial: true,
      tipoCliente: true,
      fechaCreacion: true,
      interacciones: {
        orderBy: { fecha: 'desc' },
        select: {
          usuario: true,
          fecha: true
        }
      }
    }
  });

  const getRealCreator = (c: any) => {
    if (c.creadoPor) return c.creadoPor;
    if (c.interacciones && c.interacciones.length > 0) {
      const sorted = [...c.interacciones].sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      if (sorted[0]?.usuario) return sorted[0].usuario;
    }
    return c.asignadoA;
  };

  console.log('=== BUSCANDO INTERACCIONES DE CLIENTES ESPECÍFICOS ===');
  const targetClients = await prisma.cliente.findMany({
    where: {
      deletedAt: null,
      empresa: {
        contains: 'ACELIM'
      }
    },
    select: {
      id: true,
      empresa: true,
      creadoPor: true,
      asignadoA: true,
      interacciones: {
        select: {
          id: true,
          fecha: true,
          tipo: true,
          accion: true,
          usuario: true,
          observaciones: true
        }
      }
    }
  });

  const targetClients2 = await prisma.cliente.findMany({
    where: {
      deletedAt: null,
      empresa: {
        contains: 'NORANDINO'
      }
    },
    select: {
      id: true,
      empresa: true,
      creadoPor: true,
      asignadoA: true,
      interacciones: {
        select: {
          id: true,
          fecha: true,
          tipo: true,
          accion: true,
          usuario: true,
          observaciones: true
        }
      }
    }
  });

  const allTargets = [...targetClients, ...targetClients2];
  for (const tc of allTargets) {
    console.log(`\nCliente: "${tc.empresa}" (ID: ${tc.id})`);
    console.log(`Asignado a: "${tc.asignadoA}" | Creado por: "${tc.creadoPor}"`);
    console.log(`Interacciones (${tc.interacciones.length}):`);
    console.table(tc.interacciones);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
