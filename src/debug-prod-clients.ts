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

  console.log('=== RESUMEN DE CLIENTES ACTIVOS EN PRODUCCIÓN ===');
  console.log('Total en DB:', clients.length);

  const rawCreators: Record<string, number> = {};
  const nullCreatorsByAssignee: Record<string, number> = {};

  for (const c of clients) {
    const rawCreator = c.creadoPor || 'NULL';
    rawCreators[rawCreator] = (rawCreators[rawCreator] || 0) + 1;

    if (!c.creadoPor) {
      const assignee = c.asignadoA || 'SIN_ASIGNAR';
      nullCreatorsByAssignee[assignee] = (nullCreatorsByAssignee[assignee] || 0) + 1;
    }
  }

  console.log('\n--- VALORES CRUDOS DEL CAMPO creadoPor EN DB ---');
  console.table(rawCreators);

  console.log('\n--- REGISTROS CON creadoPor = NULL AGRUPADOS POR VENDEDOR ASIGNADO ---');
  console.table(nullCreatorsByAssignee);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
