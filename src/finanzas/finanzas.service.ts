import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CreateFacturaDto } from './dto/create-factura.dto';
import { UpdateFacturaDto } from './dto/update-factura.dto';
import { CreatePagoDto } from './dto/create-pago.dto';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { UpdateGastoDto } from './dto/update-gasto.dto';
import { CreateRendicionDto } from './dto/create-rendicion.dto';
import { CreateConfigAprobacionDto } from './dto/create-config-aprobacion.dto';
import { SubmitAprobacionDto } from './dto/submit-aprobacion.dto';
import {
  TipoGasto,
  ClasificacionFinanciera,
  CategoriaDistribucion,
  EstadoGasto,
  NivelAprobacion,
  EstadoRendicion,
  PrioridadGasto,
  Area,
} from '@prisma/client';
import { deletePhysicalFiles } from '../common/utils/file-utils';

@Injectable()
export class FinanzasService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

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

    // 4. PROVISIÓN AUTOMÁTICA
    await this.handleAutomaticProvision(
      tx,
      targetCajaId,
      monto,
      usuarioId,
      'FACTURA',
      facturaId,
    );

    console.log(
      `[SALDOS-SYNC] ✅ Sincronización exitosa en caja: ${dbCaja.nombre}. Nuevo Saldo: ${nuevoReal}`,
    );
  }

  private async handleAutomaticProvision(
    tx: any,
    cajaOrigenId: string,
    montoIngresado: number,
    usuarioId: string,
    referenciaTipo: string,
    referenciaId: string,
  ) {
    const cajaOrigen = await tx.caja.findUnique({ where: { id: cajaOrigenId } });
    if (!cajaOrigen || Number(cajaOrigen.porcentajeProvision) <= 0) return;

    const montoAhorro =
      Math.round(
        montoIngresado * (Number(cajaOrigen.porcentajeProvision) / 100) * 100,
      ) / 100;
    if (montoAhorro <= 0) return;

    // Buscar la caja de OBLIGACIONES principal
    const cajaDestino = await tx.caja.findFirst({
      where: { subtipo: 'OBLIGACIONES', esPrincipal: true },
    });

    if (!cajaDestino) {
      console.warn(
        '[PROVISIÓN] No se encontró una caja de OBLIGACIONES principal para el ahorro automático.',
      );
      return;
    }

    if (cajaOrigen.id === cajaDestino.id) return;

    console.log(
      `[PROVISIÓN] Iniciando provisión automática de ${montoAhorro} (${cajaOrigen.porcentajeProvision}%) desde ${cajaOrigen.nombre} hacia ${cajaDestino.nombre}`,
    );

    // Ejecutar transferencia interna
    // 1. Descontar de Origen
    const nuevoRealOrigen = Number(cajaOrigen.saldoReal) - montoAhorro;
    await tx.caja.update({
      where: { id: cajaOrigen.id },
      data: {
        saldoReal: nuevoRealOrigen,
        saldoDisponible: nuevoRealOrigen - Number(cajaOrigen.saldoComprometido),
      },
    });

    // 2. Aumentar en Destino
    const nuevoRealDestino = Number(cajaDestino.saldoReal) + montoAhorro;
    await tx.caja.update({
      where: { id: cajaDestino.id },
      data: {
        saldoReal: nuevoRealDestino,
        saldoDisponible:
          nuevoRealDestino - Number(cajaDestino.saldoComprometido),
      },
    });

    // 3. Registrar Transacciones de Auditoría
    await tx.transaccionCaja.create({
      data: {
        cajaId: cajaOrigen.id,
        tipo: 'EGRESO',
        monto: montoAhorro,
        concepto: `PROVISIÓN AUTOMÁTICA (${cajaOrigen.porcentajeProvision}%): Ahorro para Obligaciones`,
        referenciaTipo,
        referenciaId,
        usuarioId,
        saldoRealPrevio: Number(cajaOrigen.saldoReal),
        saldoRealNuevo: nuevoRealOrigen,
      } as any,
    });

    await tx.transaccionCaja.create({
      data: {
        cajaId: cajaDestino.id,
        tipo: 'INGRESO',
        monto: montoAhorro,
        concepto: `INGRESO POR PROVISIÓN: Ahorro desde ${cajaOrigen.nombre}`,
        referenciaTipo,
        referenciaId,
        usuarioId,
        saldoRealPrevio: Number(cajaDestino.saldoReal),
        saldoRealNuevo: nuevoRealDestino,
      } as any,
    });
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
  // UTILIDAD: Sincronización Directa de Ingreso (Desde otros módulos)
  // ============================================
  async sincronizarSaldoIngreso(
    tx: any,
    monto: number,
    cajaId: string,
    concepto: string,
    referenciaTipo: string,
    referenciaId: string,
    usuarioId: string
  ) {
    const dbCaja = await tx.caja.findUnique({ where: { id: cajaId } });
    
    if (!dbCaja) {
      throw new BadRequestException('La caja de destino no existe.');
    }

    if (dbCaja.esProtegida) {
      throw new BadRequestException(
        'Esta caja está BLOQUEADA (Bóveda Blindada). No se permiten ingresos automáticos aquí.',
      );
    }

    const nuevoReal = Number(dbCaja.saldoReal) + monto;
    
    await tx.caja.update({
      where: { id: cajaId },
      data: {
        saldoReal: nuevoReal,
        saldoDisponible: nuevoReal - Number(dbCaja.saldoComprometido),
      },
    });

    await tx.transaccionCaja.create({
      data: {
        cajaId: cajaId,
        tipo: 'INGRESO',
        monto: monto,
        concepto: concepto,
        referenciaTipo: referenciaTipo,
        referenciaId: referenciaId,
        usuarioId: usuarioId,
        saldoRealPrevio: Number(dbCaja.saldoReal),
        saldoRealNuevo: nuevoReal,
      },
    });
  }

  async sincronizarSaldoEgreso(
    tx: any,
    monto: number,
    cajaId: string,
    concepto: string,
    referenciaTipo: string,
    referenciaId: string,
    usuarioId: string
  ) {
    const dbCaja = await tx.caja.findUnique({ where: { id: cajaId } });
    
    if (!dbCaja) {
      throw new BadRequestException('La caja de origen no existe.');
    }

    if (dbCaja.esProtegida) {
      throw new BadRequestException(
        'Esta caja está BLOQUEADA (Bóveda Blindada). No se permiten egresos automáticos aquí.',
      );
    }

    if (Number(dbCaja.saldoDisponible) < monto) {
      throw new BadRequestException(
        `Saldo insuficiente en la caja "${dbCaja.nombre}" para realizar este ajuste negativo.`,
      );
    }

    const nuevoReal = Number(dbCaja.saldoReal) - monto;
    
    await tx.caja.update({
      where: { id: cajaId },
      data: {
        saldoReal: nuevoReal,
        saldoDisponible: nuevoReal - Number(dbCaja.saldoComprometido),
      },
    });

    await tx.transaccionCaja.create({
      data: {
        cajaId: cajaId,
        tipo: 'EGRESO',
        monto: monto,
        concepto: concepto,
        referenciaTipo: referenciaTipo,
        referenciaId: referenciaId,
        usuarioId: usuarioId,
        saldoRealPrevio: Number(dbCaja.saldoReal),
        saldoRealNuevo: nuevoReal,
      },
    });
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
          fechaEstimadaCobro: dto.fechaEstimadaCobro
            ? new Date(dto.fechaEstimadaCobro)
            : null,
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
    const fechaEstimadaCobro = dto.fechaEstimadaCobro;
    if (fechaEmision) data.fechaEmision = new Date(fechaEmision);
    if (fechaVencimiento) data.fechaVencimiento = new Date(fechaVencimiento);
    if (fechaEstimadaCobro !== undefined)
      data.fechaEstimadaCobro = fechaEstimadaCobro
        ? new Date(fechaEstimadaCobro)
        : null;

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

  async deleteFactura(id: string, motivo?: string) {
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

    const urlsToDelete = pagosFactura.map((p) => p.comprobanteUrl).filter(Boolean);

    // 1. Eliminar archivos físicos primero
    await deletePhysicalFiles(urlsToDelete);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. REVERTIR SALDO EN CAJA por cada pago (descuenta el monto cobrado)
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
        }
      }

      // 2. ELIMINAR TRANSACCIONES DE CAJA asociadas de la auditoría de historial
      console.log(`[ANULACIÓN] Eliminando transacciones de caja asociadas a la factura...`);
      await tx.transaccionCaja.deleteMany({
        where: {
          referenciaId: id,
          referenciaTipo: 'FACTURA',
        },
      });

      // 3. ELIMINAR PAGOS ASOCIADOS a la factura
      console.log(`[ANULACIÓN] Eliminando pagos asociados a la factura...`);
      await tx.pago.deleteMany({
        where: {
          facturaId: id,
        },
      });

      // 4. MARCAR COMO ANULADA
      console.log(`[ANULACIÓN] Marcando factura como ANULADA...`);
      const updatedFactura = await tx.factura.update({
        where: { id },
        data: {
          estado: 'ANULADA',
          saldoPendiente: 0,
        },
      });
      console.log(
        `[ANULACIÓN] Factura ${updatedFactura.codigo} marcada ANULADA. Saldo de caja revertido y transacciones/pagos eliminados del historial.`,
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

        // 4. PROVISIÓN AUTOMÁTICA
        await this.handleAutomaticProvision(
          tx,
          targetCajaId,
          Number(pago.monto),
          usuarioId,
          'FACTURA',
          facturaPrincipal.id,
        );
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
    // Buscar Caja Principal o PEN por defecto si no se especifica
    let targetCajaId = dto.cajaId;
    
    if (!targetCajaId || targetCajaId === 'none' || targetCajaId === '') {
      const preferredCaja = await this.prisma.caja.findFirst({
        where: { OR: [{ nombre: { contains: 'Principal' } }, { moneda: 'PEN' }] }
      });
      targetCajaId = preferredCaja?.id;
    }

    if (targetCajaId) {
      await this.checkCajaAccess(targetCajaId, usuarioId, 'realizar gastos');
    }

    const monto = Number(dto.montoTotal);
    const nivelAprobacion: NivelAprobacion = 'PENDIENTE_FINANZAS';

    const data: any = {
      ...dto,
      registradoPorId: usuarioId,
      solicitanteId: dto.solicitanteId || usuarioId,
      nivelAprobacion,
      fechaEmision: new Date(dto.fechaEmision),
      fechaVencimiento: dto.fechaVencimiento
        ? new Date(dto.fechaVencimiento)
        : null,
      fechaProgramadaPago: dto.fechaProgramadaPago
        ? new Date(dto.fechaProgramadaPago)
        : null,
      prioridad: dto.prioridad || 'MEDIA',
      saldoPendiente: monto,
      estado: 'PENDIENTE',
    };

    if (data.proveedorId === '') data.proveedorId = null;
    if (data.proyectoId === '') data.proyectoId = null;
    if (data.ordenCompraId === '') data.ordenCompraId = null;
    data.cajaId = (targetCajaId === '' || targetCajaId === 'none') ? null : targetCajaId;

    return this.prisma.$transaction(async (tx) => {
      const gasto = await tx.gasto.create({
        data,
        include: { proveedor: true, proyecto: true },
      });

      // Intentar bloquear fondos (solo si está aprobado o pagado directamente)
      if (gasto.estado === 'APROBADO' || gasto.estado === 'PAGADO') {
        await this.blockFunds(
          Number(gasto.montoTotal),
          `Reserva: ${gasto.concepto}`,
          'GASTO',
          gasto.id,
          usuarioId,
          targetCajaId || undefined,
          tx,
        );
      }
      
      if (gasto.proyectoId) {
        this.eventEmitter.emit('proyecto.costChanged', {
          proyectoId: gasto.proyectoId,
        });
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
    if (dto.fechaProgramadaPago)
      data.fechaProgramadaPago = new Date(dto.fechaProgramadaPago);
    if (dto.prioridad) data.prioridad = dto.prioridad;

    if (data.proveedorId === '') data.proveedorId = null;
    if (data.proyectoId === '') data.proyectoId = null;
    if (data.ordenCompraId === '') data.ordenCompraId = null;
    if (data.cajaId === '') data.cajaId = null;

    return this.prisma.$transaction(async (tx) => {
      const updatedGasto = await tx.gasto.update({
        where: { id },
        data,
      });

      if (
        (currentGasto.estado === 'PENDIENTE' || currentGasto.estado === 'SOLICITADO' || currentGasto.estado === 'APROBADO') && 
        data.estado === 'PAGADO'
      ) {
        const wasCommitted = currentGasto.estado === 'APROBADO'; // Solo los APROBADOS bloquearon fondos

        await this.executeExpense(
          Number(updatedGasto.montoTotal),
          `Pago: ${updatedGasto.concepto}`,
          'GASTO',
          updatedGasto.id,
          usuarioId || updatedGasto.registradoPorId,
          updatedGasto.cajaId ?? undefined,
          wasCommitted,
          tx,
        );

        await this.handleLogisticsAutomation(
          tx,
          updatedGasto,
          usuarioId || updatedGasto.registradoPorId,
        );
      }

      if (updatedGasto.proyectoId) {
        this.eventEmitter.emit('proyecto.costChanged', {
          proyectoId: updatedGasto.proyectoId,
        });
      }

      return updatedGasto;
    });
  }

  async approveGasto(id: string, usuarioId: string, cajaId?: string) {
    const gasto = await this.prisma.gasto.findUnique({
      where: { id },
      include: { proyecto: true },
    });
    if (!gasto) throw new NotFoundException('Gasto no encontrado');

    const user = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const isAdmin = user.rol === 'ADMIN';
    // SUPERVISOR, ADMIN o FINANZAS pueden actuar como Finanzas (Mellani)
    const canApproveFinanzas = user.rol === 'ADMIN' || user.rol === 'SUPERVISOR' || user.rol === 'FINANZAS';

    return this.prisma.$transaction(async (tx) => {
      const dataToUpdate: any = {};
      let needsBlocking = false;

      if (cajaId) {
        dataToUpdate.cajaId = cajaId;
      }

      if (gasto.nivelAprobacion === 'PENDIENTE_FINANZAS' || gasto.nivelAprobacion === 'PENDIENTE_GERENCIA') {
        if (!canApproveFinanzas) {
          throw new BadRequestException('No tienes permisos para aprobar solicitudes de fondos.');
        }
        dataToUpdate.aprobadorFinanzasId = usuarioId;
        dataToUpdate.nivelAprobacion = 'APROBADO';

        // Si es una solicitud o está pendiente, pasa a APROBADO (Fondos bloqueados/reservados)
        if (gasto.estado === 'SOLICITADO' || gasto.estado === 'PENDIENTE') {
          dataToUpdate.estado = 'APROBADO';
          needsBlocking = true;
        }
      } else {
        throw new BadRequestException('El gasto ya se encuentra aprobado o en un estado no procesable.');
      }

      const updated = await tx.gasto.update({
        where: { id },
        data: dataToUpdate,
      });

      if (needsBlocking) {
        await this.blockFunds(
          Number(updated.montoTotal),
          `Reserva: ${updated.concepto}`,
          'GASTO',
          updated.id,
          usuarioId,
          updated.cajaId || undefined,
          tx,
        );
      }

      return updated;
    });
  }

  async deleteGasto(id: string, usuarioId?: string, motivo?: string) {
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

    // 1. Eliminar archivos físicos primero
    await deletePhysicalFiles(urlsToDelete);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. REVERTIR SALDO EN CAJA por cada pago vinculado al gasto (se devuelve el dinero)
      for (const pago of gasto.pagos) {
        const dbCaja = await tx.caja.findUnique({ where: { id: pago.cajaId } });
        if (dbCaja) {
          const nuevoReal = Number(dbCaja.saldoReal) + Number(pago.monto); // Es un gasto, sumamos al revertir
          await tx.caja.update({
            where: { id: pago.cajaId },
            data: {
              saldoReal: nuevoReal,
              saldoDisponible: nuevoReal - Number(dbCaja.saldoComprometido),
            },
          });
        }
      }

      // 2. ELIMINAR TRANSACCIONES DE CAJA asociadas de la auditoría de historial
      console.log(`[ANULACIÓN] Eliminando transacciones de caja asociadas al gasto...`);
      await tx.transaccionCaja.deleteMany({
        where: {
          referenciaId: id,
          referenciaTipo: 'GASTO',
        },
      });

      // 3. ELIMINAR LOS REGISTROS DE PAGO
      console.log(`[ANULACIÓN] Eliminando pagos asociados al gasto...`);
      await tx.pago.deleteMany({ where: { gastoId: id } });

      // 4. MARCAR COMO ANULADO
      console.log(`[ANULACIÓN] Marcando gasto como ANULADO...`);
      return tx.gasto.update({
        where: { id },
        data: {
          estado: 'ANULADO',
          saldoPendiente: 0,
        },
      });
    });

    return result;
  }

  // ============================================
  // RENDICIONES
  // ============================================

  async findRendicionesByGasto(gastoId: string) {
    return this.prisma.rendicion.findMany({
      where: { gastoId },
      orderBy: { fecha: 'desc' },
    });
  }

  async createRendicion(dto: CreateRendicionDto, usuarioId: string) {
    const gasto = await this.prisma.gasto.findUnique({
      where: { id: dto.gastoId },
      include: { rendiciones: true },
    });

    if (!gasto) throw new NotFoundException('Gasto no encontrado');

    return this.prisma.$transaction(async (tx) => {
      const rendicion = await tx.rendicion.create({
        data: {
          ...dto,
          fecha: dto.fecha ? new Date(dto.fecha) : new Date(),
          registradoPorId: usuarioId,
        },
      });

      // Actualizar monto rendido en el gasto
      const nuevoMontoRendido =
        Number(gasto.montoRendido || 0) + Number(dto.monto);
      let nuevoEstadoRendicion: EstadoRendicion = 'PENDIENTE';

      const montoTotalGasto = Number(gasto.montoTotal);

      if (nuevoMontoRendido >= montoTotalGasto) {
        nuevoEstadoRendicion =
          nuevoMontoRendido > montoTotalGasto ? 'EXCEDIDA' : 'COMPLETADA';
      }

      await tx.gasto.update({
        where: { id: dto.gastoId },
        data: {
          montoRendido: nuevoMontoRendido,
          estadoRendicion: nuevoEstadoRendicion,
        },
      });

      // LÓGICA DE AJUSTE DE FONDOS OPERATIVOS
      // Si el gasto era un FONDO OPERATIVO (Tipo VIATICOS o OPERATIVO) y ya se completó la rendición
      if (
        (gasto.tipo === 'VIATICOS' || gasto.tipo === 'OPERATIVO') &&
        nuevoEstadoRendicion === 'COMPLETADA' &&
        gasto.cajaId
      ) {
        // En un flujo real, si sobró dinero, se devuelve a la caja.
        // Pero usualmente la rendición es EXACTA al gasto. 
        // Si hay un saldo a favor de la empresa, registramos un ingreso técnico.
        console.log(`[RENDICION] Gasto ${gasto.id} completado.`);
      }

      return rendicion;
    });
  }

  async deleteRendicion(id: string) {
    const rendicion = await this.prisma.rendicion.findUnique({
      where: { id },
      include: { gasto: true },
    });

    if (!rendicion) throw new NotFoundException('Rendición no encontrada');

    // 1. Borrar archivo físico si existe primero
    if (rendicion.comprobanteUrl) {
      await deletePhysicalFiles([rendicion.comprobanteUrl]);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Calcular nuevo monto rendido
      const nuevoMontoRendido =
        Number(rendicion.gasto.montoRendido || 0) - Number(rendicion.monto);
      
      let nuevoEstadoRendicion: EstadoRendicion = 'PENDIENTE';
      const montoTotalGasto = Number(rendicion.gasto.montoTotal);

      if (nuevoMontoRendido >= montoTotalGasto) {
        nuevoEstadoRendicion =
          nuevoMontoRendido > montoTotalGasto ? 'EXCEDIDA' : 'COMPLETADA';
      } else if (nuevoMontoRendido > 0) {
        nuevoEstadoRendicion = 'PENDIENTE';
      } else {
        nuevoEstadoRendicion = 'PENDIENTE';
      }

      // 2. Actualizar gasto
      await tx.gasto.update({
        where: { id: rendicion.gastoId },
        data: {
          montoRendido: nuevoMontoRendido,
          estadoRendicion: nuevoEstadoRendicion,
        },
      });

      // 3. Eliminar rendición
      return tx.rendicion.delete({
        where: { id },
      });
    });

    return result;
  }

  async secureDeleteRendicion(id: string) {
    return this.deleteRendicion(id);
  }

  async deletePago(id: string) {
    const pago = await this.prisma.pago.findUnique({
      where: { id },
      include: { factura: true, gasto: true },
    });

    if (!pago) throw new NotFoundException('Pago no encontrado');

    // 1. Borrar archivo físico si existe primero
    if (pago.comprobanteUrl) {
      await deletePhysicalFiles([pago.comprobanteUrl]);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Revertir saldo en caja
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

        // Auditoría de reversión
        await tx.transaccionCaja.create({
          data: {
            cajaId: pago.cajaId,
            tipo: 'EGRESO',
            monto: Number(pago.monto),
            concepto: `ELIMINACIÓN PAGO: ${pago.factura?.codigo || pago.gasto?.codigo || 'S/N'}`,
            referenciaTipo: pago.facturaId ? 'FACTURA' : 'GASTO',
            referenciaId: pago.facturaId || pago.gastoId,
            usuarioId: 'system',
            saldoRealPrevio: Number(dbCaja.saldoReal),
            saldoRealNuevo: nuevoReal,
          } as any,
        });
      }

      // 2. Revertir saldo en factura o gasto
      if (pago.facturaId) {
        const f = await tx.factura.findUnique({ where: { id: pago.facturaId } });
        if (f) {
          const nuevoSaldo = Number(f.saldoPendiente) + Number(pago.monto);
          await tx.factura.update({
            where: { id: pago.facturaId },
            data: {
              saldoPendiente: nuevoSaldo,
              estado: nuevoSaldo >= Number(f.montoTotal) ? 'PENDIENTE' : 'PAGO_PARCIAL',
            },
          });
        }
      } else if (pago.gastoId) {
        const g = await tx.gasto.findUnique({ where: { id: pago.gastoId } });
        if (g) {
          const nuevoSaldo = Number(g.saldoPendiente) + Number(pago.monto);
          await tx.gasto.update({
            where: { id: pago.gastoId },
            data: {
              saldoPendiente: nuevoSaldo,
              estado: 'PENDIENTE',
            },
          });
        }
      }

      // 3. Eliminar pago
      return tx.pago.delete({ where: { id } });
    });

    return result;
  }

  async secureDeletePago(id: string) {
    return this.deletePago(id);
  }

  // ============================================
  // CAJA (CRUD)
  // ============================================

  async createCaja(dto: any) {
    const {
      nombre,
      tipo,
      saldoReal,
      esProtegida,
      moneda,
      subtipo,
      porcentajeProvision,
      esPrincipal,
    } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (esPrincipal) {
        await tx.caja.updateMany({
          where: { subtipo: subtipo || 'OPERATIVA' },
          data: { esPrincipal: false },
        });
      }

      return tx.caja.create({
        data: {
          nombre,
          tipo,
          subtipo: subtipo || 'OPERATIVA',
          moneda: moneda || 'PEN',
          esProtegida: esProtegida || false,
          esPrincipal: esPrincipal || false,
          saldoReal: Number(saldoReal || 0),
          saldoDisponible: Number(saldoReal || 0),
          saldoComprometido: 0,
          porcentajeProvision: Number(porcentajeProvision || 0),
        },
      });
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

    const {
      nombre,
      tipo,
      saldoReal,
      motivoAjuste,
      esProtegida,
      subtipo,
      porcentajeProvision,
      esPrincipal,
    } = dto;
    const updateData: any = {};
    if (nombre) updateData.nombre = nombre;
    if (tipo) updateData.tipo = tipo;
    if (subtipo) updateData.subtipo = subtipo;
    if (porcentajeProvision !== undefined)
      updateData.porcentajeProvision = Number(porcentajeProvision);
    if (esProtegida !== undefined) updateData.esProtegida = esProtegida;
    if (esPrincipal !== undefined) updateData.esPrincipal = esPrincipal;

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

    return this.prisma.$transaction(async (tx) => {
      if (esPrincipal) {
        await tx.caja.updateMany({
          where: { subtipo: subtipo || current.subtipo },
          data: { esPrincipal: false },
        });
      }

      return tx.caja.update({
        where: { id },
        data: updateData,
      });
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

  async findApprovalConfig(tipo: TipoGasto, monto: number, prioridad: PrioridadGasto) {
    return this.prisma.configuracionAprobacion.findFirst({
      where: {
        tipoGasto: tipo,
        montoMinimo: { lte: monto },
        montoMaximo: { gte: monto },
        prioridad: prioridad,
        activo: true,
      },
    });
  }

  async submitAprobacionGasto(
    gastoId: string,
    usuarioId: string,
    dto: SubmitAprobacionDto,
  ) {
    const gasto = await this.prisma.gasto.findUnique({
      where: { id: gastoId },
      include: { aprobaciones: true },
    });
    if (!gasto) throw new NotFoundException('Gasto no encontrado');

    const user = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    // 1. Determinar configuración aplicable
    const config = await this.findApprovalConfig(
      gasto.tipo,
      Number(gasto.montoTotal),
      gasto.prioridad,
    );

    if (!config) {
      // Si no hay config, el ADMIN puede aprobar directamente
      if (user.rol !== 'ADMIN') {
        throw new BadRequestException(
          'No existe una configuración de aprobación para este gasto y no tienes permisos de administrador.',
        );
      }
    }

    const rolesAprobadores = config
      ? (config.rolesAprobadores as string[])
      : ['ADMIN'];
    const nivelActual = gasto.nivelActual;

    // Verificar si el usuario tiene el rol requerido para el nivel actual
    const rolRequerido = rolesAprobadores[nivelActual];

    if (user.rol !== 'ADMIN' && user.rol !== rolRequerido) {
      throw new BadRequestException(
        `Se requiere el rol ${rolRequerido} para este nivel de aprobación. Tu rol es ${user.rol}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Registrar la aprobación
      await tx.aprobacionGasto.create({
        data: {
          gastoId,
          usuarioId,
          nivel: nivelActual + 1,
          rol: user.rol,
          estado: dto.estado,
          comentario: dto.comentario,
        },
      });

      if (dto.estado === 'APROBADO') {
        const esUltimoNivel = nivelActual + 1 >= rolesAprobadores.length;

        if (esUltimoNivel) {
          // APROBACIÓN FINAL
          await tx.gasto.update({
            where: { id: gastoId },
            data: {
              nivelAprobacion: 'APROBADO',
              estado: 'PENDIENTE', // Listo para pagar
            },
          });

          // Bloquear fondos si es necesario
          await this.blockFunds(
            Number(gasto.montoTotal),
            `Reserva Aprobada: ${gasto.concepto}`,
            'GASTO',
            gasto.id,
            usuarioId,
            gasto.cajaId || undefined,
            tx,
          );
        } else {
          // AVANZAR AL SIGUIENTE NIVEL
          await tx.gasto.update({
            where: { id: gastoId },
            data: { nivelActual: nivelActual + 1 },
          });
        }
      } else if (dto.estado === 'RECHAZADO') {
        await tx.gasto.update({
          where: { id: gastoId },
          data: {
            nivelAprobacion: 'RECHAZADO',
            estado: 'ANULADO',
          },
        });
      }

      return { success: true };
    });
  }

  async findPendingApprovals(usuarioId: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
    });
    if (!user) return [];

    const isSupervisor = user.rol === 'SUPERVISOR';
    const isAdmin = user.rol === 'ADMIN';

    // Esta es una consulta simplificada. En un entorno real, 
    // cruzaríamos con ConfiguracionAprobacion para ver si user.rol está en rolesAprobadores[nivelActual]
    // Por ahora, traemos todos los pendientes de su nivel o donde sea ADMIN.

    const todosPendientes = await this.prisma.gasto.findMany({
      where: {
        nivelAprobacion: { in: ['PENDIENTE_FINANZAS', 'PENDIENTE_GERENCIA'] as any },
        estado: 'PENDIENTE',
      },
      include: {
        proyecto: { select: { nombre: true } },
        proveedor: { select: { razonSocial: true } },
      },
    });

    // Filtro manual basado en la config (para simplicidad en el prototipo)
    // En producción esto debería ser un query SQL/Prisma directo.
    return todosPendientes;
  }

  async createConfigAprobacion(dto: CreateConfigAprobacionDto) {
    return this.prisma.configuracionAprobacion.create({
      data: {
        tipoGasto: dto.tipoGasto,
        montoMinimo: dto.montoMinimo,
        montoMaximo: dto.montoMaximo,
        prioridad: dto.prioridad,
        rolesAprobadores: dto.rolesAprobadores,
        activo: dto.activo ?? true,
      },
    });
  }

  async findAllConfigsAprobacion() {
    return this.prisma.configuracionAprobacion.findMany({
      orderBy: { montoMinimo: 'asc' },
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

      // Revertir el efecto del saldo según el tipo de transacción en la caja
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

      // 1. Eliminar archivos físicos primero
      await deletePhysicalFiles(urlsToDelete);

      // Eliminar la transacción físicamente de la caja
      await tx.transaccionCaja.delete({ where: { id } });

      return { success: true };
    });

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

      // VALIDACIÓN DE PRESUPUESTO DEL PROYECTO
      if (refType === 'GASTO') {
        const dbGasto = await tx.gasto.findUnique({
          where: { id: refId },
          include: { proyecto: true },
        });
        if (dbGasto?.proyecto) {
          const costoPresupuestado = Number(dbGasto.proyecto.costoPresupuestado);
          const gastos = await tx.gasto.findMany({
            where: { 
              proyectoId: dbGasto.proyecto.id, 
              estado: { in: ['APROBADO', 'PAGADO'] },
              id: { not: refId } // Excluir este mismo gasto
            }
          });
          const costoTotalReal = gastos.reduce((sum: number, g: any) => sum + Number(g.montoTotal), 0);
          const presupuestoDisponible = costoPresupuestado - costoTotalReal;

          if (monto > presupuestoDisponible) {
            throw new BadRequestException(`Operación denegada: El proyecto ${dbGasto.proyecto.nombre} ha agotado su presupuesto. Saldo restante: S/ ${presupuestoDisponible.toFixed(2)}.`);
          }
        }
      }

      // VALIDACIÓN DE CAJA
      const saldoDisponibleReal = Number(dbCaja.saldoDisponible);
      if (monto > saldoDisponibleReal) {
        throw new BadRequestException(`Operación denegada: La caja ${dbCaja.nombre} solo tiene S/ ${saldoDisponibleReal.toFixed(2)} disponible. No hay liquidez suficiente para reservar.`);
      }

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

          // VALIDACIÓN DE PRESUPUESTO DEL PROYECTO
          const costoPresupuestado = Number(dbGasto.proyecto.costoPresupuestado);
          const gastos = await tx.gasto.findMany({
            where: { 
              proyectoId: dbGasto.proyecto.id, 
              estado: { in: ['APROBADO', 'PAGADO'] },
              id: { not: refId } // Excluir este mismo gasto
            }
          });
          const costoTotalReal = gastos.reduce((sum: number, g: any) => sum + Number(g.montoTotal), 0);
          const presupuestoDisponible = costoPresupuestado - costoTotalReal;

          if (monto > presupuestoDisponible) {
            throw new BadRequestException(`Operación denegada: El proyecto ${dbGasto.proyecto.nombre} ha agotado su presupuesto. Saldo restante: S/ ${presupuestoDisponible.toFixed(2)}.`);
          }
        }
      }

      // VALIDACIÓN DE CAJA
      if (!wasCommitted && monto > Number(dbCaja.saldoDisponible)) {
        throw new BadRequestException(`Operación denegada: La caja ${dbCaja.nombre} solo tiene S/ ${Number(dbCaja.saldoDisponible).toFixed(2)} disponible. Liquidez insuficiente.`);
      }
      if (monto > Number(dbCaja.saldoReal)) {
        throw new BadRequestException(`Operación denegada: La caja ${dbCaja.nombre} no tiene saldo real suficiente para este retiro.`);
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
      this.prisma.cliente.count({ 
        where: { 
          deletedAt: null,
          OR: [
            { etapaComercial: 'Ganado' },
            { etapaComercial: 'Orden de Servicio' },
            { etapaComercial: 'Cotización Enviada' },
            { etapaComercial: 'Cotizacion Enviada' },
            { etapaComercial: 'Inspección Realizada' },
            { etapaComercial: 'Inspeccion Realizada' },
            { tipoCliente: 'CLIENTE' }
          ]
        } 
      }),
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

    const utilidadMes = totalCobradoMes - totalGastosPagadosMes;

    return {
      totalFacturado,
      totalCobrado,
      totalPendiente: totalFacturado - totalCobrado,
      totalGastosPagados,
      totalGastosPendientes,
      utilidadMes,
      utilidadNeta: totalCobrado - totalGastosPagados,
      margenNeto: totalCobrado > 0 ? Number((( (totalCobrado - totalGastosPagados) / totalCobrado) * 100).toFixed(1)) : 0,
      facturasPendientes: facturas.filter((x) => x.estado === 'PENDIENTE').length,
      facturasParciales: facturas.filter((x) => x.estado === 'PAGO_PARCIAL').length,
      facturasVencidas: facturasCriticas.length,
      proyeccion90Dias: await this.get90DayProjection(),
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
      resumenCaja: { disponible, porMoneda: cajas.map(c => ({ nombre: c.nombre, saldo: c.saldoDisponible, moneda: c.moneda })) },
      cartera: { porCobrar, porPagar, facturasCriticas },
      proyectos: { topRentabilidad: rentabilidadProyectos },
      proyeccion: await this.get90DayProjection(),
      indicadores: {
        saludFinanciera: disponible > porPagar ? 'ESTABLE' : 'CRÍTICA',
        ratioLiquidez:
          porPagar > 0 ? Number((disponible / porPagar).toFixed(2)) : disponible > 0 ? 99 : 0,
      },
    };
  }

  async get90DayProjection() {
    const today = new Date();
    const intervals = [7, 15, 30, 60, 90];
    const projection = [];

    const cajas = await this.prisma.caja.findMany();
    const saldoInicial = cajas.reduce((acc, x) => acc + Number(x.saldoDisponible), 0);

    for (const days of intervals) {
      const limitDate = new Date();
      limitDate.setDate(today.getDate() + days);

      // Cobros esperados (Facturas pendientes)
      const facturas = await this.prisma.factura.findMany({
        where: {
          estado: { in: ['PENDIENTE', 'PAGO_PARCIAL', 'VENCIDA'] as any },
          fechaVencimiento: { lte: limitDate },
        },
        select: { saldoPendiente: true },
      });
      const cobrosEsperados = facturas.reduce((acc, f) => acc + Number(f.saldoPendiente), 0);

      // Pagos programados (Gastos pendientes)
      const gastos = await this.prisma.gasto.findMany({
        where: {
          estado: { in: ['PENDIENTE'] as any },
          fechaVencimiento: { lte: limitDate },
        },
        select: { montoTotal: true },
      });
      const pagosProgramados = gastos.reduce((acc, g) => acc + Number(g.montoTotal), 0);

      projection.push({
        dias: days,
        fecha: limitDate,
        cobros: cobrosEsperados,
        pagos: pagosProgramados,
        saldoProyectado: saldoInicial + cobrosEsperados - pagosProgramados,
      });
    }

    return projection;
  }

  async getProjectProfitability(proyectoId: string) {
    const [p, movimientosBD] = await Promise.all([
      this.prisma.proyecto.findUnique({
        where: { id: proyectoId },
        include: {
          facturas: {
            where: { estado: { not: 'ANULADA' } },
            include: { pagos: true },
          },
          gastos: {
            where: {
              estado: {
                in: ['PENDIENTE', 'PAGADO', 'SOLICITADO', 'APROBADO'] as any,
              },
            },
            include: {
              ordenCompra: {
                include: {
                  items: {
                    include: { insumo: true },
                  },
                },
              },
            },
          },
          adelantos: true,
          cotizacionOrigen: { select: { monto: true } },
        },
      }),
      this.prisma.movimientoAlmacen.findMany({
        where: { proyectoId: proyectoId, tipo: 'SALIDA' },
        include: { insumo: true },
      }),
    ]);

    if (!p) throw new NotFoundException('Proyecto no encontrado');

    const montoCotizado = Number(
      p.cotizacionOrigen?.monto || p.costoPresupuestado || 0,
    );

    // 1. INGRESOS REALES
    const totalCobradoFacturas = p.facturas.reduce(
      (acc, f) =>
        acc + f.pagos.reduce((sum, pago) => sum + Number(pago.monto), 0),
      0,
    );
    const totalAdelantos = p.adelantos.reduce(
      (acc, a) => acc + Number(a.monto),
      0,
    );
    const totalIngresosReales = totalCobradoFacturas + totalAdelantos;

    // 2. COSTOS REALES
    // 2.1 Materiales de Almacén (Kardex Real)
    const costoMaterialesKardex = movimientosBD.reduce((sum, mov) => {
      const precio = Number(
        mov.costoUnitarioHistorico || mov.insumo?.precioReferencial || 0,
      );
      return sum + Number(mov.cantidad) * precio;
    }, 0);

    // 2.2 Materiales de Órdenes de Compra (Reporte visual de gastos)
    const materialesOC = p.gastos
      .filter((g) => g.ordenCompra)
      .flatMap((g) =>
        g.ordenCompra!.items.map((item) => ({
          material: item.insumo?.nombre || 'Insumo sin nombre',
          cantidad: Number(item.cantidad),
          costoTotal: Number(item.subtotal),
          fecha: g.fechaEmision,
          origen: `COMPRA: ${g.ordenCompra!.codigo}`,
        })),
      );

    // 2.3 Mano de Obra
    const costoManoObra = p.gastos
      .filter((g) => g.tipo === 'PERSONAL' || g.tipo === 'PLANILLA' || g.categoriaDistribucion === 'MANO_OBRA')
      .reduce((sum, g) => sum + Number(g.montoTotal), 0);

    const costoMaterialesLogistica = p.gastos
      .filter((g) => g.categoriaDistribucion === 'MATERIALES')
      .reduce((sum, g) => sum + Number(g.montoTotal), 0);
      
    const costoMaterialesTotal = costoMaterialesKardex + costoMaterialesLogistica;

    // 2.4 Otros Gastos
    const costoVarios = p.gastos
      .filter((g) => g.tipo !== 'PERSONAL' && g.tipo !== 'PLANILLA' && g.categoriaDistribucion !== 'MANO_OBRA' && g.categoriaDistribucion !== 'MATERIALES')
      .reduce((sum, g) => sum + Number(g.montoTotal), 0);

    const costoTotalReal = costoMaterialesTotal + costoManoObra + costoVarios;

    // 3. INDICADORES
    const utilidadReal = montoCotizado - costoTotalReal;
    const margenReal =
      montoCotizado > 0 ? (utilidadReal / montoCotizado) * 100 : 0;

    // Persistencia
    await this.prisma.proyecto.update({
      where: { id: proyectoId },
      data: {
        costoTotalReal,
        consumoMaterialesReal: costoMaterialesTotal,
        consumoManoObraReal: costoManoObra,
        consumoServiciosReal: costoVarios,
        utilidadProyectada: utilidadReal,
      },
    });

    // Historial unificado para el Frontend
    const historialMateriales = [
      ...movimientosBD.map((m) => ({
        material: m.insumo?.nombre || 'Insumo Eliminado',
        cantidad: Number(m.cantidad),
        costoTotal:
          Number(m.cantidad) *
          Number(m.costoUnitarioHistorico || m.insumo?.precioReferencial || 0),
        fecha: m.fecha,
        origen: 'ALMACÉN (DESPACHO)',
      })),
      ...materialesOC,
    ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    return {
      proyectoId: p.id,
      nombre: p.nombre,
      codigo: p.codigo,
      montoCotizado,
      financiero: {
        totalFacturado: p.facturas.reduce(
          (acc, f) => acc + Number(f.montoTotal),
          0,
        ),
        totalCobradoFacturas,
        totalAdelantos,
        totalIngresosReales,
        saldoPorCobrar: montoCotizado - totalIngresosReales,
      },
      egresos: {
        costoTotal: costoTotalReal,
        materiales: costoMaterialesKardex,
        manoObra: costoManoObra,
        gastosDirectos: costoVarios,
      },
      adelantos: {
        totalRecibido: totalAdelantos,
        disponible: p.adelantos.reduce(
          (acc, a) => acc + Number(a.saldoDisponible),
          0,
        ),
      },
      indicadores: {
        utilidadProyectada: utilidadReal,
        rentabilidadProyectada: Math.round(margenReal * 100) / 100,
      },
      facturas: p.facturas.map((f) => ({
        id: f.id,
        codigo: f.codigo,
        montoTotal: Number(f.montoTotal),
        saldoPendiente: Number(f.saldoPendiente),
        estado: f.estado,
        fechaEmision: f.fechaEmision,
      })),
      historialMateriales,
      historialGastos: p.gastos.map((g) => ({
        id: g.id,
        concepto: g.concepto,
        monto: Number(g.montoTotal),
        fecha: g.fechaEmision,
        estado: g.estado,
        codigo: g.codigo,
        tipo: g.tipo,
        ocCodigo: g.ordenCompra?.codigo,
      })),
      presupuestoExcedido: costoTotalReal > montoCotizado && montoCotizado > 0,
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

  // ============================================
  // BANDEJA FINANZAS (Fase 3)
  // ============================================

  async getProyectosPendientesFinanzas() {
    return this.prisma.proyecto.findMany({
      where: {
        estado: { not: 'Finalizado' },
      },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        estado: true,
        estadoFinanciero: true,
        autorizaCompras: true,
        estadoLogistica: true,
        ventaContratada: true,
        costoPresupuestado: true,
        fechaCreacion: true,
        cliente: { select: { id: true, empresa: true, ruc: true } },
        cotizacionOrigen: {
          select: {
            id: true,
            codigo: true,
            monto: true,
            formaPago: true,
            ordenesDeServicio: {
              select: { id: true, codigo: true, estado: true },
            },
          },
        },
        adelantos: { select: { monto: true, fechaRecibido: true } },
      },
      orderBy: { fechaCreacion: 'desc' },
    });
  }

  async updateEstadoFinanciero(
    proyectoId: string,
    estadoFinanciero: string,
    autorizaCompras: boolean,
  ) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
    });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado.');

    const dataToUpdate: any = {};

    if (estadoFinanciero !== undefined) {
      const estadosValidos = [
        'SinPago',
        'AdelantoRecibido',
        'Aprobado',
        'Observado',
      ];
      if (!estadosValidos.includes(estadoFinanciero)) {
        throw new BadRequestException(
          `Estado financiero inválido. Use: ${estadosValidos.join(', ')}`,
        );
      }
      dataToUpdate.estadoFinanciero = estadoFinanciero;
    }

    if (autorizaCompras !== undefined) {
      dataToUpdate.autorizaCompras = autorizaCompras;
    }

    return this.prisma.proyecto.update({
      where: { id: proyectoId },
      data: dataToUpdate,
    });
  }

  // ============================================
  // GESTIÓN FINANCIERA DIRECTA EN BANDEJA
  // ============================================

  async getProyectoFinanzasDetalle(id: string) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id },
      include: {
        cliente: true,
        documentos: true,
        cotizacionOrigen: {
          include: { hitosPago: true, documentos: true },
        },
        facturas: {
          include: { pagos: true },
          orderBy: { fechaEmision: 'asc' },
        },
        adelantos: true,
      },
    });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');
    return proyecto;
  }

  async crearFacturaDesdeBandeja(proyectoId: string, dto: { hitoId?: string; monto: number; descripcion: string; fechaVencimiento: string }, usuarioId: string) {
    const proyecto = await this.prisma.proyecto.findUnique({ where: { id: proyectoId }, include: { cotizacionOrigen: true } });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');
    
    // Si hay un hito asociado, podríamos marcarlo como facturado o usarlo de referencia.
    // Creamos la factura:
    return this.prisma.factura.create({
      data: {
        clienteId: proyecto.clientId || '',
        proyectoId: proyecto.id,
        cotizacionId: proyecto.cotizacionOrigen?.id,
        codigo: `FAC-${Date.now().toString().slice(-6)}`,
        observaciones: dto.descripcion,
        montoTotal: dto.monto,
        saldoPendiente: dto.monto,
        fechaVencimiento: new Date(dto.fechaVencimiento),
        estado: 'PENDIENTE',
        hitoPagoId: dto.hitoId,
      },
    });
  }

  async registrarPagoBandeja(proyectoId: string, dto: { facturaId: string; cajaId: string; monto: number; referencia: string; comprobanteUrl?: string }, usuarioId: string) {
    const factura = await this.prisma.factura.findUnique({ where: { id: dto.facturaId } });
    if (!factura) throw new NotFoundException('Factura no encontrada');

    // Reutilizar la lógica real de pagos para mantener la consistencia
    const pago = await this.registerPago({
      facturaId: dto.facturaId,
      cajaId: dto.cajaId,
      monto: dto.monto,
      fechaPago: new Date().toISOString(),
      metodo: 'TRANSFERENCIA',
      referencia: dto.referencia,
      observaciones: 'Pago registrado desde Bandeja de Proyectos',
      comprobanteUrl: dto.comprobanteUrl,
    }, usuarioId);

    // Actualizar el estado del proyecto automáticamente!
    const updatedFactura = await this.prisma.factura.findUnique({ where: { id: dto.facturaId } });
    const isTotalmentePagada = updatedFactura && Number(updatedFactura.saldoPendiente) <= 0;

    // Crear el registro de Adelanto explícito para que se refleje en los sumarios y reportes
    await this.prisma.adelantoProyecto.create({
      data: {
        proyectoId: proyectoId,
        monto: dto.monto,
        saldoDisponible: dto.monto,
        metodo: 'TRANSFERENCIA',
        referencia: dto.referencia,
        comprobanteUrl: dto.comprobanteUrl,
        fechaRecibido: new Date(),
        registradoPorId: usuarioId,
      }
    });

    // Si es un pago, pasamos a Adelanto Recibido y autorizamos
    await this.prisma.proyecto.update({
      where: { id: proyectoId },
      data: {
        estadoFinanciero: isTotalmentePagada ? 'Aprobado' : 'AdelantoRecibido',
        autorizaCompras: true, // Automáticamente abrimos el caño a Logística
      },
    });

    return pago;
  }

  async adjuntarDocumentoBandeja(proyectoId: string, data: { nombre: string; url: string; tipo: string; tamano: string; subidoPor: string }) {
    return this.prisma.documento.create({
      data: {
        proyectoId,
        nombre: data.nombre,
        url: data.url,
        estado: 'Aprobado',
        tipo: (data.tipo as any) || 'Financiero',
        tamano: data.tamano,
        subidoPor: data.subidoPor,
      },
    });
  }

  async eliminarDocumentoBandeja(proyectoId: string, documentoId: string) {
    const doc = await this.prisma.documento.findUnique({ where: { id: documentoId } });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    
    return this.prisma.documento.delete({ where: { id: documentoId } });
  }

  async crearHitoBandeja(proyectoId: string, dto: { monto: number; descripcion: string }) {
    const proyecto = await this.prisma.proyecto.findUnique({ where: { id: proyectoId }, include: { cotizacionOrigen: true } });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');

    const cotizacion = await this.prisma.cotizacion.findFirst({
      where: { proyectoGeneradoId: proyectoId },
      include: { hitosPago: true }
    });

    if (!cotizacion) throw new BadRequestException('El proyecto no tiene cotizacion origen');

    const ventaContratada = Number(proyecto.ventaContratada || 0);
    const sumaHitosAnteriores = cotizacion.hitosPago.reduce((sum, hito) => sum + Number(hito.monto), 0);
    
    if (sumaHitosAnteriores + dto.monto > ventaContratada) {
      const disponible = ventaContratada - sumaHitosAnteriores;
      throw new BadRequestException(`El monto excede la venta contratada. Disponible: S/ ${disponible.toFixed(2)}`);
    }

    const totalMonto = cotizacion.monto ? Number(cotizacion.monto) : 0;
    const porcentaje = totalMonto > 0 ? (dto.monto / totalMonto) * 100 : 0;

    return this.prisma.hitoPago.create({
      data: {
        descripcion: dto.descripcion,
        monto: dto.monto,
        porcentaje,
        cotizacionId: cotizacion.id,
        estado: 'PENDIENTE',
      }
    });
  }

  async actualizarHitoBandeja(proyectoId: string, hitoId: string, dto: { monto: number; descripcion: string }) {
    const proyecto = await this.prisma.proyecto.findUnique({ where: { id: proyectoId } });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');

    const hito = await this.prisma.hitoPago.findUnique({ 
      where: { id: hitoId },
      include: { cotizacion: { include: { hitosPago: true } } }
    });
    if (!hito) throw new NotFoundException('Hito no encontrado');

    const ventaContratada = Number(proyecto.ventaContratada || 0);
    const sumaHitosTotales = hito.cotizacion.hitosPago.reduce((sum, h) => sum + Number(h.monto), 0);
    const sumaSinHitoActual = sumaHitosTotales - Number(hito.monto);

    if (sumaSinHitoActual + dto.monto > ventaContratada) {
      const disponible = ventaContratada - sumaSinHitoActual;
      throw new BadRequestException(`El monto excede la venta contratada. Disponible: S/ ${disponible.toFixed(2)}`);
    }

    return this.prisma.hitoPago.update({
      where: { id: hitoId },
      data: {
        monto: dto.monto,
        descripcion: dto.descripcion,
      },
    });
  }

  async eliminarHitoBandeja(proyectoId: string, hitoId: string) {
    const proyecto = await this.prisma.proyecto.findUnique({ where: { id: proyectoId } });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');

    const hito = await this.prisma.hitoPago.findUnique({ where: { id: hitoId } });
    if (!hito) throw new NotFoundException('Hito no encontrado');

    return this.prisma.hitoPago.delete({
      where: { id: hitoId },
    });
  }

  async actualizarVentaContratada(proyectoId: string, monto: number) {
    const proyecto = await this.prisma.proyecto.findUnique({ where: { id: proyectoId }, include: { cotizacionOrigen: true } });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');

    await this.prisma.proyecto.update({
      where: { id: proyectoId },
      data: { ventaContratada: monto },
    });

    if (proyecto.cotizacionOrigen) {
      await this.prisma.cotizacion.update({
        where: { id: proyecto.cotizacionOrigen.id },
        data: { monto: monto },
      });
    }

    return { success: true };
  }

  async actualizarCostoPresupuestado(proyectoId: string, monto: number) {
    const proyecto = await this.prisma.proyecto.findUnique({ where: { id: proyectoId } });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');

    await this.prisma.proyecto.update({
      where: { id: proyectoId },
      data: { costoPresupuestado: monto },
    });

    return { success: true };
  }

  async inyectarPresupuestoMateriales(proyectoId: string, monto: number, motivo: string, usuario: string) {
    const proyecto = await this.prisma.proyecto.findUnique({ where: { id: proyectoId } });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');

    const inyeccionesExistentes = await this.prisma.historialCambio.findMany({
      where: { proyectoId, campo: 'INYECCION_PRESUPUESTO' }
    });
    
    const presupuestoActual = inyeccionesExistentes.reduce((sum, item) => sum + Number(item.valorNuevo), 0);
    const limiteGasto = Number(proyecto.ventaContratada) * 0.60;
    
    if (presupuestoActual + monto > limiteGasto) {
      throw new BadRequestException(`El monto supera el límite del 60% del valor de venta del proyecto.`);
    }

    await this.prisma.historialCambio.create({
      data: {
        proyectoId,
        campo: 'INYECCION_PRESUPUESTO',
        valorAnterior: motivo,
        valorNuevo: String(monto),
        usuario: usuario,
        area: Area.LogisticaYRecursos
      }
    });

    const inyecciones = await this.prisma.historialCambio.findMany({
      where: { proyectoId, campo: 'INYECCION_PRESUPUESTO' }
    });
    
    const totalPresupuesto = inyecciones.reduce((sum, item) => sum + Number(item.valorNuevo), 0);

    await this.prisma.proyecto.update({
      where: { id: proyectoId },
      data: { costoPresupuestado: totalPresupuesto },
    });

    return { success: true, totalPresupuesto };
  }

  async getHistorialPresupuesto(proyectoId: string) {
    const inyecciones = await this.prisma.historialCambio.findMany({
      where: { proyectoId, campo: 'INYECCION_PRESUPUESTO' },
      orderBy: { fecha: 'desc' }
    });
    
    return inyecciones.map(i => ({
      id: i.id,
      monto: Number(i.valorNuevo),
      motivo: i.valorAnterior || 'Sin motivo',
      fecha: i.fecha,
      usuario: i.usuario
    }));
  }

  async eliminarInyeccionPresupuesto(proyectoId: string, inyeccionId: string) {
    const inyeccion = await this.prisma.historialCambio.findFirst({
      where: { id: inyeccionId, proyectoId, campo: 'INYECCION_PRESUPUESTO' }
    });
    
    if (!inyeccion) throw new NotFoundException('Registro de inyección no encontrado');

    await this.prisma.historialCambio.delete({
      where: { id: inyeccionId }
    });

    const inyecciones = await this.prisma.historialCambio.findMany({
      where: { proyectoId, campo: 'INYECCION_PRESUPUESTO' }
    });
    
    const totalPresupuesto = inyecciones.reduce((sum, item) => sum + Number(item.valorNuevo), 0);

    await this.prisma.proyecto.update({
      where: { id: proyectoId },
      data: { costoPresupuestado: totalPresupuesto },
    });

    return { success: true, totalPresupuesto };
  }

  // ============================================
  // GASTOS FIJOS / RECURRENTES
  // ============================================

  private getGastosFijosFilePath() {
    return path.join(__dirname, '..', '..', 'src', 'finanzas', 'data', 'gastos-fijos.json');
  }

  async getGastosFijos() {
    try {
      const filePath = this.getGastosFijosFilePath();
      if (!fs.existsSync(filePath)) {
        const altPath = path.join(process.cwd(), 'src', 'finanzas', 'data', 'gastos-fijos.json');
        if (fs.existsSync(altPath)) {
          return JSON.parse(fs.readFileSync(altPath, 'utf8'));
        }
        return [];
      }
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error('Error al leer gastos fijos:', e);
      return [];
    }
  }

  async createGastoFijo(dto: any) {
    const list = await this.getGastosFijos();
    const newGasto = {
      id: uuidv4(),
      concepto: dto.concepto,
      monto: Number(dto.monto),
      tipo: dto.tipo || 'ADMINISTRATIVO',
      diaMes: Number(dto.diaMes || 1),
      cajaId: dto.cajaId || null,
      activo: true,
    };
    list.push(newGasto);
    this.saveGastosFijos(list);
    return newGasto;
  }

  async deleteGastoFijo(id: string) {
    let list = await this.getGastosFijos();
    list = list.filter((g: any) => g.id !== id);
    this.saveGastosFijos(list);
    return { success: true };
  }

  async toggleGastoFijo(id: string) {
    const list = await this.getGastosFijos();
    const item = list.find((g: any) => g.id === id);
    if (item) {
      item.activo = !item.activo;
      this.saveGastosFijos(list);
    }
    return item;
  }

  private saveGastosFijos(list: any[]) {
    try {
      const filePath = this.getGastosFijosFilePath();
      if (fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf8');
      }
      const altPath = path.join(process.cwd(), 'src', 'finanzas', 'data', 'gastos-fijos.json');
      fs.writeFileSync(altPath, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
      console.error('Error al guardar gastos fijos:', e);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleRecurringGastosCron() {
    console.log('[Cron Job] Ejecutando procesamiento de gastos fijos recurrentes...');
    const list = await this.getGastosFijos();
    const activos = list.filter((g: any) => g.activo);

    const hoyMidnight = new Date();
    hoyMidnight.setHours(0, 0, 0, 0);

    const diaActual = hoyMidnight.getDate();
    const mesActual = hoyMidnight.getMonth();
    const anioActual = hoyMidnight.getFullYear();

    for (const g of activos) {
      try {
        const diaPagoGasto = Number(g.diaMes);
        let mesTarget = mesActual;
        let anioTarget = anioActual;

        // Si hoy ya pasó el día de pago de este mes, la fecha objetivo es el siguiente mes
        if (diaActual > diaPagoGasto) {
          mesTarget += 1;
          if (mesTarget > 11) {
            mesTarget = 0;
            anioTarget += 1;
          }
        }

        const fechaPago = new Date(anioTarget, mesTarget, diaPagoGasto, 0, 0, 0, 0);
        const diffTiempo = fechaPago.getTime() - hoyMidnight.getTime();
        const diffDias = Math.round(diffTiempo / (1000 * 60 * 60 * 24));

        // Registrar y notificar exactamente 2 días antes del día de pago
        if (diffDias === 2) {
          const conceptoGasto = `[Gasto Fijo] ${g.concepto}`;

          // Evitar registrar duplicados para este mismo vencimiento futuro
          const existe = await this.prisma.gasto.findFirst({
            where: {
              concepto: { contains: conceptoGasto },
              fechaVencimiento: {
                gte: new Date(anioTarget, mesTarget, diaPagoGasto, 0, 0, 0, 0),
                lte: new Date(anioTarget, mesTarget, diaPagoGasto, 23, 59, 59, 999),
              }
            }
          });

          if (existe) {
            console.log(`[Cron Job] El gasto recurrente "${g.concepto}" para el vencimiento del día ${diaPagoGasto} ya fue registrado hoy.`);
            continue;
          }

          // Crear el gasto pendiente 2 días antes, poniendo fecha de vencimiento igual a fechaPago
          const nuevoGasto = await this.prisma.gasto.create({
            data: {
              concepto: conceptoGasto,
              montoTotal: g.monto,
              saldoPendiente: g.monto,
              tipo: g.tipo || 'ADMINISTRATIVO',
              estado: 'PENDIENTE',
              cajaId: g.cajaId || null,
              solicitanteId: 'SISTEMA',
              registradoPorId: 'SISTEMA',
              fechaEmision: new Date(),
              fechaVencimiento: fechaPago,
              updatedAt: new Date(),
            }
          });

          // Notificar a usuarios de Finanzas
          const financeUsers = await this.prisma.usuario.findMany({
            where: { activo: true },
          });
          const targetUsers = financeUsers.filter((u) => {
            try {
              const mods = typeof u.modulos === 'string' ? JSON.parse(u.modulos) : u.modulos;
              return Array.isArray(mods) && mods.includes('finanzas');
            } catch (e) {
              return String(u.modulos).includes('finanzas');
            }
          });

          for (const u of targetUsers) {
            await this.prisma.notificacion.create({
              data: {
                usuarioId: u.id,
                titulo: 'Gasto Fijo Próximo a Vencer',
                mensaje: `El gasto fijo "${g.concepto}" vencerá en 2 días (el ${diaPagoGasto}/${mesTarget + 1}/${anioTarget}) por un monto de S/ ${Number(g.monto).toLocaleString('es-PE')}.`,
                tipo: 'SISTEMA',
              }
            });
          }
          console.log(`[Cron Job] Gasto fijo "${g.concepto}" registrado y notificado exitosamente para la fecha del 2 días antes.`);
        }
      } catch (error) {
        console.error(`[Cron Job] Error al procesar gasto fijo recurrente: ${g.concepto}`, error);
      }
    }
  }
}
