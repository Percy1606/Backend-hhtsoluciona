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
  const clientId = "c12e5fcc-916c-46f6-ba23-94df2373042e";
  const projectId = "17c6d08c-8429-40e9-93e2-4d748de5411e";
  const cotizacionId = "578e6d3e-2e6d-4614-a01d-4e208f6d85f4";

  try {
    console.log("Iniciando actualización a 14 de Abril de 2026...");

    // 1. Actualizar Cliente
    const updatedCliente = await prisma.cliente.update({
      where: { id: clientId },
      data: {
        fechaCreacion: new Date("2026-04-14T15:02:55.128Z"),
        fechaActualizacion: new Date("2026-04-14T15:09:13.775Z"),
        ultimoContacto: new Date("2026-04-14T15:09:13.772Z"),
      }
    });
    console.log("Cliente actualizado:", updatedCliente.empresa);

    // 2. Actualizar Cotización
    const updatedCotizacion = await prisma.cotizacion.update({
      where: { id: cotizacionId },
      data: {
        fecha: new Date("2026-04-14T00:00:00.000Z"),
        fechaCreacion: new Date("2026-04-14T15:04:24.791Z"),
        fechaActualizacion: new Date("2026-04-14T15:09:13.814Z"),
      }
    });
    console.log("Cotización actualizada:", updatedCotizacion.codigo);

    // 3. Actualizar Proyecto
    const updatedProyecto = await prisma.proyecto.update({
      where: { id: projectId },
      data: {
        fechaInicio: new Date("2026-04-14T15:09:13.810Z"),
        fechaFinEstimada: new Date("2026-05-14T15:09:13.810Z"),
        fechaCreacion: new Date("2026-04-14T15:09:13.814Z"),
      }
    });
    console.log("Proyecto actualizado:", updatedProyecto.codigo);

    console.log("¡Actualización exitosa completada!");
  } catch (err) {
    console.error("Error al actualizar la base de datos:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
