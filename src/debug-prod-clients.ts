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
          fecha: true,
          createdAt: true
        }
      }
    }
  });

  const getRealCreator = (c: any) => {
    if (c.creadoPor) return c.creadoPor;
    if (c.interacciones && c.interacciones.length > 0) {
      const sorted = [...c.interacciones].sort((a: any, b: any) => new Date(a.fecha || a.createdAt).getTime() - new Date(b.fecha || b.createdAt).getTime());
      if (sorted[0]?.usuario) return sorted[0].usuario;
    }
    return c.asignadoA;
  };

  console.log('=== RESUMEN DE CLIENTES ACTIVOS EN PRODUCCIÓN ===');
  console.log('Total en DB:', clients.length);

  const creators: Record<string, any[]> = {};
  const assignees: Record<string, any[]> = {};

  for (const c of clients) {
    const creator = (getRealCreator(c) || 'Sin Creador').trim();
    const assignee = (c.asignadoA || 'Sin Asignar').trim();

    if (!creators[creator]) creators[creator] = [];
    creators[creator].push(c);

    if (!assignees[assignee]) assignees[assignee] = [];
    assignees[assignee].push(c);
  }

  console.log('\n--- TOTALES POR CREADOR REAL (getRealCreator) ---');
  for (const [creator, list] of Object.entries(creators)) {
    console.log(`Creador: "${creator}" -> Total: ${list.length}`);
    const stages = list.reduce((acc, cl) => {
      acc[cl.etapaComercial] = (acc[cl.etapaComercial] || 0) + 1;
      return acc;
    }, {});
    console.log(`  Desglose por Etapa Comercial:`, stages);
  }

  console.log('\n--- TOTALES POR ASESOR ASIGNADO (asignadoA) ---');
  for (const [assignee, list] of Object.entries(assignees)) {
    console.log(`Asignado a: "${assignee}" -> Total: ${list.length}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
