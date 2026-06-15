
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  try {
    console.log("Testing invoice creation...");
    // Find a client
    const cliente = await prisma.cliente.findFirst();
    if (!cliente) {
      console.error("No client found to test.");
      return;
    }

    const factura = await prisma.factura.create({
      data: {
        codigo: "TEST-" + Date.now(),
        clienteId: cliente.id,
        montoTotal: 100,
        montoSubtotal: 84.75,
        montoIgv: 15.25,
        saldoPendiente: 100,
        fechaEmision: new Date(),
        fechaVencimiento: new Date(Date.now() + 86400000),
        estado: 'PENDIENTE',
      } as any
    });
    console.log("Successfully created factura:", factura.id);
    
    // Cleanup
    await prisma.factura.delete({ where: { id: factura.id } });
    console.log("Successfully deleted test factura.");
  } catch (error) {
    console.error("ERROR DURING TEST:");
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
