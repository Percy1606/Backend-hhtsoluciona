import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFacturaDto } from './dto/create-factura.dto';
import { UpdateFacturaDto } from './dto/update-factura.dto';
import { CreatePagoDto } from './dto/create-pago.dto';
import { CreateGastoDto } from './dto/create-gasto.dto';
import {
  TipoGasto,
  ClasificacionFinanciera,
  CategoriaDistribucion,
  EstadoGasto,
} from '@prisma/client';
import { deletePhysicalFiles } from '../common/utils/file-utils';

@Injectable()
export class FinanzasService {
  constructor(private prisma: PrismaService) {}

  private async checkCajaAccess(
    cajaId: string,
    usuarioId: string,
    actionLabel = 'operar',
  ) {
    const dbCaja = await this.prisma.caja.findUnique({
      where: { id: cajaId },
    });
    if (dbCaja?.esProtegida) {
      throw new BadRequestException(
        `ESTA CAJA ESTÁ BLOQUEADA (Bóveda Blindada). No se permite ${actionLabel} hasta que sea desbloqueada por Gerencia General.`,
      );
    }
    return dbCaja;
  }

  private async triggerIncomeSync(
    tx: any,
    facturaId: string,
    cajaId: string | undefined,
    monto: number,
    usuarioId: string,
    concepto: string,
  ) {
    console.log(
      `[SALDOS-SYNC] Iniciando sincronización de ingreso. Factura: ${facturaId}, Monto: ${monto}`,
    );

    const targetCajaId =
      cajaId && cajaId !== '' ? cajaId : (await tx.caja.findFirst())?.id;

    if (!targetCajaId) {
      console.error(
        `[SALDOS-SYNC] ERROR: No se encontró ninguna caja para el ingreso.`,
      );
      throw new BadRequestException(
        'No hay ninguna caja configurada para recibir este pago.',
      );
    }

    const dbCaja = await tx.caja.findUnique({ where: { id: targetCajaId } });
    if (!dbCaja) {
      throw new BadRequestException('La caja de destino no existe.');
    }

    if (dbCaja.esProtegida) {
      throw new BadRequestException(
        'Esta caja está BLOQUEADA (Bóveda Blindada). No se permiten ingresos automáticos aquí.',
      );
    }

    // 1. Crear Pago
    await tx.pago.create({
      data: {
        facturaId,
        cajaId: targetCajaId,
        monto,
        metodo: 'TRANSFERENCIA',
        fechaPago: new Date(),
        registradoPorId: usuarioId,
        observaciones: 'Sincronización automática de saldo',
      } as any,
    });

    // 2. Aumentar Saldo
    const nuevoReal = Number(dbCaja.saldoReal) + monto;
    await tx.caja.update({
      where: { id: targetCajaId },
      data: {
        saldoReal: nuevoReal,
        saldoDisponible: nuevoReal - Number(dbCaja.saldoComprometido),
      },
    });

    // 3. Auditoría
    await tx.transaccionCaja.create({
      data: {
        cajaId: targetCajaId,
        tipo: 'INGRESO' as any,
        monto,
        concepto,
        referenciaTipo: 'FACTURA',
        referenciaId: facturaId,
        usuarioId,
        saldoRealPrevio: Number(dbCaja.saldoReal),
        saldoRealNuevo: nuevoReal,
      } as any,
    });

    console.log(
      `[SALDOS-SYNC] ✅ Sincronización exitosa en caja: ${dbCaja.nombre}. Nuevo Saldo: ${nuevoReal}`,
    );
  }

  private async handleLogisticsAutomation(
    tx: any,
    gasto: any,
    usuarioId: string,
  ) {
    if (!gasto.ordenCompraId) return;

    const orden = await tx.ordenCompra.update({
      where: { id: gasto.ordenCompraId },
      data: { estado: 'RECIBIDO' },
      include: { items: { include: { insumo: true } } },
    });

    for (const item of orden.items) {
      await tx.insumo.update({
        where: { id: item.insumoId },
        data: { stockActual: { increment: item.cantidad } },
      });

      await tx.movimientoAlmacen.create({
        data: {
          insumoId: item.insumoId,
          tipo: 'ENTRADA',
          cantidad: item.cantidad,
          costoUnitarioHistorico: Number(item.precioUnitario),
          motivo: `Compra OC: ${orden.codigo}`,
          usuarioId,
          ordenCompraId: orden.id,
          proyectoId: gasto.proyectoId || null,
        } as any,
      });
    }
  }

  // ============================================
  // FACTURAS
  // ============================================

  async createFactura(dto: CreateFacturaDto, usuarioId: string) {
    const montoTotal = Number(dto.montoTotal || 0);

    if (!dto.fechaVencimiento) {
      throw new BadRequestException('La fecha de vencimiento es obligatoria');
    }

    let saldoPendiente =
      dto.saldoPendiente !== undefined
        ? Number(dto.saldoPendiente)
        : montoTotal;

    if (dto.estado === 'PAGADA') {
      saldoPendiente = 0;
    }

    const shouldApplyAdelantos =
      dto.proyectoId &&
      dto.proyectoId !== 'none' &&
      dto.estado !== 'PAGADA' &&
      !dto.isManual;

    return this.prisma.$transaction(async (tx) => {
      if (shouldApplyAdelantos) {
        const adelantos = await tx.adelantoProyecto.findMany({
          where: {
            proyectoId: dto.proyectoId || undefined,
            saldoDisponible: { gt: 0 },
          },
          orderBy: { fechaRecibido: 'asc' },
        });

        let montoParaAplicar = montoTotal;
        for (const atraso of adelantos) {
          if (montoParaAplicar <= 0) break;

          const saldoDisponible = Number(atraso.saldoDisponible);
          const aplicar = Math.min(montoParaAplicar, saldoDisponible);

          await tx.adelantoProyecto.update({
            where: { id: atraso.id },
            data: {
              montoAplicado: Number(atraso.montoAplicado) + aplicar,
              saldoDisponible: saldoDisponible - aplicar,
            },
          });

          montoParaAplicar -= aplicar;
        }
        saldoPendiente = montoParaAplicar;
      }

      let estadoFinal = dto.estado || 'PENDIENTE';

      if (estadoFinal === 'PAGADA') {
        saldoPendiente = 0;
      } else if (saldoPendiente <= 0 && montoTotal > 0) {
        estadoFinal = 'PAGADA';
      } else if (saldoPendiente < montoTotal && montoTotal > 0) {
        estadoFinal = 'PAGO_PARCIAL';
      } else {
        estadoFinal = 'PENDIENTE';
      }

      const factura = await tx.factura.create({
        data: {
          codigo: dto.codigo,
          clienteId: dto.clienteId,
          proyectoId:
            dto.proyectoId === 'none' || !dto.proyectoId
              ? null
              : dto.proyectoId,
          cotizacionId: dto.cotizacionId || null,
          clasificacion: dto.clasificacion || 'VENTA_SERVICIO',
          montoSubtotal: Number(dto.montoSubtotal || 0),
          montoIgv: Number(dto.montoIgv || 0),
          montoTotal: Number(montoTotal),
          saldoPendiente: Number(saldoPendiente),
          fechaEmision: dto.fechaEmision
            ? new Date(dto.fechaEmision)
            : new Date(),
          fechaVencimiento: new Date(dto.fechaVencimiento),
          estado: estadoFinal,
          observaciones: dto.observaciones || null,
          archivoUrl: dto.archivoUrl || null,
          esRecurrente: !!dto.esRecurrente,
          frecuencia: dto.frecuencia || null,
        } as any,
        include: { cliente: true, proyecto: true },
      });

      if (factura.estado === 'PAGADA') {
        await this.triggerIncomeSync(
          tx,
          factura.id,
          dto.cajaId,
          Number(factura.montoTotal),
          usuarioId,
          `Ingreso Directo Factura: ${factura.codigo}`,
        );
      }

      return factura;
    });
  }

