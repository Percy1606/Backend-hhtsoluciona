const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const adelantos = await prisma.adelantoProyecto.findMany();
  let count = 0;
  for (const a of adelantos) {
    if (Number(a.saldoDisponible) === 0 && Number(a.monto) > 0 && Number(a.montoAplicado) === 0) {
      await prisma.adelantoProyecto.update({
        where: { id: a.id },
        data: { saldoDisponible: a.monto }
      });
      count++;
    }
  }
  console.log(`Updated ${count} adelantos.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
