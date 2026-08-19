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
import { CreatePersonalDto, UpdatePersonalDto } from './dto/create-personal.dto';
import {
  TipoMovimiento,
  EstadoCompra,
  TipoGasto,
  EstadoGasto,
  ClasificacionFinanciera,
  CategoriaDistribucion,
  TipoDocumento,
  EstadoDocumento,
  Area,
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

    let allItems = await this.prisma.insumo.findMany({
      where,
      orderBy: { nombre: 'asc' },
      include: {
        _count: { select: { movimientos: true } },
      },
    });

    if (stockStatus === 'bajo') {
      allItems = allItems.filter((i) => Number(i.stockActual) <= Number(i.stockMinimo));
    } else if (stockStatus === 'disponible') {
      allItems = allItems.filter((i) => Number(i.stockActual) > Number(i.stockMinimo));
    }

    const total = allItems.length;
    const data = allItems.slice(skip, skip + limit);

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

    // NO BUSCAMOS CAJA AQUÍ. LOGÍSTICA NO DEBE BLOQUEAR FONDOS A CIEGAS.
    // SE CREA EL GASTO EN ESTADO SOLICITADO PARA QUE FINANZAS ASIGNE LA CAJA Y EJECUTE EL PAGO/BLOQUEO.

    if (dto.proyectoId && dto.proyectoId !== 'none' && dto.proyectoId !== '') {
      await this.validarReglasFinancieras(dto.proyectoId, montoTotal, undefined, dto.aprobarConCredito);
    }

    return this.prisma.$transaction(async (tx) => {
      const orden = await tx.ordenCompra.create({
        data: {
          codigo: codigoToSave,
          proveedorId: dto.proveedorId,
          observaciones: dto.observaciones,
          estado: (dto.estado as EstadoCompra) || EstadoCompra.PENDIENTE,
          archivoFactura: dto.archivoFactura,
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

      // 1. CREAR EL GASTO VINCULADO PARA QUE FINANZAS LO GESTIONE Y PAGUE
      const gasto = await tx.gasto.create({
        data: {
          codigo: `OC-${orden.codigo}`,
          proveedorId: orden.proveedorId,
          proyectoId: dto.proyectoId || null,
          ordenCompraId: orden.id,
          cajaId: null, // Finanzas decidirá de qué caja sale el dinero
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

      // 2. YA NO HAY BLOQUEO AUTOMÁTICO DE FONDOS. FINANZAS SE ENCARGARÁ.


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

    const [data, total, agg] = await Promise.all([
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
      this.prisma.ordenCompra.aggregate({
        where,
        _sum: { montoTotal: true },
      }),
    ]);

    return {
      data,
      total,
      totalMonto: agg._sum.montoTotal ? Number(agg._sum.montoTotal) : 0,
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

    const gastoVinculado = await this.prisma.gasto.findFirst({ where: { ordenCompraId: id } });
    if (gastoVinculado && gastoVinculado.proyectoId) {
      await this.validarReglasFinancieras(gastoVinculado.proyectoId, montoTotal, gastoVinculado.id, (dto as any).aprobarConCredito);
    }

      return this.prisma.ordenCompra.update({
        where: { id },
        data: {
          codigo: dto.codigo,
          proveedorId: dto.proveedorId,
          observaciones: dto.observaciones,
          estado: dto.estado ? (dto.estado as EstadoCompra) : undefined,
          archivoFactura: dto.archivoFactura !== undefined ? dto.archivoFactura : undefined,
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

    if (orden.archivoFactura) {
      await deletePhysicalFiles([orden.archivoFactura]);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.detalleOrdenCompra.deleteMany({ where: { ordenId: id } });
      return tx.ordenCompra.delete({ where: { id } });
    });

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

    // SI SE CANCELA UNA ORDEN, ANULAMOS EL GASTO ASOCIADO PARA QUE FINANZAS NO LO PAGUE
    if (
      nuevoEstado === EstadoCompra.CANCELADO &&
      orden.estado !== EstadoCompra.CANCELADO
    ) {
      const gastoRelacionado = await this.prisma.gasto.findFirst({ where: { ordenCompraId: orden.id } });
      if (gastoRelacionado && gastoRelacionado.estado === 'PAGADO') {
        throw new BadRequestException('No puedes cancelar esta OC porque Finanzas ya ejecutó el pago. Coordine con Finanzas la anulación del gasto primero.');
      }

      await this.prisma.$transaction(async (tx) => {
        // Actualizamos estado del gasto a ANULADO
        if (gastoRelacionado) {
           await tx.gasto.update({
             where: { id: gastoRelacionado.id },
             data: { estado: 'ANULADO' }
           });
        }
      });
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

      // Calcular Costo Promedio Ponderado para el Costo de Salida
      const entradas = await tx.movimientoAlmacen.findMany({
        where: {
          insumoId: data.insumoId,
          tipo: 'ENTRADA',
        },
        select: {
          cantidad: true,
          costoUnitarioHistorico: true,
        },
      });

      let costoUnitarioSalida = Number(currentInsumo.precioReferencial);

      if (entradas.length > 0) {
        let totalCantidadEntradas = 0;
        let totalValorEntradas = 0;
        for (const entrada of entradas) {
          const cant = Number(entrada.cantidad);
          const costo = Number(entrada.costoUnitarioHistorico || 0);
          totalCantidadEntradas += cant;
          totalValorEntradas += (cant * costo);
        }
        if (totalCantidadEntradas > 0) {
          costoUnitarioSalida = Math.round((totalValorEntradas / totalCantidadEntradas) * 100) / 100;
        }
      }

      // 2. Restar stock
      await tx.insumo.update({
        where: { id: data.insumoId },
        data: { stockActual: { decrement: data.cantidad } },
      });

      // 2. Crear movimiento de salida con costo promedio ponderado
      const movimiento = await tx.movimientoAlmacen.create({
        data: {
          insumoId: data.insumoId,
          tipo: TipoMovimiento.SALIDA,
          cantidad: data.cantidad,
          costoUnitarioHistorico: costoUnitarioSalida,
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

  // ============================================
  // BANDEJA LOGÍSTICA (Fase 3)
  // ============================================

  async getProyectosPendientesLogistica() {
    return this.prisma.proyecto.findMany({
      where: {
        autorizaCompras: true,
        estado: { not: 'Finalizado' },
        cotizacionOrigen: { isNot: null },
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
            alcance: true,
            entregables: true,
            ordenesDeServicio: {
              select: { id: true, codigo: true, estado: true },
            },
          },
        },
        adelantos: {
          select: { monto: true, saldoDisponible: true },
        },
      },
      orderBy: { fechaCreacion: 'desc' },
    });
  }

  async updateEstadoLogistica(
    proyectoId: string,
    estadoLogistica: string,
  ) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
    });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado.');

    if (!proyecto.autorizaCompras) {
      throw new BadRequestException(
        'Este proyecto no tiene autorización de compras activa. Coordine con Finanzas primero.',
      );
    }

    const estadosValidos = [
      'PendienteRevision',
      'EnRevision',
      'Aprobado',
      'Observado',
    ];
    if (!estadosValidos.includes(estadoLogistica)) {
      throw new BadRequestException(
        `Estado logístico inválido. Use: ${estadosValidos.join(', ')}`,
      );
    }

    return this.prisma.proyecto.update({
      where: { id: proyectoId },
      data: { estadoLogistica },
    });
  }

  // ============================================
  // REGLAS FINANCIERAS Y PRESUPUESTO
  // ============================================

  async getPresupuestoProyecto(proyectoId: string) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
    });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');

    const costoPresupuestado = Number(proyecto.costoPresupuestado);

    const gastos = await this.prisma.gasto.findMany({
      where: {
        proyectoId,
        estado: { in: ['SOLICITADO', 'PENDIENTE', 'APROBADO', 'PAGADO'] },
      },
    });

    let montoComprometido = 0;
    let montoEjecutado = 0;

    for (const g of gastos) {
      if (g.estado === 'PAGADO') {
        montoEjecutado += Number(g.montoTotal);
      } else {
        montoComprometido += Number(g.montoTotal);
      }
    }

    const totalConsumido = montoComprometido + montoEjecutado;
    const saldoDisponible = costoPresupuestado - totalConsumido;
    const porcentajeConsumido = costoPresupuestado > 0 ? (totalConsumido / costoPresupuestado) * 100 : 0;

    return {
      presupuestoTotal: costoPresupuestado,
      montoComprometido,
      montoEjecutado,
      saldoDisponible,
      porcentajeConsumido,
      autorizaCompras: proyecto.autorizaCompras
    };
  }

  // ============================================
  // PERSONAL DE OBRA
  // ============================================

  async createPersonal(dto: CreatePersonalDto, userId: string) {
    return this.prisma.personalProyecto.create({
      data: {
        proyectoId: dto.proyectoId,
        proyectoCodigo: dto.proyectoCodigo,
        proyectoNombre: dto.proyectoNombre,
        nombre: dto.nombre,
        documento: dto.documento,
        rol: dto.rol,
        tipoContrato: dto.tipoContrato,
        montoDiario: dto.montoDiario,
        fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : new Date(),
        fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
        activo: dto.activo ?? true,
        observaciones: dto.observaciones,
        creadoPor: userId,
      },
    });
  }

  async findAllPersonal(
    page: number = 1,
    limit: number = 50,
    proyectoId?: string,
    activo?: string,
    search?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (proyectoId) {
      where.proyectoId = proyectoId;
    }

    if (activo && activo !== 'all') {
      where.activo = activo === 'true';
    }

    if (search) {
      where.OR = [
        { nombre: { contains: search } },
        { documento: { contains: search } },
        { proyectoNombre: { contains: search } },
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.personalProyecto.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.personalProyecto.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findPersonalByProyecto(proyectoId: string) {
    return this.prisma.personalProyecto.findMany({
      where: { proyectoId, activo: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePersonal(id: string, dto: UpdatePersonalDto) {
    const personal = await this.prisma.personalProyecto.findUnique({
      where: { id },
    });
    if (!personal) throw new NotFoundException('Personal no encontrado');

    return this.prisma.personalProyecto.update({
      where: { id },
      data: {
        ...dto,
        fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : undefined,
        fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : undefined,
      },
    });
  }

  async removePersonal(id: string) {
    const personal = await this.prisma.personalProyecto.findUnique({
      where: { id },
    });
    if (!personal) throw new NotFoundException('Personal no encontrado');

    return this.prisma.personalProyecto.delete({ where: { id } });
  }

  // ============================================
  // COMPROMISO FINANCIERO DE MANO DE OBRA
  // ============================================

  async generarCompromisoPersonal(
    personalId: string,
    diasTrabajo: number,
    userId: string,
    cajaId?: string,
  ) {
    const personal = await this.prisma.personalProyecto.findUnique({
      where: { id: personalId },
    });
    if (!personal) throw new NotFoundException('Personal no encontrado');
    if (!personal.activo) throw new BadRequestException('El personal no está activo');

    const montoTotal = Number(personal.montoDiario) * diasTrabajo;
    if (montoTotal <= 0) throw new BadRequestException('El monto calculado debe ser mayor a cero');

    // Validar presupuesto del proyecto si aplica
    if (personal.proyectoId) {
      await this.validarReglasFinancieras(personal.proyectoId, montoTotal);
    }

    return this.prisma.$transaction(async (tx) => {
      const gasto = await tx.gasto.create({
        data: {
          codigo: `MO-${Date.now().toString().slice(-6)}`,
          proyectoId: personal.proyectoId,
          cajaId: cajaId || null,
          tipo: TipoGasto.PERSONAL,
          clasificacion: ClasificacionFinanciera.PROYECTO,
          categoriaDistribucion: CategoriaDistribucion.MANO_OBRA,
          concepto: `Mano de Obra: ${personal.nombre} - ${personal.rol} - ${diasTrabajo} días`,
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

      if (personal.proyectoId) {
        this.eventEmitter.emit('proyecto.costChanged', {
          proyectoId: personal.proyectoId,
        });
      }

      return {
        gasto,
        personal: personal.nombre,
        costoTotal: montoTotal,
        dias: diasTrabajo,
      };
    });
  }

  async generarCompromisoPersonalPorProyecto(proyectoId: string, userId: string) {
    // Encontrar todo el personal activo del proyecto
    const workers = await this.prisma.personalProyecto.findMany({
      where: { proyectoId, activo: true },
    });

    if (workers.length === 0) {
      throw new BadRequestException('No hay personal activo en este proyecto para comprometer');
    }

    // Calcular costo total sumando el costo de cada trabajador según su tipo de contrato
    let montoTotal = 0;
    const detalles: string[] = [];

    for (const w of workers) {
      const diario = Number(w.montoDiario);
      let dias: number;
      if (w.fechaFin && w.fechaInicio) {
        const diff = new Date(w.fechaFin).getTime() - new Date(w.fechaInicio).getTime();
        dias = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
      } else if (w.tipoContrato === 'Semanal') {
        dias = 6;
      } else if (w.tipoContrato === 'Mensual') {
        dias = 26;
      } else {
        dias = 1;
      }
      const costo = Math.round(diario * dias * 100) / 100;
      montoTotal += costo;
      detalles.push(`${w.nombre} (${w.rol}): ${dias}d × S/ ${diario.toFixed(2)} = S/ ${costo.toFixed(2)}`);
    }

    montoTotal = Math.round(montoTotal * 100) / 100;

    if (montoTotal <= 0) {
      throw new BadRequestException('El monto calculado debe ser mayor a cero');
    }

    // Validar presupuesto del proyecto
    await this.validarReglasFinancieras(proyectoId, montoTotal);

    return this.prisma.$transaction(async (tx) => {
      // Buscar si ya existe una solicitud de mano de obra en estado SOLICITADO para este proyecto
      const gastoExistente = await tx.gasto.findFirst({
        where: {
          proyectoId,
          tipo: TipoGasto.PERSONAL,
          categoriaDistribucion: CategoriaDistribucion.MANO_OBRA,
          estado: EstadoGasto.SOLICITADO,
        },
      });

      let gasto;
      if (gastoExistente) {
        // Actualizar el gasto pendiente existente en lugar de duplicar
        gasto = await tx.gasto.update({
          where: { id: gastoExistente.id },
          data: {
            concepto: `Mano de Obra: ${workers.length} trabajadores - Proyecto`,
            montoTotal,
            saldoPendiente: montoTotal,
            fechaEmision: new Date(),
          },
        });
      } else {
        // Crear nuevo gasto de mano de obra sólo si no existe uno pendiente
        gasto = await tx.gasto.create({
          data: {
            codigo: `MO-${proyectoId.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`,
            proyectoId,
            cajaId: null,
            tipo: TipoGasto.PERSONAL,
            clasificacion: ClasificacionFinanciera.PROYECTO,
            categoriaDistribucion: CategoriaDistribucion.MANO_OBRA,
            concepto: `Mano de Obra: ${workers.length} trabajadores - Proyecto`,
            montoTotal,
            saldoPendiente: montoTotal,
            estado: EstadoGasto.SOLICITADO,
            nivelAprobacion: 'PENDIENTE_FINANZAS',
            solicitanteId: userId,
            area: 'LogisticaYRecursos',
            fechaEmision: new Date(),
            registradoPorId: userId,
          } as any,
        });
      }

      this.eventEmitter.emit('proyecto.costChanged', {
        proyectoId,
      });

      return {
        gasto,
        totalTrabajadores: workers.length,
        costoTotal: montoTotal,
        detalles,
      };
    });
  }

  async getCostosPersonalProyecto(proyectoId: string) {
    const personal = await this.prisma.personalProyecto.findMany({
      where: { proyectoId },
    });

    // Gastos tipo PERSONAL vinculados a este proyecto
    const gastos = await this.prisma.gasto.findMany({
      where: {
        proyectoId,
        tipo: TipoGasto.PERSONAL,
        estado: { not: EstadoGasto.ANULADO },
      },
      orderBy: { fechaEmision: 'desc' },
    });

    const costoDiario = personal
      .filter((p) => p.activo)
      .reduce((sum, p) => sum + Number(p.montoDiario), 0);

    const costoTotalComprometido = gastos
      .filter((g) => g.estado === EstadoGasto.SOLICITADO || g.estado === EstadoGasto.PENDIENTE || g.estado === EstadoGasto.APROBADO)
      .reduce((sum, g) => sum + Number(g.montoTotal), 0);

    const costoTotalPagado = gastos
      .filter((g) => g.estado === EstadoGasto.PAGADO)
      .reduce((sum, g) => sum + Number(g.montoTotal), 0);

    return {
      proyectoId,
      totalTrabajadores: personal.length,
      trabajadoresActivos: personal.filter((p) => p.activo).length,
      costoDiarioTotal: costoDiario,
      costoTotalComprometido,
      costoTotalPagado,
      costoTotalAcumulado: costoTotalComprometido + costoTotalPagado,
      gastos: gastos.map((g) => ({
        id: g.id,
        codigo: g.codigo,
        concepto: g.concepto,
        monto: Number(g.montoTotal),
        estado: g.estado,
        nivelAprobacion: g.nivelAprobacion,
        fecha: g.fechaEmision,
      })),
      personal: personal.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        rol: p.rol,
        tipoContrato: p.tipoContrato,
        montoDiario: Number(p.montoDiario),
        activo: p.activo,
      })),
    };
  }

  async validarReglasFinancieras(proyectoId: string, montoNuevaOrden: number, excludeGastoId?: string, aprobarConCredito?: boolean) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
    });
    if (!proyecto) return;

    if (!proyecto.autorizaCompras) {
      throw new BadRequestException('Las compras se encuentran bloqueadas por el área financiera para este proyecto.');
    }

    const costoPresupuestado = Number(proyecto.costoPresupuestado);
    
    const gastos = await this.prisma.gasto.findMany({
      where: {
        proyectoId,
        estado: { in: ['SOLICITADO', 'PENDIENTE', 'APROBADO', 'PAGADO'] },
        id: excludeGastoId ? { not: excludeGastoId } : undefined
      },
    });

    const totalConsumido = gastos.reduce((acc, g) => acc + Number(g.montoTotal), 0);
    const saldoDisponible = costoPresupuestado - totalConsumido;

    const isSobregiroAutorizado = proyecto.descripcion?.includes('[SOBREGIRO_AUTORIZADO]');
    if (montoNuevaOrden > saldoDisponible && !aprobarConCredito && !isSobregiroAutorizado) {
      throw new BadRequestException(`No existe saldo suficiente para aprobar esta compra. La orden excede el presupuesto disponible del proyecto en S/ ${(montoNuevaOrden - saldoDisponible).toFixed(2)}. \n\nPresupuesto: S/ ${costoPresupuestado.toFixed(2)} \nComprometido/Ejecutado: S/ ${totalConsumido.toFixed(2)} \nSaldo Disponible: S/ ${saldoDisponible.toFixed(2)} \nNueva Compra: S/ ${montoNuevaOrden.toFixed(2)}`);
    }
  }

  // ============================================
  // CERTIFICADOS DE EQUIPOS
  // ============================================

  async createCertificadoEquipo(
    data: { nombre: string; fechaCalibracion: string; fechaVencimiento: string; url: string; tamano?: string },
    userId: string,
  ) {
    return this.prisma.documento.create({
      data: {
        nombre: data.nombre,
        tipo: TipoDocumento.Tecnica,
        subtype: 'CertificadoEquipo',
        url: data.url,
        estado: EstadoDocumento.Aprobado,
        subidoPor: userId,
        tamano: data.tamano || null,
        fechaVencimiento: new Date(data.fechaVencimiento),
        observaciones: data.fechaCalibracion,
        area: Area.LogisticaYRecursos,
      },
    });
  }

  async getCertificadosEquipos(search?: string) {
    const where: any = {
      subtype: 'CertificadoEquipo',
    };
    if (search) {
      where.nombre = { contains: search };
    }
    return this.prisma.documento.findMany({
      where,
      orderBy: { fechaSubida: 'desc' },
    });
  }

  async updateCertificadoEquipo(
    id: string,
    data: { nombre?: string; fechaCalibracion?: string; fechaVencimiento?: string; url?: string; tamano?: string },
  ) {
    const cert = await this.prisma.documento.findFirst({
      where: { id, subtype: 'CertificadoEquipo' },
    });
    if (!cert) throw new NotFoundException('Certificado no encontrado');

    const updateData: any = {};
    if (data.nombre) updateData.nombre = data.nombre;
    if (data.fechaCalibracion) updateData.observaciones = data.fechaCalibracion;
    if (data.fechaVencimiento) updateData.fechaVencimiento = new Date(data.fechaVencimiento);
    if (data.url !== undefined) {
      updateData.url = data.url;
      updateData.tamano = data.tamano || null;
    }

    return this.prisma.documento.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteCertificadoEquipo(id: string) {
    const cert = await this.prisma.documento.findFirst({
      where: { id, subtype: 'CertificadoEquipo' },
    });
    if (!cert) throw new NotFoundException('Certificado no encontrado');

    // Eliminar archivo físico
    if (cert.url) {
      await deletePhysicalFiles([cert.url]);
    }

    return this.prisma.documento.delete({ where: { id } });
  }
  // ============================================
  // VEHICULOS (SIN MIGRACIONES)
  // ============================================

  async createVehiculo(
    data: {
      placa: string;
      marcaModelo: string;
      soatUrl: string;
      soatVencimiento: string;
      rtUrl: string;
      rtVencimiento: string;
      tpUrl: string;
    },
    userId: string,
  ) {
    const vSoat = new Date(data.soatVencimiento);
    const vRt = new Date(data.rtVencimiento);
    const fechaVencimiento = vSoat < vRt ? vSoat : vRt;

    const vehiculoData = {
      soat: { url: data.soatUrl, vencimiento: data.soatVencimiento },
      revisionTecnica: { url: data.rtUrl, vencimiento: data.rtVencimiento },
      tarjetaPropiedad: { url: data.tpUrl },
    };

    return this.prisma.documento.create({
      data: {
        nombre: data.placa,
        numero: data.marcaModelo,
        tipo: TipoDocumento.Tecnica,
        subtype: 'Vehiculo',
        url: 'NO_APLICA',
        estado: EstadoDocumento.Aprobado,
        subidoPor: userId,
        fechaVencimiento: fechaVencimiento,
        observaciones: JSON.stringify(vehiculoData),
        area: Area.LogisticaYRecursos,
      },
    });
  }

  async getVehiculos(search?: string) {
    const where: any = {
      subtype: 'Vehiculo',
    };
    if (search) {
      where.nombre = { contains: search };
    }
    return this.prisma.documento.findMany({
      where,
      orderBy: { fechaSubida: 'desc' },
    });
  }

  async updateVehiculo(
    id: string,
    data: {
      placa?: string;
      marcaModelo?: string;
      soatUrl?: string;
      soatVencimiento?: string;
      rtUrl?: string;
      rtVencimiento?: string;
      tpUrl?: string;
    },
  ) {
    const vehiculoDoc = await this.prisma.documento.findFirst({
      where: { id, subtype: 'Vehiculo' },
    });
    if (!vehiculoDoc) throw new NotFoundException('Vehículo no encontrado');

    const vehiculoData = vehiculoDoc.observaciones ? JSON.parse(vehiculoDoc.observaciones) : {
      soat: { url: '', vencimiento: '' },
      revisionTecnica: { url: '', vencimiento: '' },
      tarjetaPropiedad: { url: '' },
    };

    const updateData: any = {};
    if (data.placa !== undefined) updateData.nombre = data.placa;
    if (data.marcaModelo !== undefined) updateData.numero = data.marcaModelo;

    if (data.soatUrl !== undefined) vehiculoData.soat.url = data.soatUrl;
    if (data.soatVencimiento !== undefined) vehiculoData.soat.vencimiento = data.soatVencimiento;
    if (data.rtUrl !== undefined) vehiculoData.revisionTecnica.url = data.rtUrl;
    if (data.rtVencimiento !== undefined) vehiculoData.revisionTecnica.vencimiento = data.rtVencimiento;
    if (data.tpUrl !== undefined) vehiculoData.tarjetaPropiedad.url = data.tpUrl;

    const vSoat = new Date(vehiculoData.soat.vencimiento);
    const vRt = new Date(vehiculoData.revisionTecnica.vencimiento);
    if (!isNaN(vSoat.getTime()) && !isNaN(vRt.getTime())) {
      updateData.fechaVencimiento = vSoat < vRt ? vSoat : vRt;
    } else if (!isNaN(vSoat.getTime())) {
      updateData.fechaVencimiento = vSoat;
    } else if (!isNaN(vRt.getTime())) {
      updateData.fechaVencimiento = vRt;
    }

    updateData.observaciones = JSON.stringify(vehiculoData);

    return this.prisma.documento.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteVehiculo(id: string) {
    const vehiculo = await this.prisma.documento.findFirst({
      where: { id, subtype: 'Vehiculo' },
    });
    if (!vehiculo) throw new NotFoundException('Vehículo no encontrado');

    if (vehiculo.observaciones) {
      try {
        const data = JSON.parse(vehiculo.observaciones);
        const filesToDelete = [];
        if (data.soat?.url) filesToDelete.push(data.soat.url);
        if (data.revisionTecnica?.url) filesToDelete.push(data.revisionTecnica.url);
        if (data.tarjetaPropiedad?.url) filesToDelete.push(data.tarjetaPropiedad.url);
        
        if (filesToDelete.length > 0) {
          await deletePhysicalFiles(filesToDelete);
        }
      } catch (e) {
      }
    }

    return this.prisma.documento.delete({ where: { id } });
  }
}
