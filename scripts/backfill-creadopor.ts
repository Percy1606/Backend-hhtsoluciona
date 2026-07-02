import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const clientes = await prisma.cliente.findMany({ where: { creadoPor: null } });
  const logs = await prisma.auditLog.findMany({
    where: { accion: 'CREAR_CLIENTE' },
    include: { usuario: true }
  });
  
  let updated = 0;
  for (const c of clientes) {
    const log = logs.find(l => l.detalles && typeof l.detalles === 'object' && (l.detalles as any).clienteId === c.id);
    if (log && log.usuario) {
      await prisma.cliente.update({ where: { id: c.id }, data: { creadoPor: log.usuario.nombre } });
      updated++;
    } else {
      const int = await prisma.interaccion.findFirst({
        where: { clientId: c.id },
        orderBy: { fecha: 'asc' }
      });
      if (int && int.usuario) {
        await prisma.cliente.update({ where: { id: c.id }, data: { creadoPor: int.usuario } });
        updated++;
      } else if (c.asignadoA) {
        await prisma.cliente.update({ where: { id: c.id }, data: { creadoPor: c.asignadoA } });
        updated++;
      }
    }
  }
  console.log('Updated', updated, 'clients');
}
main().catch(console.error).finally(() => prisma.$disconnect());
