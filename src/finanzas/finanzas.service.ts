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
import { EstadoFactura } from '@prisma/client';

@Injectable()
export class FinanzasService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // FACTURAS
  // ============================================

  async createFactura(dto: CreateFacturaDto) {
    // Asegurar precisión decimal (BUG-005)
    const montoTotal = Math.round(dto.montoTotal * 100) / 100;

    return this.prisma.factura.create({
      data: {
        ...dto,
        montoTotal,
        saldoPendiente: montoTotal, // Inicialmente el saldo es el total
        fechaEmision: new Date(dto.fechaEmision),
        fechaVencimiento: new Date(dto.fechaVencimiento),
      },
      include: {
        cliente: true,
        proyecto: true,
      },
    });
  }

  async findAllFacturas(filters?: any) {
    return this.prisma.factura.findMany({
      where: filters,
      include: {
        cliente: { select: { empresa: true, ruc: true } },
        proyecto: { select: { nombre: true, codigo: true } },
      },
      orderBy: { fechaEmision: 'desc' },
    });
  }

  async findOneFactura(id: string) {
    const factura = await this.prisma.factura.findUnique({
      where: { id },
      include: {
        cliente: true,
        proyecto: true,
        pagos: true,
      },
    });

    if (!factura) throw new NotFoundException('Factura no encontrada');
    return factura;
  }

  async updateFactura(id: string, dto: UpdateFacturaDto) {
    await this.findOneFactura(id);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fechaEmision, fechaVencimiento, ...rest } = dto;
    
    const data: any = { ...rest };

    if (dto.fechaEmision) {
      data.fechaEmision = new Date(dto.fechaEmision);
    }
    if (dto.fechaVencimiento) {
      data.fechaVencimiento = new Date(dto.fechaVencimiento);
    }

    // Recalcular saldo si el monto total cambia y el estado no es pagado
    if (dto.montoTotal !== undefined) {
      const facturaActual = await this.findOneFactura(id);
      if (facturaActual.estado !== 'PAGADA') {
        const pagos = facturaActual.pagos.reduce((acc, p) => acc + p.monto, 0);
        data.saldoPendiente = Math.round((dto.montoTotal - pagos) * 100) / 100;
      }
    }
    
    return this.prisma.factura.update({
      where: { id },
      data,
    });
  }

  async deleteFactura(id: string) {
    return this.prisma.factura.delete({ where: { id } });
  }

  // ============================================
  // PAGOS / COBRANZAS
  // ============================================

  async registerPago(dto: CreatePagoDto, usuarioId: string) {
    const factura = await this.prisma.factura.findUnique({
      where: { id: dto.facturaId },
    });

    if (!factura) throw new NotFoundException('Factura no encontrada');

    if (dto.monto <= 0) {
      throw new BadRequestException('El monto del pago debe ser mayor a cero');
    }

    if (dto.monto > factura.saldoPendiente) {
      throw new BadRequestException(
        'El monto del pago excede el saldo pendiente',
      );
    }

    // Usar transacción para asegurar consistencia
    return this.prisma.$transaction(async (tx) => {
      const pago = await tx.pago.create({
        data: {
          ...dto,
          registradoPorId: usuarioId,
          fechaPago: dto.fechaPago ? new Date(dto.fechaPago) : new Date(),
        },
      });

      // Redondeo a 2 decimales para evitar errores de precisión de punto flotante (BUG-005)
      const nuevoSaldo =
        Math.round((factura.saldoPendiente - dto.monto) * 100) / 100;
      let nuevoEstado: EstadoFactura = EstadoFactura.PAGADA_PARCIAL;

      if (nuevoSaldo <= 0) {
        nuevoEstado = EstadoFactura.PAGADA;
      }

      await tx.factura.update({
        where: { id: factura.id },
        data: {
          saldoPendiente: nuevoSaldo,
          estado: nuevoEstado,
        },
      });

      return pago;
    });
  }

  // ============================================
  // GASTOS / EGRESOS
  // ============================================

  async createGasto(dto: CreateGastoDto, usuarioId: string) {
    return this.prisma.gasto.create({
      data: {
        ...dto,
        registradoPorId: usuarioId,
        fechaEmision: new Date(dto.fechaEmision),
        fechaVencimiento: dto.fechaVencimiento
          ? new Date(dto.fechaVencimiento)
          : null,
      },
      include: {
        proveedor: true,
        proyecto: true,
      },
    });
  }

  async findAllGastos(filters?: any) {
    return this.prisma.gasto.findMany({
      where: filters,
      include: {
        proveedor: { select: { razonSocial: true, ruc: true } },
        proyecto: { select: { nombre: true, codigo: true } },
      },
      orderBy: { fechaEmision: 'desc' },
    });
  }

  async updateGasto(id: string, dto: any) {
    return this.prisma.gasto.update({
      where: { id },
      data: dto,
    });
  }

  async deleteGasto(id: string) {
    return this.prisma.gasto.delete({ where: { id } });
  }

  // ============================================
  // DASHBOARD STATS
  // ============================================

  async getDashboardStats(mes?: number, anio?: number) {
    const whereFactura: any = { estado: { not: 'ANULADA' } };
    const whereGasto: any = { estado: { not: 'ANULADO' } };

    if (mes !== undefined && anio !== undefined) {
      // Find start and end of the given month/year
      const startDate = new Date(anio, mes - 1, 1); // mes is 1-indexed from client
      const endDate = new Date(anio, mes, 0, 23, 59, 59, 999);

      whereFactura.fechaEmision = { gte: startDate, lte: endDate };
      whereGasto.fechaEmision = { gte: startDate, lte: endDate };
    }

    const facturas = await this.prisma.factura.findMany({
      where: whereFactura,
    });

    const totalFacturado = facturas.reduce((acc, f) => acc + f.montoTotal, 0);
    const totalPendiente = facturas.reduce(
      (acc, f) => acc + f.saldoPendiente,
      0,
    );
    const totalCobrado = totalFacturado - totalPendiente;

    // Facturas críticas (vencidas y no pagadas)
    const hoy = new Date();
    const facturasCriticas = await this.prisma.factura.findMany({
      where: {
        estado: { in: ['PENDIENTE', 'PAGADA_PARCIAL'] },
        fechaVencimiento: { lt: hoy },
      },
      include: {
        cliente: { select: { empresa: true } },
        proyecto: { select: { nombre: true } },
      },
      orderBy: { fechaVencimiento: 'asc' },
      take: 5,
    });

    // Gastos totales
    const gastos = await this.prisma.gasto.findMany({
      where: whereGasto,
    });
    const totalGastos = gastos.reduce((acc, g) => acc + g.montoTotal, 0);

    return {
      totalFacturado,
      totalCobrado,
      totalPendiente,
      totalGastos,
      utilidadProyectada: totalFacturado - totalGastos,
      facturasCriticas: facturasCriticas.map((f) => ({
        id: f.id,
        codigo: f.codigo,
        cliente: f.cliente.empresa,
        proyecto: f.proyecto?.nombre || 'N/A',
        monto: f.montoTotal,
        saldo: f.saldoPendiente,
        fechaVencimiento: f.fechaVencimiento,
        diasVencidos: Math.floor(
          (Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()) - 
           Date.UTC(f.fechaVencimiento.getUTCFullYear(), f.fechaVencimiento.getUTCMonth(), f.fechaVencimiento.getUTCDate())) / 
          (1000 * 3600 * 24),
        ),
      })),
    };
  }

  async getCashFlowData(mes?: number, anio?: number) {
    const months = [];
    const today = new Date();

    // If mes and anio are provided, use them as the end point (mes is 1-indexed)
    const refYear = anio !== undefined ? anio : today.getFullYear();
    const refMonth = mes !== undefined ? mes - 1 : today.getMonth();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(refYear, refMonth - i, 1);
      months.push({
        name: date.toLocaleString('es-ES', { month: 'short' }),
        month: date.getMonth(),
        year: date.getFullYear(),
        ingresos: 0,
        egresos: 0,
      });
    }

    const startDate = new Date(months[0].year, months[0].month, 1);
    const endDate = new Date(refYear, refMonth + 1, 0, 23, 59, 59, 999);

    const facturas = await this.prisma.factura.findMany({
      where: {
        fechaEmision: { gte: startDate, lte: endDate },
        estado: { not: 'ANULADA' },
      },
    });

    const gastos = await this.prisma.gasto.findMany({
      where: {
        fechaEmision: { gte: startDate, lte: endDate },
        estado: { not: 'ANULADO' },
      },
    });

    months.forEach((m) => {
      m.ingresos = facturas
        .filter((f) => {
          const d = new Date(f.fechaEmision);
          return d.getMonth() === m.month && d.getFullYear() === m.year;
        })
        .reduce((acc, f) => acc + f.montoTotal, 0);

      m.egresos = gastos
        .filter((g) => {
          const d = new Date(g.fechaEmision);
          return d.getMonth() === m.month && d.getFullYear() === m.year;
        })
        .reduce((acc, g) => acc + g.montoTotal, 0);
    });

    return months.map(({ name, ingresos, egresos }) => ({
      month: name.charAt(0).toUpperCase() + name.slice(1),
      ingresos,
      egresos,
    }));
  }
}