  async findAllFacturas(filters?: any) {
    const where: any = {};
    if (filters?.clienteId) where.clienteId = filters.clienteId;
    if (filters?.proyectoId) where.proyectoId = filters.proyectoId;
    if (filters?.estado) where.estado = filters.estado;

    const facturas = await this.prisma.factura.findMany({
      where,
      include: {
        cliente: { select: { id: true, empresa: true, ruc: true } },
        proyecto: { select: { id: true, nombre: true, codigo: true } },
      },
      orderBy: { fechaEmision: 'desc' },
    });

    const saldosPendientes = await this.prisma.factura.findMany({
      where: {
        estado: { in: ['PENDIENTE', 'PAGO_PARCIAL', 'VENCIDA'] as any },
        saldoPendiente: { gt: 0 },
      },
      select: { clienteId: true, saldoPendiente: true, id: true },
    });

    return facturas.map((f) => {
      const saldoOtras = saldosPendientes
        .filter((p) => p.clienteId === f.clienteId && p.id !== f.id)
        .reduce((acc, p) => acc + Number(p.saldoPendiente || 0), 0);

      const saldoActualFactura =
        f.estado === 'ANULADA' ? 0 : Number(f.saldoPendiente || 0);
      const saldoTotalCliente =
        Math.round((saldoActualFactura + saldoOtras) * 100) / 100;

      return {
        ...f,
        saldoAnterior: Math.round(saldoOtras * 100) / 100,
        totalAcumulado:
          Math.round((Number(f.montoTotal) + saldoOtras) * 100) / 100,
        saldoTotalCliente: saldoTotalCliente,
      };
    });
  }

  async findOneFactura(id: string) {
    const factura = await this.prisma.factura.findUnique({
      where: { id },
      include: {
        cliente: true,
        proyecto: true,
        pagos: { include: { caja: true } },
      },
    });
    if (!factura) throw new NotFoundException('Factura no encontrada');

    const otrasFacturas = await this.prisma.factura.findMany({
      where: {
        clienteId: factura.clienteId,
        id: { not: factura.id },
        estado: { in: ['PENDIENTE', 'PAGO_PARCIAL', 'VENCIDA'] as any },
        saldoPendiente: { gt: 0 },
      },
      select: { saldoPendiente: true },
    });

    const saldoAnterior = otrasFacturas.reduce(
      (acc, f) => acc + Number(f.saldoPendiente || 0),
      0,
    );

    return {
      ...factura,
      saldoAnterior: Math.round(saldoAnterior * 100) / 100,
      totalAcumulado:
        Math.round((Number(factura.saldoPendiente) + saldoAnterior) * 100) /
        100,
    };
  }

