import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== INICIANDO ASENTAMIENTO DE CAJA CHICA - STEVEN (AGOSTO 2026) ===');

  const cajaSteven = await prisma.caja.findFirst({
    where: { nombre: { contains: 'Steven' } },
  });

  if (!cajaSteven) {
    throw new Error('No se encontró la Caja Chica de Steven.');
  }

  const stevenUser = await prisma.usuario.findFirst({
    where: { username: { contains: 'Steven' } },
  });

  const usuarioId = stevenUser ? stevenUser.id : '45d6a85d-88a6-473e-aa88-66931efd3ffd';
  const cajaId = cajaSteven.id;

  console.log(`Caja encontrada: ${cajaSteven.nombre} (${cajaId})`);

  // Proyectos clave
  const proyCosteno = await prisma.proyecto.findFirst({ where: { codigo: 'HHT-OPE-26-026' } });
  const proyBelen = await prisma.proyecto.findFirst({ where: { codigo: 'HHT-OPE-26-023' } });
  const proyEnosa = await prisma.proyecto.findFirst({ where: { codigo: 'HHT-OPE-26-004' } });

  console.log('Proyectos mapeados:');
  console.log(`- Costeño: ${proyCosteno?.codigo} (${proyCosteno?.id})`);
  console.log(`- Belén: ${proyBelen?.codigo} (${proyBelen?.id})`);
  console.log(`- Enosa: ${proyEnosa?.codigo} (${proyEnosa?.id})`);

  await prisma.$transaction(async (tx) => {
    // 1. Limpiar gastos existentes previos de agosto en esta caja
    const existingGastos = await tx.gasto.findMany({
      where: {
        cajaId,
        fechaEmision: { gte: new Date('2026-08-01T00:00:00.000Z') },
      },
    });

    for (const g of existingGastos) {
      await tx.transaccionCaja.deleteMany({
        where: { referenciaId: g.id },
      });
      await tx.gasto.delete({ where: { id: g.id } });
      console.log(`Eliminado gasto previo: ${g.concepto} (S/ ${g.montoTotal})`);
    }

    // 2. Limpiar transacciones de agosto de esta caja
    await tx.transaccionCaja.deleteMany({
      where: {
        cajaId,
        fecha: { gte: new Date('2026-08-01T00:00:00.000Z') },
      },
    });

    let saldoActual = 0;

    // 3. Ingreso 1: Saldo Caja Chica Julio 2026 -> S/ 1,113.60 (01/08/2026)
    const montoIngreso1 = 1113.60;
    const saldoPrevio1 = saldoActual;
    saldoActual += montoIngreso1;

    await tx.transaccionCaja.create({
      data: {
        cajaId,
        tipo: 'INGRESO',
        monto: montoIngreso1,
        concepto: 'SALDO INICIAL CAJA CHICA JULIO 2026',
        fecha: new Date('2026-08-01T08:00:00.000Z'),
        usuarioId,
        saldoRealPrevio: saldoPrevio1,
        saldoRealNuevo: saldoActual,
      },
    });
    console.log(`Ingreso 1 registrado: S/ ${montoIngreso1} -> Saldo: S/ ${saldoActual}`);

    // Definición de los 28 egresos con su fecha y proyecto
    const egresosData = [
      // 1
      { fecha: '2026-08-01T10:00:00.000Z', monto: 20.40, concepto: 'PAGO DE PEAJE IDA Y VUELTA SULLANA (INSPECCION PARA FACTIBILIDAD - CONTACTO DE MERINO ENOSA)', proyectoId: proyEnosa?.id || null, tipo: 'OPERATIVO', cat: 'LOGISTICA_MOVILIDAD' },
      // 2
      { fecha: '2026-08-02T09:00:00.000Z', monto: 120.00, concepto: 'PAGO A GRANDE POR DESMONTAJE DE ALMACEN FRANCIA', proyectoId: null, tipo: 'OPERATIVO', cat: 'MANO_OBRA' },
      // 3
      { fecha: '2026-08-02T11:00:00.000Z', monto: 35.00, concepto: 'PAGO A CRISTIAN POR LLEVAR Y TRAER CAMION CERRADO PARA PLOTEO', proyectoId: null, tipo: 'OPERATIVO', cat: 'LOGISTICA_MOVILIDAD' },
      // 4
      { fecha: '2026-08-04T08:30:00.000Z', monto: 50.00, concepto: 'PAGO A PAUL POR LIMPIEZA DE OFICINA DEL DIA 02/08/2026', proyectoId: null, tipo: 'ADMINISTRATIVO', cat: 'OPERATIVO_VARIO' },
      // 5
      { fecha: '2026-08-04T12:00:00.000Z', monto: 39.00, concepto: 'YAPE A CRISTIAN POR INSTALACION DE CAJA DE SEGURIDAD PARA BATERIA DE CAMIONES (SOLICITÓ JAVIER)', proyectoId: null, tipo: 'OPERATIVO', cat: 'OPERATIVO_VARIO' },
      // 6
      { fecha: '2026-08-05T10:00:00.000Z', monto: 80.00, concepto: 'YAPE A CRISTIAN PARA COMPRA DE CANDADOS Y MATERIALES PARA ASEGURAR BATERIA DE CAMIONES', proyectoId: null, tipo: 'OPERATIVO', cat: 'MATERIALES' },
      // 7
      { fecha: '2026-08-05T14:30:00.000Z', monto: 100.00, concepto: 'COMBUSTIBLE A DUSTER PARA MARIO Y GUILLERMO QUE FUERON A SULLANA A REVISAR TRANSFORMADOR QUE SE COMPRÓ', proyectoId: null, tipo: 'COMBUSTIBLE', cat: 'LOGISTICA_MOVILIDAD' },
      // 8
      { fecha: '2026-08-07T11:00:00.000Z', monto: 200.00, concepto: 'DEPOSITO A WASHINGTON POR ELABORACION DE INFORME DE IMPEDANCIA CLINICA BELEN (JAVIER SOLICITO)', proyectoId: proyBelen?.id || null, tipo: 'PROYECTO', cat: 'MANO_OBRA' },
      // 9
      { fecha: '2026-08-10T09:00:00.000Z', monto: 21.62, concepto: 'PAGO POR DOMINIO DE PROGRAMA DE HH', proyectoId: null, tipo: 'ADMINISTRATIVO', cat: 'OPERATIVO_VARIO' },
      // 10
      { fecha: '2026-08-10T09:30:00.000Z', monto: 91.00, concepto: 'PAGO DE SERVIDOR DE PROGRMA DE HH', proyectoId: null, tipo: 'ADMINISTRATIVO', cat: 'OPERATIVO_VARIO' },
      // 11
      { fecha: '2026-08-10T11:00:00.000Z', monto: 116.64, concepto: 'DEPOSITO DE IGV POR COTIZACION DE ANALISIS DE ACEITE DIELECTRICO PARA CLINICA BELEN (SOLICITO MELLANI)', proyectoId: proyBelen?.id || null, tipo: 'PROYECTO', cat: 'OPERATIVO_VARIO' },
      // 12
      { fecha: '2026-08-10T15:00:00.000Z', monto: 22.00, concepto: 'PAGO DE ENVIO DE MUESTRAS - CLINICA BELEN', proyectoId: proyBelen?.id || null, tipo: 'PROYECTO', cat: 'LOGISTICA_MOVILIDAD' },
      // 13
      { fecha: '2026-08-11T10:00:00.000Z', monto: 79.90, concepto: 'YAPE A MELLANI CHAT GPT (SOLICITÓ MELLANI)', proyectoId: null, tipo: 'ADMINISTRATIVO', cat: 'OPERATIVO_VARIO' },
      // 14
      { fecha: '2026-08-12T09:00:00.000Z', monto: 50.00, concepto: 'PAGO A PAUL POR LIMPIEZA DE OFICINA DEL DIA 09/08/2026 (SOLICITO MELLANI)', proyectoId: null, tipo: 'ADMINISTRATIVO', cat: 'OPERATIVO_VARIO' },
      // 15
      { fecha: '2026-08-12T11:30:00.000Z', monto: 14.00, concepto: 'COMPRA DE 4 GUANTES PARA CHARLA DE INDUCCION CON ENOSA', proyectoId: proyEnosa?.id || null, tipo: 'OPERATIVO', cat: 'MATERIALES' },
      // 16
      { fecha: '2026-08-14T10:00:00.000Z', monto: 48.60, concepto: 'PAGO INCLUSION SCTR A HUGO PARA MANTTO. COSTEÑO (SOLICITO MELLANI)', proyectoId: proyCosteno?.id || null, tipo: 'PROYECTO', cat: 'OPERATIVO_VARIO' },
    ];

    // Ejecutar primeros 16 egresos antes del segundo ingreso
    for (const item of egresosData) {
      const saldoPrevio = saldoActual;
      saldoActual -= item.monto;

      const gastoCreado = await tx.gasto.create({
        data: {
          concepto: item.concepto,
          montoTotal: item.monto,
          saldoPendiente: 0,
          proyectoId: item.proyectoId,
          cajaId,
          tipo: item.tipo as any,
          clasificacion: item.proyectoId ? 'PROYECTO' : 'VENTA_SERVICIO',
          categoriaDistribucion: item.cat as any,
          tipoComprobante: 'BOLETA',
          fechaEmision: new Date(item.fecha),
          fechaPago: new Date(item.fecha),
          estado: 'PAGADO',
          registradoPorId: usuarioId,
          justificacion: `[CAJA CHICA STEVEN] ${item.concepto}`,
          area: 'LogisticaYRecursos',
        },
      });

      await tx.transaccionCaja.create({
        data: {
          cajaId,
          tipo: 'EGRESO',
          monto: item.monto,
          concepto: item.concepto,
          referenciaTipo: 'GASTO',
          referenciaId: gastoCreado.id,
          fecha: new Date(item.fecha),
          usuarioId,
          saldoRealPrevio: saldoPrevio,
          saldoRealNuevo: saldoActual,
        },
      });
    }

    // 4. Ingreso 2: Fondeo Mellani S/ 1,500.00 (15/08/2026)
    const montoIngreso2 = 1500.00;
    const saldoPrevio2 = saldoActual;
    saldoActual += montoIngreso2;

    await tx.transaccionCaja.create({
      data: {
        cajaId,
        tipo: 'INGRESO',
        monto: montoIngreso2,
        concepto: 'CAJA CHICA MELLANI (FONDEO)',
        fecha: new Date('2026-08-15T08:00:00.000Z'),
        usuarioId,
        saldoRealPrevio: saldoPrevio2,
        saldoRealNuevo: saldoActual,
      },
    });
    console.log(`Ingreso 2 registrado: S/ ${montoIngreso2} -> Saldo: S/ ${saldoActual}`);

    // Egresos del 15 al 19 de agosto
    const egresosRestantes = [
      // 17
      { fecha: '2026-08-15T09:00:00.000Z', monto: 160.00, concepto: 'PAGO A HUGO POR MANTENIMIENTO DE TABLEROS (S/.140) - COSTEÑO (PASAJES IDA Y VUELTA) (S/.20)', proyectoId: proyCosteno?.id || null, tipo: 'PROYECTO', cat: 'MANO_OBRA' },
      // 18
      { fecha: '2026-08-15T09:30:00.000Z', monto: 312.00, concepto: 'PAGO A VARGAS POR INDUCCION DEL DIA JUEVES 13/08 (S/.100) Y SABADO 15/08 MANTTO. COSTEÑO (S/.200), (JAVIER SOLICITÓ QUE LE YAPEEN SU ALMUERZO)', proyectoId: proyCosteno?.id || null, tipo: 'PROYECTO', cat: 'MANO_OBRA' },
      // 19
      { fecha: '2026-08-15T10:00:00.000Z', monto: 212.00, concepto: 'PAGO A TECNICO MEJIA POR MANTENIMIENTO COSTEÑO Y ALMUERZO', proyectoId: proyCosteno?.id || null, tipo: 'PROYECTO', cat: 'MANO_OBRA' },
      // 20
      { fecha: '2026-08-15T10:30:00.000Z', monto: 212.00, concepto: 'PAGO A TECNICO SIANCAS POR MANTENIMIENTO COSTEÑO Y ALMUERZO', proyectoId: proyCosteno?.id || null, tipo: 'PROYECTO', cat: 'MANO_OBRA' },
      // 21
      { fecha: '2026-08-15T11:00:00.000Z', monto: 102.00, concepto: 'PAGO A PAUL POR MANTENIMIENTO COSTEÑO Y ALMUERZO', proyectoId: proyCosteno?.id || null, tipo: 'PROYECTO', cat: 'MANO_OBRA' },
      // 22
      { fecha: '2026-08-15T11:30:00.000Z', monto: 102.00, concepto: 'PAGO A GRANDE POR MANTENIMIENTO COSTEÑO Y ALMUERZO', proyectoId: proyCosteno?.id || null, tipo: 'PROYECTO', cat: 'MANO_OBRA' },
      // 23
      { fecha: '2026-08-15T12:00:00.000Z', monto: 102.00, concepto: 'PAGO A GUILLERMO PARDO POR MANTENIMIENTO COSTEÑO Y ALMUERZO', proyectoId: proyCosteno?.id || null, tipo: 'PROYECTO', cat: 'MANO_OBRA' },
      // 24
      { fecha: '2026-08-15T13:00:00.000Z', monto: 100.00, concepto: 'COMBUSTIBLE A CAMION DE BARANDAS PARA MANTENIMIENTO COSTEÑO', proyectoId: proyCosteno?.id || null, tipo: 'PROYECTO', cat: 'LOGISTICA_MOVILIDAD' },
      // 25
      { fecha: '2026-08-15T14:00:00.000Z', monto: 10.20, concepto: 'PEAJE IDA A SULLANA PARA MANTTO. COSTEÑO', proyectoId: proyCosteno?.id || null, tipo: 'PROYECTO', cat: 'LOGISTICA_MOVILIDAD' },
      // 26
      { fecha: '2026-08-15T18:00:00.000Z', monto: 10.20, concepto: 'PEAJE REGRESO A PIURA POR MANTTO. COSTEÑO', proyectoId: proyCosteno?.id || null, tipo: 'PROYECTO', cat: 'LOGISTICA_MOVILIDAD' },
      // 27
      { fecha: '2026-08-17T11:00:00.000Z', monto: 178.37, concepto: 'COMBUSTIBLE A CAMIONETA AZUL PARA VISITA FRIO FRIAS (GUILLERMO, ANGI Y MARIO)', proyectoId: null, tipo: 'COMBUSTIBLE', cat: 'LOGISTICA_MOVILIDAD' },
      // 28
      { fecha: '2026-08-19T10:00:00.000Z', monto: 50.00, concepto: 'COMBUSTIBLE A CAMIONETA DUSTER', proyectoId: null, tipo: 'COMBUSTIBLE', cat: 'LOGISTICA_MOVILIDAD' },
    ];

    for (const item of egresosRestantes) {
      const saldoPrevio = saldoActual;
      saldoActual -= item.monto;

      const gastoCreado = await tx.gasto.create({
        data: {
          concepto: item.concepto,
          montoTotal: item.monto,
          saldoPendiente: 0,
          proyectoId: item.proyectoId,
          cajaId,
          tipo: item.tipo as any,
          clasificacion: item.proyectoId ? 'PROYECTO' : 'VENTA_SERVICIO',
          categoriaDistribucion: item.cat as any,
          tipoComprobante: 'BOLETA',
          fechaEmision: new Date(item.fecha),
          fechaPago: new Date(item.fecha),
          estado: 'PAGADO',
          registradoPorId: usuarioId,
          justificacion: `[CAJA CHICA STEVEN] ${item.concepto}`,
          area: 'LogisticaYRecursos',
        },
      });

      await tx.transaccionCaja.create({
        data: {
          cajaId,
          tipo: 'EGRESO',
          monto: item.monto,
          concepto: item.concepto,
          referenciaTipo: 'GASTO',
          referenciaId: gastoCreado.id,
          fecha: new Date(item.fecha),
          usuarioId,
          saldoRealPrevio: saldoPrevio,
          saldoRealNuevo: saldoActual,
        },
      });
    }

    const saldoFinal = Number(saldoActual.toFixed(2));
    console.log(`Saldo final calculado: S/ ${saldoFinal}`);

    // Actualizar saldos finales de la caja
    await tx.caja.update({
      where: { id: cajaId },
      data: {
        saldoReal: saldoFinal,
        saldoDisponible: saldoFinal,
      },
    });

    // Actualizar costoTotalReal de los proyectos
    if (proyCosteno) {
      const totalGastosCosteno = await tx.gasto.aggregate({
        where: { proyectoId: proyCosteno.id, estado: 'PAGADO' },
        _sum: { montoTotal: true },
      });
      await tx.proyecto.update({
        where: { id: proyCosteno.id },
        data: { costoTotalReal: totalGastosCosteno._sum.montoTotal || 0 },
      });
    }

    if (proyBelen) {
      const totalGastosBelen = await tx.gasto.aggregate({
        where: { proyectoId: proyBelen.id, estado: 'PAGADO' },
        _sum: { montoTotal: true },
      });
      await tx.proyecto.update({
        where: { id: proyBelen.id },
        data: { costoTotalReal: totalGastosBelen._sum.montoTotal || 0 },
      });
    }

    if (proyEnosa) {
      const totalGastosEnosa = await tx.gasto.aggregate({
        where: { proyectoId: proyEnosa.id, estado: 'PAGADO' },
        _sum: { montoTotal: true },
      });
      await tx.proyecto.update({
        where: { id: proyEnosa.id },
        data: { costoTotalReal: totalGastosEnosa._sum.montoTotal || 0 },
      });
    }
  });

  console.log('=== CUADRE COMPLETADO EXITOSAMENTE ===');
}

main()
  .catch((e) => {
    console.error('Error al cuadrar caja:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
