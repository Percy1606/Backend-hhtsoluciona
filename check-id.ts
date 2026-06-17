import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const id = '0f1e496d-7ab7-408b-b659-9cd3c0696109';
  console.log(`Checking quote with ID: ${id}`);
  
  const quote = await prisma.cotizacion.findUnique({
    where: { id },
    include: { cliente: true }
  });
  
  if (quote) {
    console.log('Quote FOUND:');
    console.log(JSON.stringify(quote, null, 2));
  } else {
    console.log('Quote NOT FOUND.');
    
    console.log('\nLast 5 quotes in database:');
    const lastQuotes = await prisma.cotizacion.findMany({
      take: 5,
      orderBy: { fechaCreacion: 'desc' },
      include: { cliente: { select: { empresa: true } } }
    });
    console.log(JSON.stringify(lastQuotes.map(q => ({ id: q.id, codigo: q.codigo, empresa: q.cliente?.empresa })), null, 2));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
