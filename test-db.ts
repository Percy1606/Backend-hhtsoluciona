import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const cots = await prisma.cotizacion.findMany({
    where: { estado: 'Ganada' },
    include: { cliente: true, documentos: true }
  });
  console.log('Ganadas:', JSON.stringify(cots, null, 2));

  const resp = await prisma.responsable.findFirst({
    where: { activo: true }
  });
  console.log('Responsable activo:', resp?.id);
  
  for (const cot of cots) {
    const proyectoActivo = await prisma.proyecto.findFirst({
      where: {
        clientId: cot.clientId,
        estado: { not: 'Finalizado' }
      }
    });
    console.log(`Proyecto activo para ${cot.cliente.empresa}:`, proyectoActivo ? 'SI' : 'NO');
    console.log(`Docs para ${cot.codigo}:`, cot.documentos.length);
  }
}

main().finally(() => prisma.$disconnect());
