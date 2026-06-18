import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateInsumoDto } from './dto/create-insumo.dto';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { CreateOrdenCompraDto } from './dto/create-orden-compra.dto';
import {
  TipoMovimiento,
  EstadoCompra,
  TipoGasto,
  EstadoGasto,
  ClasificacionFinanciera,
  CategoriaDistribucion,
} from '@prisma/client';
import { deletePhysicalFiles } from '../common/utils/file-utils';

@Injectable()
export class LogisticaService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

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
    return this.prisma.insumo.create({ data: dto as any });
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

    const [data, total] = await Promise.all([
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
    ]);

    // Calcular inversión total aproximada (esto es pesado en grandes volúmenes, pero útil para el KPI)
    // Para mayor precisión en grandes datos, se usaría un query raw o una tabla de agregación.
    const allInsumosForStats = await this.prisma.insumo.findMany({
      select: { stockActual: true, precioReferencial: true, stockMinimo: true },
    });

    const totalInversion = allInsumosForStats.reduce(
      (acc, i) => acc + Number(i.stockActual) * Number(i.precioReferencial),
      0,
    );
    const lowStockCount = allInsumosForStats.filter(
      (i) => Number(i.stockActual) <= Number(i.stockMinimo),
    ).length;

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalInversion,
        lowStockCount,
        totalItems: total,
      },
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
      data: dto as any,
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
    let codigoToSave = dto.codigo;

    // Auto-generación de código secuencial (Ej: OC-001, OC-002)
    if (!codigoToSave) {
      const lastOrden = await this.prisma.ordenCompra.findFirst({
        orderBy: { createdAt: 'desc' },
      });
      if (lastOrden && lastOrden.codigo.startsWith('OC-')) {
        const lastNumber = parseInt(lastOrden.codigo.replace('OC-', ''), 10);
        if (!isNaN(lastNumber)) {
          codigoToSave = `OC-${String(lastNumber + 1).padStart(3, '0')}`;
        } else {
          codigoToSave = 'OC-001';
        }
      } else {
        codigoToSave = 'OC-001';
      }
    }

    const existe = await this.prisma.ordenCompra.findUnique({
      where: { codigo: codigoToSave },
    });
    if (existe)
      throw new ConflictException(
        `El código de orden de compra ${codigoToSave} ya existe`,
      );

    const montoTotal =
      Math.round(
        dto.items.reduce((sum: number, item: any) => {
          const qty = Number(item.cantidad || 0);
          const price = Number(item.precioUnitario || 0);
          if (qty <= 0) {
            throw new BadRequestException(
              `La cantidad del insumo debe ser mayor a cero`,
            );
          }
          return sum + qty * price;
        }, 0) * 100,
      ) / 100;

    if (isNaN(montoTotal)) {
      throw new BadRequestException(
        'El cálculo del monto total es inválido. Verifique los precios y cantidades.',
      );
    }

    // BUSCAR CAJA PARA VINCULAR (Prioridad: Principal o Soles)
    let caja = await this.prisma.caja.findFirst({
      where: { OR: [{ nombre: { contains: 'Principal' } }, { moneda: 'PEN' }] }
    });
    
    if (!caja) {
      caja = await this.prisma.caja.findFirst();
    }

    return this.prisma.$transaction(async (tx) => {
      const orden = await tx.ordenCompra.create({
        data: {
          codigo: codigoToSave,
          proveedorId: dto.proveedorId,
          observaciones: dto.observaciones,
          montoTotal: montoTotal,
          usuarioId: userId,
          items: {
            create: dto.items.map((item: any) => ({
              insumoId: item.insumoId,
              cantidad: Number(item.cantidad),
              precioUnitario: Number(item.precioUnitario),
              subtotal:
                Math.round(
                  Number(item.cantidad) * Number(item.precioUnitario) * 100,
                ) / 100,
            })),
          },
        } as any,
        include: { items: { include: { insumo: true } }, proveedor: true },
      });

      // 1. CREAR EL GASTO VINCULADO PARA QUE FINANZAS LO APRUEBE
      const gasto = await tx.gasto.create({
        data: {
          codigo: `OC-${orden.codigo}`,
          proveedorId: orden.proveedorId,
          proyectoId: dto.proyectoId || null,
          ordenCompraId: orden.id,
          cajaId: caja?.id || null,
          tipo: TipoGasto.PROYECTO,
          clasificacion: ClasificacionFinanciera.PROYECTO,
          categoriaDistribucion: CategoriaDistribucion.MATERIALES,
          concepto: `Orden de Compra: ${orden.codigo} ${dto.observaciones ? '- ' + dto.observaciones : ''}`,
          montoTotal: montoTotal,
          saldoPendiente: montoTotal,
          estado: EstadoGasto.SOLICITADO,
          nivelAprobacion: 'PENDIENTE_FINANZAS',
          solicitanteId: userId,
          area: 'LogisticaYRecursos',
          fechaEmision: new Date(),
          registradoPorId: userId,
        } as any,
      });

      // 2. BLOQUEAR FONDOS AUTOMÁTICAMENTE AL CREAR (PASA A COMPROMETIDO)
      if (caja) {
        const nuevoComprometido = Number(caja.saldoComprometido) + montoTotal;
        const nuevoDisponible = Number(caja.saldoReal) - nuevoComprometido;

        await tx.caja.update({
          where: { id: caja.id },
          data: {
            saldoComprometido: nuevoComprometido,
            saldoDisponible: nuevoDisponible,
          },
        });

        await tx.transaccionCaja.create({
          data: {
            cajaId: caja.id,
            tipo: 'BLOQUEO',
            monto: montoTotal,
            concepto: `Fondos comprometidos por OC: ${orden.codigo}`,
            referenciaTipo: 'ORDEN_COMPRA',
            referenciaId: orden.id,
            usuarioId: userId,
            saldoRealPrevio: Number(caja.saldoReal),
            saldoRealNuevo: Number(caja.saldoReal),
          } as any,
        });
      }


      return orden;
    });
  }

  async findAllOrdenes(
    page: number = 1,
    limit: number = 20,
    search: string = '',
    estado?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { codigo: { contains: search } },
        { proveedor: { razonSocial: { contains: search } } },
      ];
    }

    if (estado && estado !== 'ALL' && estado !== 'TODOS') {
      where.estado = estado;
    }

    if (dateFrom || dateTo) {
      where.fechaEmision = {};
      if (dateFrom) {
        where.fechaEmision.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        where.fechaEmision.lte = toDate;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.ordenCompra.findMany({
        where,
        skip,
        take: limit,
        include: {
          proveedor: true,
          items: { include: { insumo: true } },
          gasto: { include: { proyecto: true } },
        },
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
      } as any,
      include: { items: { include: { insumo: true } }, proveedor: true },
    });
  }

  async deleteOrdenCompra(id: string) {
    const orden = await this.prisma.ordenCompra.findUnique({
      where: { id },
      select: { estado: true, archivoFactura: true },
    });
    if (!orden) throw new NotFoundException('Orden de compra no encontrada');
    if (orden.estado === EstadoCompra.RECIBIDO)
      throw new BadRequestException('No se puede eliminar una orden recibida');

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.detalleOrdenCompra.deleteMany({ where: { ordenId: id } });
      return tx.ordenCompra.delete({ where: { id } });
    });

    if (orden.archivoFactura) {
      await deletePhysicalFiles([orden.archivoFactura]);
    }

    return result;
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

    // SI SE CANCELA UNA ORDEN, LIBERAMOS LOS FONDOS COMPROMETIDOS
    if (
      nuevoEstado === EstadoCompra.CANCELADO &&
      orden.estado !== EstadoCompra.CANCELADO
    ) {
      const caja = await this.prisma.caja.findFirst();
      if (caja) {
        await this.prisma.$transaction(async (tx) => {
          const montoOC = Number(orden.montoTotal);
          const nuevoComprometido = Math.max(
            0,
            Number(caja.saldoComprometido) - montoOC,
          );
          await tx.caja.update({
            where: { id: caja.id },
            data: {
              saldoComprometido: nuevoComprometido,
              saldoDisponible: Number(caja.saldoReal) - nuevoComprometido,
            },
          });
          await tx.transaccionCaja.create({
            data: {
              cajaId: caja.id,
              tipo: 'LIBERACION' as any,
              monto: montoOC,
              concepto: `Fondos liberados por cancelación de OC: ${orden.codigo}`,
              referenciaTipo: 'ORDEN_COMPRA',
              referenciaId: orden.id,
              usuarioId: userId,
              saldoRealPrevio: Number(caja.saldoReal),
              saldoRealNuevo: Number(caja.saldoReal),
            } as any,
          });
        });
      }
    }

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

          // Registrar movimiento Kardex con costo histórico
          await tx.movimientoAlmacen.create({
            data: {
              insumoId: item.insumoId,
              tipo: TipoMovimiento.ENTRADA,
              cantidad: item.cantidad,
              costoUnitarioHistorico: Number(item.precioUnitario), // Costo de compra real
              motivo: `Compra OC: ${orden.codigo}`,
              usuarioId: userId,
              ordenCompraId: orden.id,
            } as any,
          });
        }

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

    // ERROR 5: Validar si el insumo está inactivo
    if (insumo.estado === 'INACTIVO') {
      throw new BadRequestException(
        'El insumo se encuentra inhabilitado para despachos.',
      );
    }

    if (Number(insumo.stockActual) < data.cantidad)
      throw new BadRequestException(
        'Stock insuficiente para realizar el despacho',
      );

    return this.prisma.$transaction(async (tx) => {
      // 1. Verificar stock actual DENTRO de la transacción (bloqueo implícito por el update posterior)
      const currentInsumo = await tx.insumo.findUnique({
        where: { id: data.insumoId },
        select: { stockActual: true, precioReferencial: true },
      });

      if (!currentInsumo || Number(currentInsumo.stockActual) < data.cantidad) {
        throw new BadRequestException('Stock insuficiente (concurrencia)');
      }

      // 2. Restar stock
      await tx.insumo.update({
        where: { id: data.insumoId },
        data: { stockActual: { decrement: data.cantidad } },
      });

      // 2. Crear movimiento de salida con costo histórico (ERROR 3)
      const movimiento = await tx.movimientoAlmacen.create({
        data: {
          insumoId: data.insumoId,
          tipo: TipoMovimiento.SALIDA,
          cantidad: data.cantidad,
          costoUnitarioHistorico: Number(currentInsumo.precioReferencial), // Guardamos el precio actual "en piedra"
          proyectoId: data.proyectoId,
          motivo: data.motivo || 'Despacho a Obra',
          usuarioId: data.usuarioId,
        } as any,
      });

      if (data.proyectoId) {
        this.eventEmitter.emit('proyecto.costChanged', {
          proyectoId: data.proyectoId,
        });
      }

      return movimiento;
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
