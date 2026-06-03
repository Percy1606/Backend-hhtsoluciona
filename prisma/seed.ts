import 'dotenv/config';
import { PrismaClient, Area as PrismaArea, EstadoActividad as PrismaEstadoActividad, EstadoProyecto as PrismaEstadoProyecto, EstadoValidacion as PrismaEstadoValidacion, Prioridad as PrismaPrioridad, Semaforo as PrismaSemaforo, TipoActividad as PrismaTipoActividad, TipoDocumento as PrismaTipoDocumento, EstadoDocumento as PrismaEstadoDocumento } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as bcrypt from 'bcrypt';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL not defined');
  
  const adapter = new PrismaMariaDb(databaseUrl);
  const prisma = new PrismaClient({ adapter });

  console.log('Seeding data...');

  // 1. Seed Responsables
  const responsablesData = [
    { id: 'resp_log', nombre: 'Steven', area: PrismaArea.LogisticaYRecursos, cargo: 'Logística', email: 'steven@example.com', color: '#3B82F6' },
    { id: 'resp_ing', nombre: 'Diego', area: PrismaArea.IngenieriaYSupervision, cargo: 'Ingeniero', email: 'diego@example.com', color: '#8B5CF6' },
    { id: 'resp_doc', nombre: 'Guillermo', area: PrismaArea.GestionDocumentaria, cargo: 'Gestor Documental', email: 'guillermo@example.com', color: '#10B981' },
    { id: 'resp_cam', nombre: 'Mario', area: PrismaArea.OperacionesDeCampo, cargo: 'Supervisor Campo', email: 'mario@example.com', color: '#F59E0B' },
  ];

  for (const resp of responsablesData) {
    await prisma.responsable.upsert({
      where: { id: resp.id },
      update: {},
      create: {
        id: resp.id,
        nombre: resp.nombre,
        area: resp.area,
        cargo: resp.cargo,
        email: resp.email,
        color: resp.color,
        activo: true,
      },
    });
    console.log(`Created responsable: ${resp.nombre}`);
  }

  // 1.5. Seed Usuario Percy
  const hashedPassword = await bcrypt.hash('123', 10);
  await prisma.usuario.upsert({
    where: { username: 'percy' },
    update: { password: hashedPassword, rol: 'ADMIN' },
    create: {
      username: 'percy',
      password: hashedPassword,
      nombre: 'Percy',
      rol: 'ADMIN',
      responsableId: 'resp_cam'
    },
  });
  console.log(`Created user: percy`);

  // 2. Seed a sample project
  await prisma.proyecto.upsert({
    where: { codigo: 'HHT-OPE-26-001' },
    update: {},
    create: {
      id: 'PROJ-INIT-001',
      clientId: '1', 
      codigo: 'HHT-OPE-26-001',
      nombre: 'Implementación Base del Sistema',
      descripcion: 'Proyecto inicial para validar la nueva estructura de áreas.',
      estado: PrismaEstadoProyecto.EnEjecucion,
      semaforo: PrismaSemaforo.Verde,
      prioridad: PrismaPrioridad.Media,
      fechaInicio: new Date(),
      fechaFinEstimada: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      responsablePrincipalId: 'resp_cam',
      area: PrismaArea.OperacionesDeCampo,
      avance: 10,
    },
  });
  console.log(`Created/Verified sample project`);

  console.log(`Seeding finished.`);
  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
