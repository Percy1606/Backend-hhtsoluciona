
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as dotenv from 'dotenv';
import * as path from 'path';

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
    console.log('--- ANÁLISIS DE VALORES ENUM EN TABLA CLIENTE ---');

    console.log('\n1. Valores distintos en "tipoCliente":');
    const tipoClienteDistintos = await prisma.$queryRawUnsafe<any[]>(
      "SELECT tipoCliente, COUNT(*) as count FROM cliente GROUP BY tipoCliente"
    );
    console.table(tipoClienteDistintos);

    console.log('\n2. Valores distintos en "clasificacion":');
    const clasificacionDistintos = await prisma.$queryRawUnsafe<any[]>(
      "SELECT clasificacion, COUNT(*) as count FROM cliente GROUP BY clasificacion"
    );
    console.table(clasificacionDistintos);

    console.log('\n3. Registros con valores potencialmente inválidos (tipoCliente):');
    const invalidosTipo = await prisma.$queryRawUnsafe<any[]>(
      "SELECT id, empresa, tipoCliente FROM cliente WHERE tipoCliente NOT IN ('PROSPECTO', 'CLIENTE', 'CLIENTE_INACTIVO') OR tipoCliente IS NULL OR tipoCliente = ''"
    );
    if (invalidosTipo.length > 0) {
        console.log(`Se encontraron ${invalidosTipo.length} registros:`);
        console.table(invalidosTipo);
    } else {
        console.log('No se encontraron valores inválidos en tipoCliente.');
    }

    console.log('\n4. Registros con valores potencialmente inválidos (clasificacion):');
    const invalidosClasificacion = await prisma.$queryRawUnsafe<any[]>(
      "SELECT id, empresa, clasificacion FROM cliente WHERE clasificacion NOT IN ('MUY_RENTABLE', 'RENTABLE', 'POCO_RENTABLE') OR clasificacion IS NULL OR clasificacion = ''"
    );
    if (invalidosClasificacion.length > 0) {
        console.log(`Se encontraron ${invalidosClasificacion.length} registros:`);
        console.table(invalidosClasificacion);
    } else {
        console.log('No se encontraron valores inválidos en clasificacion.');
    }

  } catch (error) {
    console.error('Error durante el análisis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
