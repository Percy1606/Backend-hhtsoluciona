
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
    console.log('--- CORRECCIÓN DE VALORES ENUM EN TABLA CLIENTE ---');

    const result = await prisma.$executeRawUnsafe(
      "UPDATE cliente SET tipoCliente = 'PROSPECTO' WHERE tipoCliente = '' OR tipoCliente IS NULL"
    );

    console.log(`✅ Se han actualizado ${result} registros correctamente.`);

    console.log('\nVerificando valores actuales en "tipoCliente":');
    const verificacion = await prisma.$queryRawUnsafe<any[]>(
      "SELECT tipoCliente, COUNT(*) as count FROM cliente GROUP BY tipoCliente"
    );
    console.table(verificacion);

  } catch (error) {
    console.error('❌ Error durante la corrección:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
