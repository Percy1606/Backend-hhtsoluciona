import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- Buscando cliente HOSPITAL PRIVADO DEL PERU S.A.C ---');
  
  const clientes = await prisma.cliente.findMany({
    where: {
      empresa: { contains: 'HOSPITAL' }
    },
    include: {
      interacciones: true
    }
  });

  if (clientes.length === 0) {
    console.log('No se encontró ningún cliente con "HOSPITAL" en el nombre/empresa.');
    return;
  }

  for (const cliente of clientes) {
    console.log(`\nCliente encontrado: ID ${cliente.id} | Empresa: "${cliente.empresa}"`);
    console.log(`  asignadoA: "${cliente.asignadoA}" | creadoPor: "${cliente.creadoPor}"`);
    console.log(`  Total interacciones: ${cliente.interacciones.length}`);

    // Reasignar cliente a Valentina
    await prisma.cliente.update({
      where: { id: cliente.id },
      data: {
        asignadoA: 'Valentina',
        creadoPor: 'Valentina'
      }
    });
    console.log(`  -> Cliente reasignado a Valentina (asignadoA y creadoPor).`);

    // Actualizar interacciones correspondientes a la fecha u observaciones
    for (const int of cliente.interacciones) {
      console.log(`  Interacción ID ${int.id}: fecha=${int.fecha}, usuario="${int.usuario}", tipo="${int.tipo}", obs="${int.observaciones || int.comentario || ''}"`);
      
      // Actualizar usuario de la interacción a Valentina
      await prisma.interaccion.update({
        where: { id: int.id },
        data: {
          usuario: 'Valentina'
        }
      });
      console.log(`    -> Interacción ${int.id} actualizada a usuario "Valentina".`);
    }
  }

  console.log('\n--- Actualización completada exitosamente ---');
}

main()
  .catch((e) => {
    console.error('Error actualizando cliente:', e);
  })
  .finally(() => prisma.$disconnect());
