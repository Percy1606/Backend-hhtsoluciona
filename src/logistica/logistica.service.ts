import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInsumoDto } from './dto/create-insumo.dto';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { CreateOrdenCompraDto } from './dto/create-orden-compra.dto';
import {
  TipoMovimiento,
  EstadoCompra,
  TipoGasto,
  EstadoGasto,
} from '@prisma/client';

@Injectable()
export class LogisticaService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // PROVEEDORES
  // ============================================

  async createProveedor(dto: CreateProveedorDto) {
    const existe = await this.prisma.proveedor.findUnique({
      where: { ruc: dto.ruc },
    });
    if (existe)
      throw new ConflictException('Ya existe un proveedor con ese RUC');
    return this.prisma.proveedor.create({ data: dto });
  }

  async findAllProveedores() {
    return this.prisma.proveedor.findMany({ orderBy: { razonSocial: 'asc' } });
  }

  // ============================================
  // INSUMOS / ALMACÉN
  // ============================================

  async createInsumo(dto: CreateInsumoDto) {
    return this.prisma.insumo.create({ data: dto });
  }

  async findAllInsumos(
    page: number = 1,
    limit: number = 20,
    search: string = '',
    categoria?: string,
    stockStatus?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    // Filtro de búsqueda textual
    if (search) {
      where.OR = [
        { nombre: { contains: search } },
        { descripcion: { contains: search } },
      ];
    }

    // Filtro por categoría específica
    if (categoria && categoria !== 'all') {
      where.categoria = categoria;
    }

    // Filtro por estado de stock
    if (stockStatus === 'bajo') {
      where.stockActual = { lte: this.prisma.insumo.fields.stockMinimo }; // stockActual <= stockMinimo
    } else if (stockStatus === 'disponible') {
      where.stockActual = { gt: this.prisma.insumo.fields.stockMinimo }; // stockActual > stockMinimo
    }

    const [data, total, stats] = await Promise.all([
      this.prisma.insumo.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nombre: 'asc' },
        include: {
          _count: { select: { movimientos: true } },
        },
      }),
      this.prisma.insumo.count({ where }),
      this.prisma.insumo.aggregate({
        _sum: {
            stockActual: true,
        },
        _count: {
            id: true
        }
      })
    ]);

    // Calcular inversión total aproximada (esto es pesado en grandes volúmenes, pero útil para el KPI)
    // Para mayor precisión en grandes datos, se usaría un query raw o una tabla de agregación.
    const allInsumosForStats = await this.prisma.insumo.findMany({
        select: { stockActual: true, precioReferencial: true, stockMinimo: true }
    });

    const totalInversion = allInsumosForStats.reduce((acc, i) => acc + (i.stockActual * i.precioReferencial), 0);
    const lowStockCount = allInsumosForStats.filter(i => i.stockActual <= i.stockMinimo).length;

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalInversion,
        lowStockCount,
        totalItems: total
      }
    };
  }

  async findInsumoById(id: string) {
    const insumo = await this.prisma.insumo.findUnique({
      where: { id },
      include: { movimientos: { orderBy: { fecha: 'desc' }, take: 10 } },
    });
    if (!insumo) throw new NotFoundException('Insumo no encontrado');
    return insumo;
  }

  async updateInsumo(id: string, dto: Partial<CreateInsumoDto>) {
    const insumo = await this.prisma.insumo.findUnique({ where: { id } });
    if (!insumo) throw new NotFoundException('Insumo no encontrado');
    return this.prisma.insumo.update({
      where: { id },
      data: dto,
    });
  }

  async removeInsumo(id: string) {
    const insumo = await this.prisma.insumo.findUnique({
      where: { id },
      include: {
        _count: { select: { movimientos: true, detallesCompra: true } },
      },
    });
    if (!insumo) throw new NotFoundException('Insumo no encontrado');

    if (insumo._count.movimientos > 0 || insumo._count.detallesCompra > 0) {
      throw new BadRequestException(
        'No se puede eliminar un insumo que tiene movimientos o compras registradas. Considere desactivarlo.',
      );
    }

    return this.prisma.insumo.delete({ where: { id } });
  }

  // ============================================
  // ORDENES DE COMPRA
  // ============================================

  async createOrdenCompra(dto: CreateOrdenCompraDto, userId: string) {
    const existe = await this.prisma.ordenCompra.findUnique({
      where: { codigo: dto.codigo },
    });
    if (existe)
      throw new ConflictException('El código de orden de compra ya existe');

    const montoTotal = dto.items.reduce((sum: number, item: any) => {
      if (item.cantidad <= 0) {
        throw new BadRequestException(
          `La cantidad del insumo debe ser mayor a cero`,
        );
      }
      return sum + item.cantidad * item.precioUnitario;
    }, 0);

    return this.prisma.ordenCompra.create({
      data: {
        codigo: dto.codigo,
        proveedorId: dto.proveedorId,
        observaciones: dto.observaciones,
        montoTotal,
        usuarioId: userId,
        items: {
          create: dto.items.map((item: any) => ({
            insumoId: item.insumoId,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: item.cantidad * item.precioUnitario,
          })),
        },
      },
      include: { items: { include: { insumo: true } }, proveedor: true },
    });
  }

  async findAllOrdenes(page: number = 1, limit: number = 20, search: string = '') {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { codigo: { contains: search } },
        { proveedor: { razonSocial: { contains: search } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.ordenCompra.findMany({
        where,
        skip,
        take: limit,
        include: { proveedor: true, items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ordenCompra.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ============================================
  // KARDEX / MOVIMIENTOS
  // ============================================

  async findAllMovimientos(
    page: number = 1,
    limit: number = 20,
    search: string = '',
    tipo?: TipoMovimiento,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { motivo: { contains: search } },
        { insumo: { nombre: { contains: search } } },
      ];
    }

    if (tipo) {
      where.tipo = tipo;
    }

    const [data, total] = await Promise.all([
      this.prisma.movimientoAlmacen.findMany({
        where,
        skip,
        take: limit,
        include: { insumo: true },
        orderBy: { fecha: 'desc' },
      }),
      this.prisma.movimientoAlmacen.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateOrdenCompra(id: string, dto: any) {
    const orden = await this.prisma.ordenCompra.findUnique({ where: { id } });
    if (!orden) throw new NotFoundException('Orden de compra no encontrada');
    if (orden.estado === EstadoCompra.RECIBIDO)
      throw new BadRequestException('No se puede editar una orden recibida');

    const montoTotal = dto.items.reduce((sum: number, item: any) => {
      if (item.cantidad <= 0) {
        throw new BadRequestException(
          `La cantidad del insumo debe ser mayor a cero`,
        );
      }
      return sum + item.cantidad * item.precioUnitario;
    }, 0);

    return this.prisma.ordenCompra.update({
      where: { id },
      data: {
        codigo: dto.codigo,
        proveedorId: dto.proveedorId,
        observaciones: dto.observaciones,
        montoTotal,
        items: {
          deleteMany: {},
          create: dto.items.map((item: any) => ({
            insumoId: item.insumoId,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: item.cantidad * item.precioUnitario,
          })),
        },
      },
      include: { items: { include: { insumo: true } }, proveedor: true },
    });
  }

  async deleteOrdenCompra(id: string) {
    const orden = await this.prisma.ordenCompra.findUnique({ where: { id } });
    if (!orden) throw new NotFoundException('Orden de compra no encontrada');
    if (orden.estado === EstadoCompra.RECIBIDO)
      throw new BadRequestException('No se puede eliminar una orden recibida');

    return this.prisma.$transaction(async (tx) => {
      await tx.detalleOrdenCompra.deleteMany({ where: { ordenId: id } });
      return tx.ordenCompra.delete({ where: { id } });
    });
  }

  async updateEstadoCompra(
    id: string,
    nuevoEstado: EstadoCompra,
    userId: string,
  ) {
    const orden = await this.prisma.ordenCompra.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!orden) throw new NotFoundException('Orden de compra no encontrada');
    if (orden.estado === EstadoCompra.RECIBIDO)
      throw new BadRequestException(
        'La orden ya fue recibida y el stock actualizado',
      );

    // SI EL ESTADO ES RECIBIDO, ACTUALIZAMOS STOCK Y CREAMOS MOVIMIENTOS
    if (nuevoEstado === EstadoCompra.RECIBIDO) {
      return this.prisma.$transaction(async (tx) => {
        const updatedOrden = await tx.ordenCompra.update({
          where: { id },
          data: { estado: nuevoEstado },
        });

        for (const item of orden.items) {
          // Actualizar stock
          await tx.insumo.update({
            where: { id: item.insumoId },
            data: { stockActual: { increment: item.cantidad } },
          });

          // Registrar movimiento Kardex
          await tx.movimientoAlmacen.create({
            data: {
              insumoId: item.insumoId,
              tipo: TipoMovimiento.ENTRADA,
              cantidad: item.cantidad,
              motivo: `Compra OC: ${orden.codigo}`,
              usuarioId: userId,
              ordenCompraId: orden.id,
            },
          });
        }

        // INTEGRACIÓN FINANZAS: Crear un Gasto automáticamente al recibir la mercadería
        await tx.gasto.create({
          data: {
            proveedorId: orden.proveedorId,
            ordenCompraId: orden.id,
            concepto: `Factura por Orden de Compra: ${orden.codigo}`,
            montoTotal: orden.montoTotal,
            tipo: TipoGasto.OPERATIVO,
            estado: EstadoGasto.PENDIENTE,
            registradoPorId: userId,
            fechaEmision: new Date(),
          },
        });

        return updatedOrden;
      });
    }

    return this.prisma.ordenCompra.update({
      where: { id },
      data: { estado: nuevoEstado },
    });
  }

  // ============================================
  // DESPACHOS A OBRA (SALIDAS)
  // ============================================

  async registrarDespacho(data: {
    insumoId: string;
    cantidad: number;
    proyectoId: string;
    motivo?: string;
    usuarioId: string;
  }) {
    const insumo = await this.prisma.insumo.findUnique({
      where: { id: data.insumoId },
    });
    if (data.cantidad <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor a cero');
    }

    if (!insumo) throw new NotFoundException('Insumo no encontrado');
    if (insumo.stockActual < data.cantidad)
      throw new BadRequestException(
        'Stock insuficiente para realizar el despacho',
      );

    return this.prisma.$transaction(async (tx) => {
      // 1. Verificar stock actual DENTRO de la transacción (bloqueo implícito por el update posterior)
      const currentInsumo = await tx.insumo.findUnique({
        where: { id: data.insumoId },
        select: { stockActual: true },
      });

      if (!currentInsumo || currentInsumo.stockActual < data.cantidad) {
        throw new BadRequestException('Stock insuficiente (concurrencia)');
      }

      // 2. Restar stock
      await tx.insumo.update({
        where: { id: data.insumoId },
        data: { stockActual: { decrement: data.cantidad } },
      });

      // 2. Crear movimiento de salida
      return tx.movimientoAlmacen.create({
        data: {
          insumoId: data.insumoId,
          tipo: TipoMovimiento.SALIDA,
          cantidad: data.cantidad,
          proyectoId: data.proyectoId,
          motivo: data.motivo || 'Despacho a Obra',
          usuarioId: data.usuarioId,
        },
      });
    });
  }

  async findMovimientosByProyecto(proyectoId: string) {
    return this.prisma.movimientoAlmacen.findMany({
      where: { proyectoId },
      include: { insumo: true },
      orderBy: { fecha: 'desc' },
    });
  }
}
