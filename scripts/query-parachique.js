const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined");
}
const adapter = new PrismaMariaDb(databaseUrl);
const prisma = new PrismaClient({ adapter });

async function run() {
  try {
    const clientes = await prisma.cliente.findMany({
      where: { empresa: { contains: 'HIELO' } },
      include: {
        proyectos: {
          select: { id: true, codigo: true, nombre: true, fechaCreacion: true, ventaContratada: true, estado: true }
        },
        cotizaciones: {
          select: { id: true, codigo: true, fechaCreacion: true, monto: true, estado: true }
        },
        facturas: {
          select: { id: true, numero: true, fechaEmision: true, total: true, estado: true }
        }
      }
    });
    console.log("RESULTADO:", JSON.stringify(clientes, null, 2));
  } catch (err) {
    console.error("Error query:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
