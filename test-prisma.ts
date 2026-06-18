
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing Prisma connection and query...');
  try {
    const clientes = await prisma.cliente.findMany({
      take: 1,
      include: {
        interacciones: true,
        proyectos: true,
        documentos: true,
      }
    });
    console.log('Clientes query success:', JSON.stringify(clientes, null, 2));
  } catch (error) {
    console.error('Clientes query failed:');
    console.error(error);
  }

  try {
    const cotizaciones = await prisma.cotizacion.findMany({
      take: 1,
      include: {
        cliente: true,
        documentos: true,
        hitosPago: true,
      }
    });
    console.log('Cotizaciones query success:', JSON.stringify(cotizaciones, null, 2));
  } catch (error) {
    console.error('Cotizaciones query failed:');
    console.error(error);
  }

  await prisma.$disconnect();
}

main();
