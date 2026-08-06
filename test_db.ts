import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Inserting test client...');
  const newClient = await prisma.cliente.create({
    data: {
      codigo: 'CLI-TEST-001',
      empresa: 'Empresa de Prueba S.A.C.',
      ruc: '20123456789',
      direccion: 'Av. Test 123',
      tarifa: 'MT3',
      contacto: 'Juan Perez',
      telefono: '999888777',
      cargo: 'Gerente General',
      correo: 'juan@empresa.com',
      asignadoA: 'Admin',
      estado: 'Activo',
      prioridad: 'Alta',
      accion: 'Llamar',
      zona: 'Sur',
      semaforo: 'Verde',
      temperatura: 'Caliente',
      montoEstimado: 50000,
      probabilidad: 80,
      ventaProyectada: 40000,
      esClienteReal: true,
      etapaComercial: 'Cotización', // Initially in Quote stage
    }
  });
  console.log('Inserted client:', newClient.id);

  console.log('Updating client to Ganado / Fidelizado...');
  const updatedClient = await prisma.cliente.update({
    where: { id: newClient.id },
    data: {
      etapaComercial: 'Ganado / Fidelizado'
    }
  });
  
  console.log('Success! Client is now in stage:', updatedClient.etapaComercial);
  
  // Cleanup
  await prisma.cliente.delete({ where: { id: newClient.id } });
  console.log('Test client removed.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
