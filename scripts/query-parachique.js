const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const clientes = await prisma.cliente.findMany({
      where: { empresa: { contains: 'HIELO' } },
      include: {
        proyectos: {
          select: { id: true, codigo: true, nombre: true, fechaCreacion: true, ventaContratada: true }
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
