
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not defined');
    return;
  }

  const adapter = new PrismaMariaDb(databaseUrl);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('Checking for invalid TipoCliente values...');
    
    // We can't use prisma.cliente.findMany because it will fail with the enum error.
    // However, we can use $queryRaw to bypass Prisma's enum validation for discovery and fix.
    
    const invalidClientes = await prisma.$queryRawUnsafe<any[]>(
      "SELECT id, empresa, tipoCliente FROM cliente WHERE tipoCliente NOT IN ('PROSPECTO', 'CLIENTE', 'CLIENTE_INACTIVO') OR tipoCliente = ''"
    );

    console.log(`Found ${invalidClientes.length} clients with invalid TipoCliente.`);
    
    if (invalidClientes.length > 0) {
      console.log('Invalid records:', invalidClientes);
      
      const result = await prisma.$executeRawUnsafe(
        "UPDATE cliente SET tipoCliente = 'PROSPECTO' WHERE tipoCliente NOT IN ('PROSPECTO', 'CLIENTE', 'CLIENTE_INACTIVO') OR tipoCliente = ''"
      );
      
      console.log(`Updated ${result} records to 'PROSPECTO'.`);
    } else {
      console.log('No invalid records found.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
