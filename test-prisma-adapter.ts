
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not defined');
    return;
  }
  
  console.log('Using database URL:', databaseUrl);
  const adapter = new PrismaMariaDb(databaseUrl);
  const prisma = new PrismaClient({ adapter });

  console.log('Testing Prisma connection and query with MariaDB adapter...');
  try {
    const total = await prisma.cliente.count();
    console.log('Total clientes:', total);
    
    const clientes = await prisma.cliente.findMany({
      take: 1,
      include: {
        interacciones: true,
        proyectos: true,
        documentos: true,
      }
    });
    console.log('Clientes query success. Found:', clientes.length);
  } catch (error) {
    console.error('Clientes query failed:');
    console.error(error);
  }

  await prisma.$disconnect();
}

main();
