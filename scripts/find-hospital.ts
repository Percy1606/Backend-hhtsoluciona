import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const clientes = await prisma.cliente.findMany({
    where: {
      empresa: { contains: 'HOSPITAL' }
    },
    include: {
      interacciones: true
    }
  });

  console.log('CLIENTES ENCONTRADOS EN DB LOCAL:');
  console.log(JSON.stringify(clientes, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
