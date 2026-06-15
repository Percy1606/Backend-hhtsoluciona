import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- Iniciando creación de Caja Principal ---');
  try {
    const count = await prisma.caja.count();
    if (count === 0) {
      const caja = await prisma.caja.create({
        data: {
          nombre: 'Caja Principal',
          tipo: 'EFECTIVO' as any,
          saldoReal: 10000,
          saldoDisponible: 10000,
          saldoComprometido: 0
        }
      });
      console.log('✅ Caja Principal creada con éxito:', caja.id);
    } else {
      console.log('ℹ️ La caja ya existe, no se realizaron cambios.');
    }
  } catch (error) {
    console.error('❌ Error al crear la caja:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