  async updateFactura(id: string, dto: UpdateFacturaDto, usuarioId: string) {
    const currentFactura = await this.prisma.factura.findUnique({
      where: { id },
      include: { pagos: true },
    });
    if (!currentFactura) throw new NotFoundException('Factura no encontrada');

    if (currentFactura.estado === 'ANULADA') {
      throw new BadRequestException('No se puede modificar una factura ANULADA');
    }
    if (currentFactura.estado === 'PAGADA') {
      throw new BadRequestException('No se puede modificar una factura PAGADA. Use la opción de registrar pago.');
    }

    const data: any = {};
    if (dto.codigo !== undefined) data.codigo = dto.codigo;
    if (dto.clienteId !== undefined) data.clienteId = dto.clienteId;
    if (dto.proyectoId !== undefined) data.proyectoId = dto.proyectoId;
    if (dto.cotizacionId !== undefined) data.cotizacionId = dto.cotizacionId;
    if (dto.clasificacion !== undefined) data.clasificacion = dto.clasificacion;
    if (dto.montoSubtotal !== undefined)
      data.montoSubtotal = Number(dto.montoSubtotal);
    if (dto.montoIgv !== undefined) data.montoIgv = Number(dto.montoIgv);
    if (dto.montoTotal !== undefined) data.montoTotal = Number(dto.montoTotal);
    if (dto.observaciones !== undefined) data.observaciones = dto.observaciones;
    if (dto.archivoUrl !== undefined) data.archivoUrl = dto.archivoUrl;
    if (dto.esRecurrente !== undefined) data.esRecurrente = dto.esRecurrente;
    if (dto.frecuencia !== undefined) data.frecuencia = dto.frecuencia;
    if (dto.proximaFacturacion !== undefined)
      data.proximaFacturacion = dto.proximaFacturacion
        ? new Date(dto.proximaFacturacion)
        : null;
    if (dto.estado !== undefined) data.estado = dto.estado;

    const fechaEmision = dto.fechaEmision;
    const fechaVencimiento = dto.fechaVencimiento;
    if (fechaEmision) data.fechaEmision = new Date(fechaEmision);
    if (fechaVencimiento) data.fechaVencimiento = new Date(fechaVencimiento);

    const total =
      dto.montoTotal !== undefined
        ? Number(dto.montoTotal)
        : Number(currentFactura.montoTotal);

    if (dto.estado === 'PAGADA') {
      data.saldoPendiente = 0;
      data.estado = 'PAGADA'; // Forzamos estado
    } else if (dto.saldoPendiente !== undefined) {
      data.saldoPendiente = Math.round(Number(dto.saldoPendiente) * 100) / 100;
    } else if (dto.montoTotal !== undefined) {
      const pagosTotal = currentFactura.pagos.reduce(
        (acc, p) => acc + Number(p.monto || 0),
        0,
      );
      data.saldoPendiente =
        Math.round((Number(dto.montoTotal) - pagosTotal) * 100) / 100;
    }

    let goingToPaid = false;
    if (data.saldoPendiente !== undefined) {
      if (data.saldoPendiente <= 0) { data.estado = 'PAGADA'; goingToPaid = true; }
      else if (data.saldoPendiente < total) data.estado = 'PAGO_PARCIAL';
    }

    // LÓGICA DE SINCRONIZACIÓN DE SALDO AL PASAR A PAGADA
    const transitioningToPaid =
      (currentFactura.estado as string) !== 'PAGADA' && goingToPaid;

    if (transitioningToPaid) {
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.factura.update({ where: { id }, data });

        const pagosPrevios = currentFactura.pagos.reduce((acc, p) => acc + Number(p.monto), 0);
        const montoARegistrar = Math.max(0, Number(updated.montoTotal) - pagosPrevios);

        if (montoARegistrar > 0) {
          await this.triggerIncomeSync(
            tx,
            id,
            dto.cajaId,
            montoARegistrar,
            usuarioId,
            `Cobranza Automática Factura: ${updated.codigo}`,
          );
        }
        return updated;
      });
    }

    return this.prisma.factura.update({ where: { id }, data });
  }

  async deleteFactura(id: string) {
    console.log(`[ANULACIÓN] Iniciando proceso para factura ID: ${id}`);

    const factura = await this.prisma.factura.findUnique({
      where: { id },
      include: { pagos: true },
    });
    if (!factura) throw new NotFoundException('Factura no encontrada');

    console.log(
      `[ANULACIÓN] Factura actual - Estado: ${factura.estado}, Pagos: ${factura.pagos.length}`,
    );

    // Si ya está anulada, no hacemos nada
    if (factura.estado === 'ANULADA') {
      console.log(`[ANULACIÓN] La factura ya está ANULADA, no se hace nada`);
      return factura;
    }

    // Se obtendrán los pagos antes de la transacción para revertir caja
    const pagosFactura = factura.pagos;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. REVERTIR SALDO EN CAJA por cada pago (conserva historial de pagos)
      for (const pago of pagosFactura) {
        const dbCaja = await tx.caja.findUnique({ where: { id: pago.cajaId } });
        if (dbCaja) {
          const nuevoReal = Number(dbCaja.saldoReal) - Number(pago.monto);
          await tx.caja.update({
            where: { id: pago.cajaId },
            data: {
              saldoReal: nuevoReal,
              saldoDisponible: nuevoReal - Number(dbCaja.saldoComprometido),
            },
          });
          await tx.transaccionCaja.create({
            data: {
              cajaId: pago.cajaId,
              tipo: 'EGRESO' as any,
              monto: Number(pago.monto),
              concepto: `ANULACIÓN Factura: ${factura.codigo}`,
              referenciaTipo: 'FACTURA',
              referenciaId: id,
              usuarioId: 'system',
              saldoRealPrevio: Number(dbCaja.saldoReal),
              saldoRealNuevo: nuevoReal,
            } as any,
          });
        }
      }

      // 2. MARCAR COMO ANULADA (pagos conservados en historial)
      console.log(`[ANULACIÓN] Marcando factura como ANULADA (pagos preservados, caja revertida)...`);
      const updatedFactura = await tx.factura.update({
        where: { id },
        data: {
          estado: 'ANULADA',
          saldoPendiente: 0,
        },
      });
      console.log(
        `[ANULACIÓN] Factura ${updatedFactura.codigo} marcada ANULADA. ${pagosFactura.length} pago(s) revertido(s) de caja.`,
      );

      return updatedFactura;
    });
  }

  // ============================================
  // PAGOS / COBRANZAS
  // ============================================

  async registerPago(dto: CreatePagoDto, usuarioId: string) {
    const facturaPrincipal = await this.prisma.factura.findUnique({
      where: { id: dto.facturaId },
    });
    if (!facturaPrincipal) throw new NotFoundException('Factura no encontrada');
    if (facturaPrincipal.estado === 'ANULADA') {
      throw new BadRequestException('No se puede registrar pago en una factura ANULADA');
    }

    const targetCajaId = dto.cajaId || (await this.prisma.caja.findFirst())?.id;
    if (!targetCajaId)
      throw new BadRequestException('No hay cajas configuradas');

    const dbCajaAccess = await this.checkCajaAccess(targetCajaId, usuarioId);

    return this.prisma.$transaction(async (tx) => {
      const dbCaja = await tx.caja.findUnique({ where: { id: targetCajaId } });
      if (!dbCaja) throw new NotFoundException('Caja no encontrada');

      let montoRestante = Math.round(dto.monto * 100) / 100;
      const pago = await tx.pago.create({
        data: {
          ...dto,
          cajaId: targetCajaId,
          registradoPorId: usuarioId,
          fechaPago: dto.fechaPago ? new Date(dto.fechaPago) : new Date(),
        } as any,
      });

      const saldoPrincipal = Number(facturaPrincipal.saldoPendiente);
      const aplicarAPrincipal = Math.min(montoRestante, saldoPrincipal);
      const nuevoSaldoPrincipal =
        Math.round((saldoPrincipal - aplicarAPrincipal) * 100) / 100;

      await tx.factura.update({
        where: { id: facturaPrincipal.id },
        data: {
          saldoPendiente: nuevoSaldoPrincipal,
          estado:
            nuevoSaldoPrincipal <= 0
              ? 'PAGADA'
              : 'PAGO_PARCIAL',
        },
      });

      // Registrar ingreso en la caja seleccionada
      if (dbCaja) {
        const nuevoReal = Number(dbCaja.saldoReal) + Number(pago.monto);
        await tx.caja.update({
          where: { id: targetCajaId },
          data: {
            saldoReal: nuevoReal,
            saldoDisponible: nuevoReal - Number(dbCaja.saldoComprometido),
          },
        });
        await tx.transaccionCaja.create({
          data: {
            cajaId: targetCajaId,
            tipo: 'INGRESO' as any,
            monto: Number(pago.monto),
            concepto: `Cobranza Factura: ${facturaPrincipal.codigo}`,
            referenciaTipo: 'FACTURA',
            referenciaId: facturaPrincipal.id,
            usuarioId,
            saldoRealPrevio: Number(dbCaja.saldoReal),
            saldoRealNuevo: nuevoReal,
          } as any,
        });
      }

      montoRestante =
        Math.round((montoRestante - aplicarAPrincipal) * 100) / 100;

      if (montoRestante > 0) {
        const otrasFacturas = await tx.factura.findMany({
          where: {
            clienteId: facturaPrincipal.clienteId,
            id: { not: facturaPrincipal.id },
            estado: { in: ['PENDIENTE', 'PAGO_PARCIAL', 'VENCIDA'] as any },
          },
          orderBy: { fechaEmision: 'asc' },
        });

        for (const f of otrasFacturas) {
          if (montoRestante <= 0) break;
          const saldoF = Number(f.saldoPendiente);
          const aplicar = Math.min(montoRestante, saldoF);
          const nuevoSaldo = Math.round((saldoF - aplicar) * 100) / 100;

          await tx.factura.update({
            where: { id: f.id },
            data: {
              saldoPendiente: nuevoSaldo,
              estado:
                nuevoSaldo <= 0
                  ? 'PAGADA'
                  : 'PAGO_PARCIAL',
            },
          });

          await tx.pago.create({
            data: {
              facturaId: f.id,
              cajaId: targetCajaId,
              monto: aplicar,
              metodo: dto.metodo,
              referencia: `Excedente de ${facturaPrincipal.id}`,
              fechaPago: dto.fechaPago ? new Date(dto.fechaPago) : new Date(),
              registradoPorId: usuarioId,
              observaciones: `Pago automático aplicado`,
            } as any,
          });
          montoRestante = Math.round((montoRestante - aplicar) * 100) / 100;
        }
      }
      return pago;
    });
  }

  // ============================================
  // GASTOS
  // ============================================

  async createGasto(dto: CreateGastoDto, usuarioId: string) {
    const targetCajaId = dto.cajaId || (await this.prisma.caja.findFirst())?.id;

    if (targetCajaId) {
      await this.checkCajaAccess(targetCajaId, usuarioId, 'realizar gastos');
    }

    await this.checkAvailability(
      Number(dto.montoTotal),
      targetCajaId || undefined,
    );
    const data: any = {
      ...dto,
      registradoPorId: usuarioId,
      fechaEmision: new Date(dto.fechaEmision),
      fechaVencimiento: dto.fechaVencimiento
        ? new Date(dto.fechaVencimiento)
        : null,
      saldoPendiente: Number(dto.montoTotal),
    };

    if (data.proveedorId === '') data.proveedorId = null;
    if (data.proyectoId === '') data.proyectoId = null;
    if (data.ordenCompraId === '') data.ordenCompraId = null;
    if (data.cajaId === '') data.cajaId = null;

    return this.prisma.$transaction(async (tx) => {
      const gasto = await tx.gasto.create({
        data,
        include: { proveedor: true, proyecto: true },
      });

      if (gasto.estado === 'PENDIENTE') {
        await this.blockFunds(
          Number(gasto.montoTotal),
          `Reserva: ${gasto.concepto}`,
          'GASTO',
          gasto.id,
          usuarioId,
          targetCajaId || undefined,
          tx,
        );
      } else if (gasto.estado === 'PAGADO') {
        await this.executeExpense(
          Number(gasto.montoTotal),
          `Gasto: ${gasto.concepto}`,
          'GASTO',
          gasto.id,
          usuarioId,
          targetCajaId || undefined,
          false,
          tx,
        );
        await this.handleLogisticsAutomation(tx, gasto, usuarioId);
      }
      return gasto;
    });
  }

  async findAllGastos(page: number = 1, limit: number = 20, filters?: any) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.gasto.findMany({
        where: filters,
        include: {
          proveedor: { select: { razonSocial: true, ruc: true } },
          proyecto: { select: { nombre: true, codigo: true } },
        },
        orderBy: { fechaEmision: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.gasto.count({ where: filters }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateGasto(id: string, dto: any, usuarioId?: string) {
    const currentGasto = await this.prisma.gasto.findUnique({ where: { id } });
    if (!currentGasto) throw new NotFoundException('Gasto no encontrado');

    const data: any = { ...dto };
    if (dto.fechaEmision) data.fechaEmision = new Date(dto.fechaEmision);
    if (dto.fechaVencimiento)
      data.fechaVencimiento = new Date(dto.fechaVencimiento);

    if (data.proveedorId === '') data.proveedorId = null;
    if (data.proyectoId === '') data.proyectoId = null;
    if (data.ordenCompraId === '') data.ordenCompraId = null;
    if (data.cajaId === '') data.cajaId = null;

    return this.prisma.$transaction(async (tx) => {
      const updatedGasto = await tx.gasto.update({
        where: { id },
        data,
      });

      if (currentGasto.estado === 'PENDIENTE' && data.estado === 'PAGADO') {
        await this.executeExpense(
          Number(updatedGasto.montoTotal),
          `Pago: ${updatedGasto.concepto}`,
          'GASTO',
          updatedGasto.id,
          usuarioId || updatedGasto.registradoPorId,
          updatedGasto.cajaId ?? undefined,
          true, // wasCommitted = true, esto liberará el saldo comprometido
          tx,
        );

        await this.handleLogisticsAutomation(
          tx,
          updatedGasto,
          usuarioId || updatedGasto.registradoPorId,
        );
      }
      return updatedGasto;
    });
  }

  async deleteGasto(id: string, usuarioId?: string) {
    const gasto = await this.prisma.gasto.findUnique({
      where: { id },
      include: { pagos: true },
    });
    if (!gasto) throw new NotFoundException('Gasto no encontrado');

    // Si ya está anulado, no hacemos nada
    if (gasto.estado === 'ANULADO') return gasto;

    // Recolectar URLs de comprobantes de pagos
    const urlsToDelete = gasto.pagos
      .map((p) => p.comprobanteUrl)
      .filter(Boolean);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. ELIMINAR LOS REGISTROS DE PAGO
      await tx.pago.deleteMany({ where: { gastoId: id } });

      // 2. MARCAR COMO ANULADO
      return tx.gasto.update({
        where: { id },
        data: {
          estado: 'ANULADO',
          saldoPendiente: 0,
        },
      });
    });

    // 3. Borrar archivos físicos
    await deletePhysicalFiles(urlsToDelete);

    return result;
  }

  // ============================================
  // CAJA (CRUD)
  // ============================================

  async createCaja(dto: any) {
    const { nombre, tipo, saldoReal, esProtegida } = dto;
    return this.prisma.caja.create({
      data: {
        nombre,
        tipo,
        esProtegida: esProtegida || false,
        saldoReal: Number(saldoReal || 0),
        saldoDisponible: Number(saldoReal || 0),
        saldoComprometido: 0,
      },
    });
  }

  async updateCaja(id: string, dto: any, usuarioId: string) {
    const current = await this.prisma.caja.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Caja no encontrada');

    if (current.esProtegida) {
      const user = await this.prisma.usuario.findUnique({
        where: { id: usuarioId },
      });
      if (user?.rol !== 'ADMIN') {
        await this.checkCajaAccess(id, usuarioId, 'modificar esta bóveda');
      }
    }

    const { nombre, tipo, saldoReal, motivoAjuste, esProtegida } = dto;
    const updateData: any = {};
    if (nombre) updateData.nombre = nombre;
    if (tipo) updateData.tipo = tipo;
    if (esProtegida !== undefined) updateData.esProtegida = esProtegida;

    // Si se ajusta el saldo manualmente, creamos una transacción de ajuste
    if (
      saldoReal !== undefined &&
      Number(saldoReal) !== Number(current.saldoReal)
    ) {
      const nuevoReal = Number(saldoReal);
      const diferencia = nuevoReal - Number(current.saldoReal);

      updateData.saldoReal = nuevoReal;
      updateData.saldoDisponible =
        nuevoReal - Number(current.saldoComprometido);

      await this.prisma.transaccionCaja.create({
        data: {
          cajaId: id,
          tipo: 'AJUSTE' as any,
          monto: Math.abs(diferencia),
          concepto: `Ajuste manual: ${motivoAjuste || 'Sin motivo'}`,
          usuarioId,
          saldoRealPrevio: Number(current.saldoReal),
          saldoRealNuevo: nuevoReal,
        } as any,
      });
    }

    return this.prisma.caja.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteCaja(id: string) {
    const count = await this.prisma.caja.count();
    if (count <= 1)
      throw new BadRequestException(
        'No puedes eliminar la última caja del sistema',
      );

    // Solo permitir eliminar si no tiene transacciones o saldo
    const caja = await this.prisma.caja.findUnique({
      where: { id },
      include: { _count: { select: { transacciones: true } } },
    });

    if (caja?._count.transacciones && caja._count.transacciones > 0) {
      throw new BadRequestException(
        'No se puede eliminar una caja con historial de movimientos. Considere desactivarla.',
      );
    }

    return this.prisma.caja.delete({ where: { id } });
  }

  async transferFunds(dto: any, usuarioId: string) {
    const { origenId, destinoId, monto, concepto } = dto;
    const montoNum = Number(monto);

    if (origenId === destinoId)
      throw new BadRequestException(
        'La cuenta de origen y destino no pueden ser la misma.',
      );
    if (montoNum <= 0)
      throw new BadRequestException(
        'El monto de transferencia debe ser mayor a cero.',
      );

    await this.checkCajaAccess(
      origenId,
      usuarioId,
      'transferir desde esta cuenta',
    );
    await this.checkCajaAccess(
      destinoId,
      usuarioId,
      'transferir hacia esta cuenta',
    );

    return this.prisma.$transaction(async (tx) => {
      const origen = await tx.caja.findUnique({ where: { id: origenId } });
      const destino = await tx.caja.findUnique({ where: { id: destinoId } });

      if (!origen || !destino)
        throw new NotFoundException('Una de las cuentas no existe.');
      if (Number(origen.saldoDisponible) < montoNum)
        throw new BadRequestException(
          `Fondos insuficientes en ${origen.nombre}.`,
        );

      // 1. Descontar de Origen
      const nuevoRealOrigen = Number(origen.saldoReal) - montoNum;
      await tx.caja.update({
        where: { id: origenId },
        data: {
          saldoReal: nuevoRealOrigen,
          saldoDisponible: nuevoRealOrigen - Number(origen.saldoComprometido),
        },
      });

      // 2. Aumentar en Destino
      const nuevoRealDestino = Number(destino.saldoReal) + montoNum;
      await tx.caja.update({
        where: { id: destinoId },
        data: {
          saldoReal: nuevoRealDestino,
          saldoDisponible: nuevoRealDestino - Number(destino.saldoComprometido),
        },
      });

      // 3. Registrar Transacciones de Auditoría
      await tx.transaccionCaja.create({
        data: {
          cajaId: origenId,
          tipo: 'EGRESO' as any,
          monto: montoNum,
          concepto: `TRANSFERENCIA SALIENTE: ${concepto || 'Traspaso de fondos'} -> ${destino.nombre}`,
          usuarioId,
          saldoRealPrevio: Number(origen.saldoReal),
          saldoRealNuevo: nuevoRealOrigen,
        } as any,
      });

      await tx.transaccionCaja.create({
        data: {
          cajaId: destinoId,
          tipo: 'INGRESO' as any,
          monto: montoNum,
          concepto: `TRANSFERENCIA ENTRANTE: ${concepto || 'Traspaso de fondos'} <- ${origen.nombre}`,
          usuarioId,
          saldoRealPrevio: Number(destino.saldoReal),
          saldoRealNuevo: nuevoRealDestino,
        } as any,
      });

      return { success: true };
    });
  }

  async findAllCajas(user?: any) {
    const where: any = {};

    // Si el usuario no es ADMIN, solo ve cajas NO protegidas
    if (user && user.rol !== 'ADMIN') {
      where.esProtegida = false;
    }

    return this.prisma.caja.findMany({
      where,
      include: { _count: { select: { transacciones: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  async findCajaTransactions(cajaId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.transaccionCaja.findMany({
        where: { cajaId },
        orderBy: { fecha: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaccionCaja.count({ where: { cajaId } }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async deleteTransaction(id: string, usuarioId: string) {
    const transaccion = await this.prisma.transaccionCaja.findUnique({
      where: { id },
    });
    if (!transaccion) throw new NotFoundException('Transacción no encontrada');

    const result = await this.prisma.$transaction(async (tx) => {
      const dbCaja = await tx.caja.findUnique({
        where: { id: transaccion.cajaId },
      });
      if (!dbCaja) throw new NotFoundException('Caja no encontrada');

      const refType = transaccion.referenciaTipo;
      const refId = transaccion.referenciaId;

      // SI ES FACTURA O GASTO, EL USUARIO NO QUIERE REVERTIR EL DINERO EN CAJA
      // Solo quiere que el movimiento desaparezca y la factura/gasto se anule.
      const isFacturaOrGasto = refType === 'FACTURA' || refType === 'GASTO';

      if (!isFacturaOrGasto) {
        // Revertir el efecto del saldo según el tipo de transacción (Solo para otros tipos)
        let nuevoReal = Number(dbCaja.saldoReal);
        let nuevoComprometido = Number(dbCaja.saldoComprometido);
        const tipo = transaccion.tipo as any;

        if (tipo === 'INGRESO') {
          nuevoReal -= Number(transaccion.monto);
        } else if (tipo === 'EGRESO') {
          nuevoReal += Number(transaccion.monto);
        } else if (tipo === 'AJUSTE') {
          const diff =
            Number(transaccion.saldoRealNuevo) -
            Number(transaccion.saldoRealPrevio);
          nuevoReal -= diff;
        } else if (tipo === 'BLOQUEO') {
          nuevoComprometido = Math.max(
            0,
            nuevoComprometido - Number(transaccion.monto),
          );
        } else if (tipo === 'LIBERACION') {
          nuevoComprometido = nuevoComprometido + Number(transaccion.monto);
        }

        // Actualizar la caja con los saldos revertidos
        await tx.caja.update({
          where: { id: dbCaja.id },
          data: {
            saldoReal: nuevoReal,
            saldoComprometido: nuevoComprometido,
            saldoDisponible: nuevoReal - nuevoComprometido,
          },
        });
      }

      // 2. LÓGICA DE ELIMINACIÓN COORDINADA
      console.log(
        `[AUDITORÍA] Iniciando eliminación coordinada para ${refType} ID: ${refId}`,
      );

      const urlsToDelete: string[] = [];

      if (refId) {
        if (refType === 'FACTURA') {
          // 1. Borrar el pago vinculado
          const pagos = await tx.pago.findMany({
            where: {
              facturaId: refId,
              cajaId: transaccion.cajaId,
              monto: transaccion.monto,
            },
            select: { comprobanteUrl: true },
          });
          pagos.forEach((p: any) => {
            if (p.comprobanteUrl) urlsToDelete.push(p.comprobanteUrl);
          });

          await tx.pago.deleteMany({
            where: {
              facturaId: refId,
              cajaId: transaccion.cajaId,
              monto: transaccion.monto,
            },
          });

          // 2. MARCAR COMO ANULADA (En lugar de recalcular saldo pendiente)
          await tx.factura.update({
            where: { id: refId },
            data: {
              estado: 'ANULADA',
              saldoPendiente: 0,
            },
          });
          console.log(`[AUDITORÍA] Factura ${refId} marcada como ANULADA.`);
        } else if (refType === 'GASTO') {
          // 1. Borrar pagos de gastos si existen
          const pagos = await tx.pago.findMany({
            where: {
              gastoId: refId,
              cajaId: transaccion.cajaId,
              monto: transaccion.monto,
            },
            select: { comprobanteUrl: true },
          });
          pagos.forEach((p: any) => {
            if (p.comprobanteUrl) urlsToDelete.push(p.comprobanteUrl);
          });

          await tx.pago.deleteMany({
            where: {
              gastoId: refId,
              cajaId: transaccion.cajaId,
              monto: transaccion.monto,
            },
          });

          // 2. Revertir estado del gasto a ANULADO
          await tx.gasto.update({
            where: { id: refId },
            data: {
              estado: 'ANULADO',
              saldoPendiente: 0,
            },
          });
          console.log(`[AUDITORÍA] Gasto ${refId} marcado como ANULADO.`);
        } else if (refType === 'ADELANTO') {
          // Borrado total del adelanto e inyección de capital
          const adelanto = await tx.adelantoProyecto.findUnique({
            where: { id: refId },
            select: { comprobanteUrl: true },
          });
          if (adelanto?.comprobanteUrl)
            urlsToDelete.push(adelanto.comprobanteUrl);

          await tx.adelantoProyecto.delete({ where: { id: refId } });
          console.log(`[AUDITORÍA] Adelanto eliminado por completo.`);
        }
      }

      console.log(`[AUDITORÍA] Proceso de eliminación finalizado.`);

      // Eliminar la transacción físicamente de la caja
      await tx.transaccionCaja.delete({ where: { id } });

      return { success: true, urlsToDelete };
    });

    if (result.urlsToDelete && result.urlsToDelete.length > 0) {
      await deletePhysicalFiles(result.urlsToDelete);
    }

    return result;
  }

  async ensureDefaultCaja() {
    const count = await this.prisma.caja.count();
    if (count === 0) {
      return this.prisma.caja.create({
        data: {
          nombre: 'Caja Principal',
          tipo: 'EFECTIVO',
          saldoReal: 10000,
          saldoDisponible: 10000,
        },
      });
    }
  }

  async checkAvailability(monto: number, cajaId?: string) {
    const targetCajaId = cajaId || (await this.prisma.caja.findFirst())?.id;
    if (!targetCajaId) return true;
    const caja = await this.prisma.caja.findUnique({
      where: { id: targetCajaId },
    });
    if (!caja) throw new NotFoundException('Caja no encontrada');
    if (Number(caja.saldoDisponible) < monto)
      throw new BadRequestException('Fondos insuficientes');
    return true;
  }

  async blockFunds(
    monto: number,
    concepto: string,
    refType: string,
    refId: string,
    usuarioId: string,
    cajaId?: string,
    txClient?: any,
  ) {
    const targetCajaId = cajaId || (await this.prisma.caja.findFirst())?.id;
    if (!targetCajaId) return;

    await this.checkCajaAccess(targetCajaId, usuarioId, 'bloquear fondos');

    const execute = async (tx: any) => {
      const dbCaja = await tx.caja.findUnique({ where: { id: targetCajaId } });
      if (!dbCaja) return;
      const nuevoComprometido = Number(dbCaja.saldoComprometido) + monto;
      await tx.caja.update({
        where: { id: targetCajaId },
        data: {
          saldoComprometido: nuevoComprometido,
          saldoDisponible: Number(dbCaja.saldoReal) - nuevoComprometido,
        },
      });
      await tx.transaccionCaja.create({
        data: {
          cajaId: targetCajaId,
          tipo: 'BLOQUEO' as any,
          monto,
          concepto,
          referenciaTipo: refType,
          referenciaId: refId,
          usuarioId,
          saldoRealPrevio: Number(dbCaja.saldoReal),
          saldoRealNuevo: Number(dbCaja.saldoReal),
        } as any,
      });
    };

    if (txClient) return execute(txClient);
    return this.prisma.$transaction(execute);
  }

  async releaseFunds(
    monto: number,
    concepto: string,
    refType: string,
    refId: string,
    usuarioId: string,
    cajaId?: string,
    txClient?: any,
  ) {
    const targetCajaId = cajaId || (await this.prisma.caja.findFirst())?.id;
    if (!targetCajaId) return;

    await this.checkCajaAccess(targetCajaId, usuarioId, 'liberar fondos');

    const execute = async (tx: any) => {
      const dbCaja = await tx.caja.findUnique({ where: { id: targetCajaId } });
      if (!dbCaja) return;
      const nuevoComprometido = Math.max(
        0,
        Number(dbCaja.saldoComprometido) - monto,
      );
      await tx.caja.update({
        where: { id: targetCajaId },
        data: {
          saldoComprometido: nuevoComprometido,
          saldoDisponible: Number(dbCaja.saldoReal) - nuevoComprometido,
        },
      });
      await tx.transaccionCaja.create({
        data: {
          cajaId: targetCajaId,
          tipo: 'LIBERACION' as any,
          monto,
          concepto,
          referenciaTipo: refType,
          referenciaId: refId,
          usuarioId,
          saldoRealPrevio: Number(dbCaja.saldoReal),
          saldoRealNuevo: Number(dbCaja.saldoReal),
        } as any,
      });
    };

    if (txClient) return execute(txClient);
    return this.prisma.$transaction(execute);
  }

  async executeExpense(
    monto: number,
    concepto: string,
    refType: string,
    refId: string,
    usuarioId: string,
    cajaId?: string,
    wasCommitted = false,
    txClient?: any,
  ) {
    const targetCajaId = cajaId || (await this.prisma.caja.findFirst())?.id;
    if (!targetCajaId) return;

    await this.checkCajaAccess(targetCajaId, usuarioId, 'ejecutar egresos');

    const execute = async (tx: any) => {
      const dbCaja = await tx.caja.findUnique({ where: { id: targetCajaId } });
      if (!dbCaja) return;

      let finalConcepto = concepto;
      if (refType === 'GASTO') {
        const dbGasto = await tx.gasto.findUnique({
          where: { id: refId },
          include: { proyecto: true },
        });
        if (dbGasto?.proyecto) {
          finalConcepto = `${concepto} [PROY: ${dbGasto.proyecto.codigo || dbGasto.proyecto.nombre}]`;
        }
      }

      const nuevoReal = Number(dbCaja.saldoReal) - monto;
      let nuevoComprometido = Number(dbCaja.saldoComprometido);
      if (wasCommitted)
        nuevoComprometido = Math.max(0, nuevoComprometido - monto);
      await tx.caja.update({
        where: { id: targetCajaId },
        data: {
          saldoReal: nuevoReal,
          saldoComprometido: nuevoComprometido,
          saldoDisponible: nuevoReal - nuevoComprometido,
        },
      });
      await tx.transaccionCaja.create({
        data: {
          cajaId: targetCajaId,
          tipo: 'EGRESO' as any,
          monto,
          concepto: finalConcepto,
          referenciaTipo: refType,
          referenciaId: refId,
          usuarioId,
          saldoRealPrevio: Number(dbCaja.saldoReal),
          saldoRealNuevo: nuevoReal,
        } as any,
      });
    };

    if (txClient) return execute(txClient);
    return this.prisma.$transaction(execute);
  }

  // ============================================
  // ADELANTOS
  // ============================================

  async findAllAdelantos(proyectoId?: string) {
    return this.prisma.adelantoProyecto.findMany({
      where: proyectoId ? { proyectoId } : {},
      include: { proyecto: { select: { nombre: true, codigo: true } } },
      orderBy: { fechaRecibido: 'desc' },
    });
  }

  async createAdelanto(dto: any, usuarioId: string) {
    const { distribuciones, cajaId, ...adelantoData } = dto;
    const targetCajaId = cajaId || (await this.prisma.caja.findFirst())?.id;

    if (targetCajaId) {
      await this.checkCajaAccess(targetCajaId, usuarioId, 'inyectar capital');
    }

    return this.prisma.$transaction(async (tx) => {
      const adelanto = await tx.adelantoProyecto.create({
        data: {
          ...adelantoData,
          montoAplicado: 0,
          saldoDisponible: Number(adelantoData.monto),
          registradoPorId: usuarioId,
          fechaRecibido: adelantoData.fechaRecibido
            ? new Date(adelantoData.fechaRecibido)
            : new Date(),
          distribuciones: distribuciones
            ? {
                create: distribuciones.map((d: any) => ({
                  categoria: d.categoria,
                  montoAsignado: Number(d.monto),
                  montoGastado: 0,
                  saldoDisponible: Number(d.monto),
                })),
              }
            : undefined,
        },
      });

      if (targetCajaId) {
        const dbCaja = await tx.caja.findUnique({
          where: { id: targetCajaId },
        });
        if (dbCaja) {
          const nuevoReal =
            Number(dbCaja.saldoReal) + Number(adelantoData.monto);
          await tx.caja.update({
            where: { id: targetCajaId },
            data: {
              saldoReal: nuevoReal,
              saldoDisponible: nuevoReal - Number(dbCaja.saldoComprometido),
            },
          });
          await tx.transaccionCaja.create({
            data: {
              cajaId: targetCajaId,
              tipo: 'INGRESO' as any,
              monto: Number(adelantoData.monto),
              concepto: `Adelanto Proyecto`,
              referenciaTipo: 'ADELANTO',
              referenciaId: adelanto.id,
              usuarioId,
              saldoRealPrevio: Number(dbCaja.saldoReal),
              saldoRealNuevo: nuevoReal,
            } as any,
          });
        }
      }
      return adelanto;
    });
  }

  async getProjectDistribution(proyectoId: string) {
    const d = await this.prisma.distribucionAdelanto.findMany({
      where: { adelanto: { proyectoId } },
    });
    const c: any = {};
    d.forEach((x) => {
      if (!c[x.categoria])
        c[x.categoria] = {
          categoria: x.categoria,
          montoAsignado: 0,
          montoGastado: 0,
          saldoDisponible: 0,
        };
      c[x.categoria].montoAsignado += Number(x.montoAsignado);
      c[x.categoria].montoGastado += Number(x.montoGastado);
      c[x.categoria].saldoDisponible += Number(x.saldoDisponible);
    });
    return Object.values(c);
  }

  // ============================================
  // REPORTES
  // ============================================

  async getGlobalKPIs() {
    const [clients, projects, facturas, pagos] = await Promise.all([
      this.prisma.cliente.count({ where: { deletedAt: null } }),
      this.prisma.proyecto.count({ where: { estado: 'EnEjecucion' as any } }),
      this.prisma.factura.findMany({
        where: { estado: { not: 'ANULADA' } },
        select: { montoTotal: true },
      }),
      this.prisma.pago.aggregate({ _sum: { monto: true } }),
    ]);
    const totalFacturado = facturas.reduce(
      (acc, f) => acc + Number(f.montoTotal),
      0,
    );
    const totalCobrado = Number(pagos._sum.monto || 0);
    return {
      totalClientes: clients,
      proyectosActivos: projects,
      totalFacturado,
      totalCobrado,
      porcentajeCobranza:
        totalFacturado > 0 ? (totalCobrado / totalFacturado) * 100 : 0,
    };
  }

  async getDashboardStats(mes?: number, anio?: number) {
    const today = new Date();
    const targetAnio = anio || today.getFullYear();
    const targetMes = mes !== undefined ? mes : today.getMonth() + 1;

    const startOfMonth = new Date(targetAnio, targetMes - 1, 1);
    const endOfMonth = new Date(targetAnio, targetMes, 0, 23, 59, 59);

    const [facturas, pagos, gastos] = await Promise.all([
      this.prisma.factura.findMany({
        where: { estado: { not: 'ANULADA' } },
        include: { cliente: true, proyecto: true },
      }),
      this.prisma.pago.findMany({
        where: { fechaPago: { gte: startOfMonth, lte: endOfMonth } },
      }),
      this.prisma.gasto.findMany({
        where: { estado: { not: 'ANULADO' } },
      }),
    ]);

    // Estadísticas del mes actual
    const totalFacturadoMes = facturas
      .filter((f) => f.fechaEmision >= startOfMonth && f.fechaEmision <= endOfMonth)
      .reduce((acc, f) => acc + Number(f.montoTotal), 0);
    
    const totalCobradoMes = pagos.reduce((acc, p) => acc + Number(p.monto), 0);
    
    const totalGastosPagadosMes = gastos
      .filter((g) => g.estado === 'PAGADO' && g.fechaPago && g.fechaPago >= startOfMonth && g.fechaPago <= endOfMonth)
      .reduce((acc, g) => acc + Number(g.montoTotal), 0);

    // Totales acumulados (para las cards de la UI)
    const totalFacturado = facturas.reduce((acc, f) => acc + Number(f.montoTotal), 0);
    const totalCobrado = facturas.reduce((acc, f) => {
      const sumPagos = (f as any).pagos?.reduce((s: number, p: any) => s + Number(p.monto), 0) || 0;
      // Nota: Si no incluimos pagos en la consulta principal, usamos aggregate o el saldo pendiente
      return acc + (Number(f.montoTotal) - Number(f.saldoPendiente));
    }, 0);

    const totalGastosPagados = gastos
      .filter((g) => g.estado === 'PAGADO')
      .reduce((acc, g) => acc + Number(g.montoTotal), 0);
    
    const totalGastosPendientes = gastos
      .filter((g) => g.estado === 'PENDIENTE')
      .reduce((acc, g) => acc + Number(g.montoTotal), 0);

    const facturasCriticas = facturas.filter(
      (f) =>
        (f.estado === 'PENDIENTE' || f.estado === 'PAGO_PARCIAL' || f.estado === 'VENCIDA') &&
        new Date(f.fechaVencimiento) < today &&
        Number(f.saldoPendiente) > 0,
    );

    const utilidadNeta = totalCobrado - totalGastosPagados;

    return {
      totalFacturado,
      totalCobrado,
      totalPendiente: totalFacturado - totalCobrado,
      totalGastosPagados,
      totalGastosPendientes,
      utilidadNeta,
      margenNeto: totalCobrado > 0 ? Number(((utilidadNeta / totalCobrado) * 100).toFixed(1)) : 0,
      facturasPendientes: facturas.filter((x) => x.estado === 'PENDIENTE').length,
      facturasParciales: facturas.filter((x) => x.estado === 'PAGO_PARCIAL').length,
      facturasVencidas: facturasCriticas.length,
      crecimientoIngresos: 0, // Mock para la UI por ahora
      crecimientoEgresos: 0,   // Mock para la UI por ahora
      facturasCriticas: facturasCriticas.map((f) => ({
        id: f.id,
        codigo: f.codigo,
        cliente: f.cliente.empresa,
        proyecto: f.proyecto?.nombre || 'Venta Directa',
        saldo: Number(f.saldoPendiente),
        diasVencidos: Math.ceil(
          (today.getTime() - new Date(f.fechaVencimiento).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      })).sort((a, b) => b.diasVencidos - a.diasVencidos),
    };
  }

  async getExecutiveDashboard() {
    const [cajas, facturas, gastos, proyectos] = await Promise.all([
      this.prisma.caja.findMany(),
      this.prisma.factura.findMany({
        where: {
          estado: { in: ['PENDIENTE', 'PAGO_PARCIAL', 'VENCIDA'] as any },
        },
        include: { cliente: true },
      }),
      this.prisma.gasto.findMany({ where: { estado: 'PENDIENTE' } }),
      this.prisma.proyecto.findMany({
        where: { estado: 'EnEjecucion' as any },
        include: {
          facturas: { where: { estado: { not: 'ANULADA' } } },
          gastos: { where: { estado: { not: 'ANULADO' } } },
          movimientosAlmacen: {
            where: { tipo: 'SALIDA' },
            include: { insumo: true },
          },
        },
      }),
    ]);

    const disponible = cajas.reduce(
      (acc, x) => acc + Number(x.saldoDisponible),
      0,
    );
    const porCobrar = facturas.reduce(
      (acc, x) => acc + Number(x.saldoPendiente),
      0,
    );
    const porPagar = gastos.reduce((acc, x) => acc + Number(x.montoTotal), 0);

    const hoy = new Date();
    const facturasCriticas = facturas.filter(
      (f) => new Date(f.fechaVencimiento) < hoy,
    ).length;

    // Calcular rentabilidad por proyecto para el TOP
    const rentabilidadProyectos = proyectos
      .map((p) => {
        const ing = p.facturas.reduce(
          (sum, f) => sum + Number(f.montoTotal),
          0,
        );
        const eg = p.gastos.reduce((sum, g) => sum + Number(g.montoTotal), 0);
        const mat = p.movimientosAlmacen.reduce(
          (sum, m) =>
            sum + Number(m.cantidad) * Number(m.insumo?.precioReferencial || 0),
          0,
        );
        const utilidad = ing - (eg + mat);
        const rentabilidad = ing > 0 ? Number(((utilidad / ing) * 100).toFixed(1)) : 0;
        return {
          id: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          utilidad,
          rentabilidad,
        };
      })
      .sort((a, b) => b.rentabilidad - a.rentabilidad)
      .slice(0, 5);

    return {
      resumenCaja: { disponible },
      cartera: { porCobrar, porPagar, facturasCriticas },
      proyectos: { topRentabilidad: rentabilidadProyectos },
      indicadores: {
        saludFinanciera: disponible > porPagar ? 'ESTABLE' : 'CRÍTICA',
        ratioLiquidez:
          porPagar > 0 ? Number((disponible / porPagar).toFixed(2)) : disponible > 0 ? 99 : 0,
      },
    };
  }

  async getProjectProfitability(proyectoId: string) {
    const p = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
      include: {
        facturas: {
          where: { estado: { not: 'ANULADA' } },
          include: { pagos: true },
        },
        gastos: {
          where: { estado: { not: 'ANULADO' } },
          include: {
            ordenCompra: {
              include: {
                items: {
                  include: { insumo: true }
                }
              }
            }
          }
        },
        adelantos: true,
        cotizacionOrigen: { select: { monto: true } },
      },
    });
    if (!p) throw new NotFoundException('Proyecto no encontrado');

    const montoCotizado = Number(
      p.cotizacionOrigen?.monto || p.costoPresupuestado || 0,
    );

    // Extraer materiales de las Órdenes de Compra vinculadas a los gastos del proyecto
    const materialesDetallados = p.gastos
      .filter(g => g.ordenCompra)
      .flatMap(g => g.ordenCompra!.items.map(item => ({
        id: item.id,
        nombre: item.insumo?.nombre || 'Insumo sin nombre',
        cantidad: Number(item.cantidad),
        unidad: item.insumo?.unidadMedida || 'Und',
        precioUnitario: Number(item.precioUnitario),
        subtotal: Number(item.subtotal),
        fecha: g.fechaEmision,
        proveedor: g.proveedorId, // Opcional: podrías incluir el nombre del proveedor si lo necesitas
        ocCodigo: g.ordenCompra!.codigo
      })));

    // Ingresos: Facturado vs Cobrado
    const totalFacturado = p.facturas.reduce(
      (acc, f) => acc + Number(f.montoTotal),
      0,
    );
    
    const totalCobradoFacturas = p.facturas.reduce(
      (acc, f) => acc + f.pagos.reduce((sum, pago) => sum + Number(pago.monto), 0),
      0,
    );

    const totalAdelantos = p.adelantos.reduce(
      (acc, a) => acc + Number(a.monto),
      0,
    );

    const totalMateriales = materialesDetallados.reduce((acc, m) => acc + m.subtotal, 0);

    // Egresos: Gastos directos vinculados al proyecto
    const totalGastosPagados = p.gastos
      .filter((g) => g.estado === 'PAGADO')
      .reduce((acc, g) => acc + Number(g.montoTotal), 0);

    const totalGastosPendientes = p.gastos
      .filter((g) => g.estado === 'PENDIENTE')
      .reduce((acc, g) => acc + Number(g.montoTotal), 0);

    const costoTotalReal = totalGastosPagados;
    const costoTotalProyectado = totalGastosPagados + totalGastosPendientes;

    return {
      proyectoId: p.id,
      nombre: p.nombre,
      codigo: p.codigo,
      montoCotizado,
      financiero: {
        totalFacturado,
        totalCobradoFacturas,
        totalAdelantos,
        totalIngresosReales: totalCobradoFacturas + totalAdelantos,
      },
      egresos: {
        totalGastosPagados,
        totalGastosPendientes,
        costoTotalReal,
        costoTotalProyectado,
        materiales: totalMateriales,
        gastosDirectos: totalGastosPagados - totalMateriales,
      },
      utilidad: totalFacturado - costoTotalReal,
      rentabilidad:
        totalFacturado > 0
          ? ((totalFacturado - costoTotalReal) / totalFacturado) * 100
          : 0,
      presupuestoExcedido: costoTotalProyectado > montoCotizado && montoCotizado > 0,
      historialMateriales: materialesDetallados.map(m => ({
        material: m.nombre,
        cantidad: m.cantidad,
        costoTotal: m.subtotal,
        fecha: m.fecha,
        origen: m.ocCodigo
      })),
      historialGastos: p.gastos.map((g) => ({
        fecha: g.fechaEmision,
        concepto: g.concepto,
        monto: Number(g.montoTotal),
        estado: g.estado,
        codigo: g.codigo,
        tipo: g.tipo,
        ocCodigo: g.ordenCompra?.codigo
      })),
      facturas: p.facturas.map((f) => ({
        id: f.id,
        codigo: f.codigo,
        montoTotal: Number(f.montoTotal),
        saldoPendiente: Number(f.saldoPendiente),
        estado: f.estado,
        fechaEmision: f.fechaEmision,
      })),
    };
  }

  async getCashFlowData(mes?: number, anio?: number) {
    const today = new Date();
    const targetAnio = anio || today.getFullYear();
    
    // Generar los 12 meses del año o los meses hasta hoy
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    
    const cashFlow = await Promise.all(
      months.map(async (m) => {
        const startOfMonth = new Date(targetAnio, m - 1, 1);
        const endOfMonth = new Date(targetAnio, m, 0, 23, 59, 59);

        const [ingresos, egresos] = await Promise.all([
          this.prisma.pago.aggregate({
            where: {
              fechaPago: {
                gte: startOfMonth,
                lte: endOfMonth,
              },
            },
            _sum: { monto: true },
          }),
          this.prisma.gasto.aggregate({
            where: {
              estado: 'PAGADO',
              fechaPago: {
                gte: startOfMonth,
                lte: endOfMonth,
              },
            },
            _sum: { montoTotal: true },
          }),
        ]);

        const nombresMeses = [
          'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
          'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
        ];

        return {
          month: nombresMeses[m - 1],
          ingresos: Number(ingresos._sum?.monto || 0),
          egresos: Number(egresos._sum?.montoTotal || 0),
        };
      })
    );

    return cashFlow;
  }
}
