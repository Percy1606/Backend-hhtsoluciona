import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CashFlowService {
  constructor(private prisma: PrismaService) {}

  async getForecast() {
    const today = new Date();
    const intervals = [7, 15, 30, 60, 90];
    const projection = [];

    const cajas = await this.prisma.caja.findMany({
      where: { subtipo: 'OPERATIVA' }
    });
    
    const saldoInicial = cajas.reduce((acc, x) => acc + Number(x.saldoDisponible), 0);

    for (const days of intervals) {
      const limitDate = new Date();
      limitDate.setDate(today.getDate() + days);

      // 1. INGRESOS PROYECTADOS (AR)
      // a. Facturas pendientes
      const facturas = await this.prisma.factura.findMany({
        where: {
          estado: { in: ['PENDIENTE', 'PAGO_PARCIAL', 'VENCIDA'] as any },
          OR: [
            { fechaEstimadaCobro: { lte: limitDate } },
            { 
              AND: [
                { fechaEstimadaCobro: null },
                { fechaVencimiento: { lte: limitDate } }
              ]
            }
          ]
        },
        select: { saldoPendiente: true }
      });

      // b. Hitos de pago pendientes de facturar (Cotizaciones aprobadas)
      const hitosPendientes = await this.prisma.hitoPago.findMany({
        where: {
          estado: 'PENDIENTE',
          fechaEstimada: { lte: limitDate },
          cotizacion: { estado: { in: ['Aprobado', 'Aprobada', 'Ganada'] } }
        },
        select: { monto: true }
      });

      // c. Adelantos programados
      const adelantos = await this.prisma.adelantoProyecto.findMany({
        where: { saldoDisponible: { gt: 0 } }
      });

      const totalIngresos = facturas.reduce((acc, f) => acc + Number(f.saldoPendiente), 0) +
                           hitosPendientes.reduce((acc, h) => acc + Number(h.monto), 0) +
                           adelantos.reduce((acc, a) => acc + Number(a.saldoDisponible), 0);

      // 2. EGRESOS PROYECTADOS (AP)
      // Usar fechaProgramadaPago preferentemente, sino fechaVencimiento
      const gastos = await this.prisma.gasto.findMany({
        where: {
          estado: { in: ['PENDIENTE', 'SOLICITADO', 'APROBADO'] as any },
          OR: [
            { fechaProgramadaPago: { lte: limitDate } },
            {
              AND: [
                { fechaProgramadaPago: null },
                { fechaVencimiento: { lte: limitDate } }
              ]
            }
          ]
        },
        select: { montoTotal: true, prioridad: true, tipo: true }
      });

      const totalEgresos = gastos.reduce((acc, g) => acc + Number(g.montoTotal), 0);

      projection.push({
        dias: days,
        fecha: limitDate,
        ingresos: totalIngresos,
        egresos: totalEgresos,
        saldoProyectado: saldoInicial + totalIngresos - totalEgresos,
        detalleEgresos: {
          planillas: gastos.filter(g => g.tipo === 'PLANILLA').reduce((acc, g) => acc + Number(g.montoTotal), 0),
          impuestos: gastos.filter(g => g.tipo === 'IMPUESTOS').reduce((acc, g) => acc + Number(g.montoTotal), 0),
          otros: gastos.filter(g => g.tipo !== 'PLANILLA' && g.tipo !== 'IMPUESTOS').reduce((acc, g) => acc + Number(g.montoTotal), 0),
        }
      });
    }

    return {
      saldoActual: saldoInicial,
      proyeccion: projection
    };
  }

  async getAgingReport() {
    const today = new Date();
    const facturas = await this.prisma.factura.findMany({
      where: {
        estado: { in: ['PENDIENTE', 'PAGO_PARCIAL', 'VENCIDA'] as any },
        saldoPendiente: { gt: 0 }
      },
      include: {
        cliente: { select: { empresa: true, ruc: true } },
        proyecto: { select: { nombre: true, codigo: true } }
      }
    });

    const report = {
      corriente: 0, // No vencidas
      vencido1_30: 0,
      vencido31_60: 0,
      vencido61_90: 0,
      vencido90_mas: 0,
      detalle: [] as any[]
    };

    facturas.forEach(f => {
      const fechaRef = f.fechaVencimiento;
      const diffTime = today.getTime() - fechaRef.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const monto = Number(f.saldoPendiente);

      const item = {
        id: f.id,
        codigo: f.codigo,
        cliente: f.cliente.empresa,
        proyecto: f.proyecto?.nombre || 'S/P',
        monto,
        diasMora: diffDays > 0 ? diffDays : 0,
        fechaVencimiento: f.fechaVencimiento
      };

      if (diffDays <= 0) report.corriente += monto;
      else if (diffDays <= 30) report.vencido1_30 += monto;
      else if (diffDays <= 60) report.vencido31_60 += monto;
      else if (diffDays <= 90) report.vencido61_90 += monto;
      else report.vencido90_mas += monto;

      report.detalle.push(item);
    });

    return report;
  }
}
