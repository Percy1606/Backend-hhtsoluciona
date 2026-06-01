import 'dotenv/config';
import { PrismaClient, Area as PrismaArea, EstadoActividad as PrismaEstadoActividad, EstadoProyecto as PrismaEstadoProyecto, EstadoValidacion as PrismaEstadoValidacion, Prioridad as PrismaPrioridad, Semaforo as PrismaSemaforo, TipoActividad as PrismaTipoActividad, TipoDocumento as PrismaTipoDocumento, TipoValidacion as PrismaTipoValidacion } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as bcrypt from 'bcrypt';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not defined in the environment variables.');
}
const adapter = new PrismaMariaDb(databaseUrl);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`Start seeding with new areas ...`);

  await prisma.usuario.deleteMany();
  await prisma.indicadorAvance.deleteMany();
  await prisma.historialCambio.deleteMany();
  await prisma.entregable.deleteMany();
  await prisma.suboperacion.deleteMany();
  await prisma.documento.deleteMany();
  await prisma.planoDiseno.deleteMany();
  await prisma.ingenieriaDiseno.deleteMany();
  await prisma.evaluacionTecnica.deleteMany();
  await prisma.evidencia.deleteMany();
  await prisma.comentario.deleteMany();
  await prisma.subtarea.deleteMany();
  await prisma.validacionRequerida.deleteMany();
  await prisma.reporteDiario.deleteMany();
  await prisma.expedienteTecnico.deleteMany();
  await prisma.actividad.deleteMany();
  await prisma.proyecto.deleteMany();
  await prisma.responsable.deleteMany();

  // 1. Seed Responsables with new areas
  const responsables = [
    { id: 'resp_log', nombre: 'Steven (Logística)', area: PrismaArea.LogisticaYRecursos, cargo: 'Jefe de Logística', email: 'logistica@hht.com', color: 'bg-blue-500' },
    { id: 'resp_tec', nombre: 'Diego (Técnico)', area: PrismaArea.IngenieriaYSupervision, cargo: 'Ingeniero Senior', email: 'tecnico@hht.com', color: 'bg-green-500' },
    { id: 'resp_doc', nombre: 'Guillermo (Documentación)', area: PrismaArea.GestionDocumentaria, cargo: 'Gestor Documental', email: 'gestion@hht.com', color: 'bg-orange-500' },
    { id: 'resp_cam', nombre: 'Mario (Campo)', area: PrismaArea.OperacionesDeCampo, cargo: 'Supervisor de Campo', email: 'campo@hht.com', color: 'bg-purple-500' },
  ];

  for (const resp of responsables) {
    await prisma.responsable.create({
      data: {
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
  await prisma.usuario.create({
    data: {
      username: 'percy',
      password: hashedPassword,
      nombre: 'Percy',
      rol: 'ADMIN',
      responsable: { connect: { id: 'resp_cam' } }, // Vinculado a Mario (Campo)
    },
  });
  console.log(`Created user: percy`);

  // 2. Seed a sample project
  const proyecto = await prisma.proyecto.create({
    data: {
      id: 'PROJ-INIT-001',
      clientId: 'CLIENTE-BASE',
      codigo: 'HHT-OPE-26-001',
      nombre: 'Implementación Base del Sistema',
      descripcion: 'Proyecto inicial para validar la nueva estructura de áreas.',
      estado: PrismaEstadoProyecto.EnEjecucion,
      semaforo: PrismaSemaforo.Verde,
      prioridad: PrismaPrioridad.Media,
      fechaInicio: new Date(),
      fechaFinEstimada: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      responsablePrincipal: { connect: { id: 'resp_cam' } },
      area: PrismaArea.OperacionesDeCampo,
      avance: 10,
    },
  });
  console.log(`Created sample project: ${proyecto.nombre}`);

  console.log(`Seeding finished.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
