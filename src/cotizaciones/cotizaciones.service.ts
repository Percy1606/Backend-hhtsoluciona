import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCotizacionDto } from './dto/create-cotizacion.dto';
import { UpdateCotizacionDto } from './dto/update-cotizacion.dto';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { FinanzasService } from '../finanzas/finanzas.service';
import { deletePhysicalFiles } from '../common/utils/file-utils';

@Injectable()
export class CotizacionesService {
  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
    private finanzasService: FinanzasService,
  ) {}

  async create(dto: CreateCotizacionDto) {
    try {
      // VALIDACIÓN: Evitar propuestas duplicadas para el mismo cliente
      const existingQuote = await this.prisma.cotizacion.findFirst({
        where: { clientId: dto.clientId },
      });

      if (existingQuote) {
        throw new BadRequestException({
          message:
            'Ya existe una propuesta técnica registrada para este cliente. Solo puede editar la propuesta existente.',
          error: 'Propuesta Duplicada',
        });
      }

      const {
        fileUrl,
        fileName,
        fileType,
        fecha,
        alcance,
        cajaId,
        hitos,
        ...quoteData
      } = dto;
      const codigo = await this.generateCode();

      // Normalización de datos para Prisma
      const data: any = {
        ...quoteData,
        codigo,
        fecha: fecha ? new Date(fecha) : new Date(),
        alcance: alcance || [],
        hitosPago: {
          create:
            hitos?.map((h) => ({
              descripcion: h.descripcion,
              porcentaje: Number(h.porcentaje),
              monto: Number(h.monto),
              fechaEstimada: h.fechaEstimada ? new Date(h.fechaEstimada) : null,
              estado: h.estado || 'PENDIENTE',
            })) || [],
        },
        documentos: {
          create: fileUrl
            ? [
                {
                  nombre: fileName || 'Cotización',
                  url: fileUrl,
                  tipo: 'Tecnica',
                  estado: 'Borrador',
                  subidoPor: 'Admin',
                },
              ]
            : [],
        },
      };

      console.log(
        '[Cotizaciones] Intentando crear con datos:',
        JSON.stringify(data, null, 2),
      );

      const cotizacion = await this.prisma.$transaction(async (tx) => {
        const result = await tx.cotizacion.create({
          data,
          include: {
            cliente: true,
            documentos: true,
            hitosPago: true,
          },
        });

        // LÓGICA DE INTEGRACIÓN FINANCIERA (CAJA) - Se ejecuta si hay hitos COBRADOS
        const montoObjetivo = result.hitosPago
          .filter((h: any) => h.estado === 'COBRADO')
          .reduce((sum: number, h: any) => sum + Number(h.monto), 0);

        if (montoObjetivo > 0) {
          if (!cajaId) {
            throw new BadRequestException('Debe seleccionar una caja de destino para registrar el cobro de los hitos.');
          }

          const conceptoText = `Cobro Inicial Cotización: ${result.codigo} | Monto Cobrado: S/ ${montoObjetivo} | Cliente: ${result.cliente?.empresa}`;

          await this.finanzasService.sincronizarSaldoIngreso(
            tx,
            montoObjetivo,
            cajaId,
            conceptoText,
            'COTIZACION',
            result.id,
            'SISTEMA'
          );
        }

        return result;
      });

      // TRIGGER AUTOMÁTICO: Mover a "Cotización Enviada"
      try {
        await this.prisma.cliente.update({
          where: { id: cotizacion.clientId },
          data: {
            etapaComercial: 'Cotización Enviada',
            accion: 'Hacer Seguimiento',
            ultimoContacto: new Date(),
          },
        });

        await this.prisma.interaccion.create({
          data: {
            clientId: cotizacion.clientId,
            fecha: new Date(),
            tipo: 'Propuesta',
            accion: 'Cotización Registrada',
            observaciones: `Se registró la cotización ${cotizacion.codigo} por un monto de S/ ${cotizacion.monto}. El cliente ha sido movido automáticamente a etapa "Cotización Enviada".`,
            usuario: 'SISTEMA',
          },
        });
      } catch (triggerError) {
        console.error(
          '[Cotizaciones] Error en trigger de actualización de etapa:',
          triggerError.message,
        );
      }

      return cotizacion;
    } catch (error) {
      console.error('[Cotizaciones] Error detallado al crear:', error);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        'Error al registrar la cotización: ' +
          (error.message || 'Datos inválidos'),
      );
    }
  }

  async update(id: string, dto: any, user?: any) {
    const oldQuote = await this.prisma.cotizacion.findUnique({
      where: { id },
      include: { cliente: true, documentos: true },
    });

    if (!oldQuote) {
      throw new NotFoundException(`Cotización con ID "${id}" no encontrada.`);
    }

    const {
      fileUrl,
      fileName,
      fileType,
      fecha,
      alcance,
      cajaId,
      hitos,
      ...quoteData
    } = dto;

    // Preparar datos para la actualización de la cotización
    const updateData: any = {
      ...quoteData,
      fecha: fecha ? new Date(fecha) : undefined,
      alcance: alcance !== undefined ? alcance : undefined,
    };

    if (hitos) {
      updateData.hitosPago = {
        deleteMany: {},
        create: hitos.map((h: any) => ({
          descripcion: h.descripcion,
          porcentaje: Number(h.porcentaje),
          monto: Number(h.monto),
          fechaEstimada: h.fechaEstimada ? new Date(h.fechaEstimada) : null,
          estado: h.estado || 'PENDIENTE',
        })),
      };
    }

    // Si se subió un nuevo archivo, lo agregamos a los documentos de la cotización e incrementamos la versión
    if (fileUrl) {
      const nextVersion = (oldQuote.version || 1) + 1;
      updateData.version = nextVersion;
      updateData.documentos = {
        create: [
          {
            nombre: fileName || `Cotización v${nextVersion}`,
            url: fileUrl,
            tipo: 'Tecnica',
            estado: 'Borrador',
            subidoPor: 'Admin',
            version: nextVersion + '',
          },
        ],
      };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.cotizacion.update({
        where: { id },
        data: updateData,
        include: {
          cliente: true,
          documentos: true,
          hitosPago: true,
        },
      });

      // LÓGICA DE INTEGRACIÓN FINANCIERA (CAJA)
      // Se sincroniza siempre que haya hitos COBRADOS o esté aprobada
      
      // Calcular cuánto ya se ingresó considerando ingresos y egresos
      const transacciones = await tx.transaccionCaja.findMany({
        where: {
          referenciaTipo: 'COTIZACION',
          referenciaId: id
        }
      });

      let saldoIngresado = 0;
      for (const t of transacciones) {
        if (t.tipo === 'INGRESO') saldoIngresado += Number(t.monto);
        if (t.tipo === 'EGRESO') saldoIngresado -= Number(t.monto);
      }

      // El monto a sincronizar depende de los hitos cobrados
      let montoObjetivo = 0;
      if (result.hitosPago && result.hitosPago.length > 0) {
        montoObjetivo = result.hitosPago
          .filter((h: any) => h.estado === 'COBRADO')
          .reduce((sum: number, h: any) => sum + Number(h.monto), 0);
      } else if (['Aprobado', 'Aprobada'].includes(result.estado)) {
        montoObjetivo = Number(result.monto);
      }

      const diferencia = montoObjetivo - saldoIngresado;

      if (diferencia !== 0) {
        if (!cajaId) {
          throw new BadRequestException('Debe seleccionar una caja de destino/origen para registrar el cobro o ajuste de dinero.');
        }

        const proyectoRelacionado = await tx.proyecto.findFirst({
          where: { cotizacionOrigen: { id: result.id } }
        });
        const nombreProyecto = proyectoRelacionado?.nombre || 'Sin proyecto asignado';

        const signo = diferencia > 0 ? '+' : '-';
        const conceptoText = `Ajuste Cotización: ${result.codigo} | Cobrado anterior: S/ ${saldoIngresado} | Nuevo Cobrado: S/ ${montoObjetivo} | Ajuste: ${signo}S/ ${Math.abs(diferencia)} | Proyecto: ${nombreProyecto}`;

        if (diferencia > 0) {
          await this.finanzasService.sincronizarSaldoIngreso(
            tx,
            diferencia,
            cajaId,
            conceptoText,
            'COTIZACION',
            result.id,
            user?.id || 'SISTEMA'
          );
        } else {
          await this.finanzasService.sincronizarSaldoEgreso(
            tx,
            Math.abs(diferencia),
            cajaId,
            conceptoText,
            'COTIZACION',
            result.id,
            user?.id || 'SISTEMA'
          );
        }
      }

      return result;
    });

    // TRIGGER: Notificación de Venta Cerrada y Actualización de Cliente
    if (['Aprobado', 'Aprobada'].includes(dto.estado) && !['Aprobado', 'Aprobada'].includes(oldQuote.estado)) {
      try {
        // 1. Actualizar Etapa del Cliente a "Ganado"
        await this.prisma.cliente.update({
          where: { id: updated.clientId },
          data: {
            etapaComercial: 'Ganado',
            accion: 'Finalizado',
            esClienteReal: true,
            ultimoContacto: new Date(),
          },
        });

        // 2. Crear interacción de cierre
        await this.prisma.interaccion.create({
          data: {
            clientId: updated.clientId,
            cotizacionId: updated.id,
            fecha: new Date(),
            tipo: 'Venta',
            accion: 'Cotización Aprobada',
            observaciones: `La cotización ${updated.codigo} por S/ ${updated.monto} ha sido aprobada. El cliente ha pasado a etapa "Ganado".`,
            usuario: 'SISTEMA',
          },
        });
      } catch (triggerError) {
        console.error(
          '[Cotizaciones] Error al actualizar estado de cliente en aprobación:',
          triggerError.message,
        );
      }

      const admins = await this.prisma.usuario.findMany({
        where: { rol: 'ADMIN' },
      });
      for (const admin of admins) {
        await this.notificacionesService.create({
          usuarioId: admin.id,
          titulo: '¡Venta Cerrada!',
          mensaje: `La cotización ${updated.codigo} del cliente ${oldQuote.cliente.empresa} ha sido APROBADA.`,
          tipo: 'COTIZACION',
        });
      }
    }

    return updated;
  }

  async findAll(page: number = 1, limit: number = 20, filters: any = {}) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.estado) where.estado = filters.estado;
    if (filters.search) {
      where.OR = [
        { codigo: { contains: filters.search } },
        { referencia: { contains: filters.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.cotizacion.findMany({
        where,
        include: {
          cliente: true,
          documentos: true,
          interacciones: true,
          proyectoGenerado: true,
          hitosPago: true,
        },
        orderBy: { fechaCreacion: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.cotizacion.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const cotizacion = await this.prisma.cotizacion.findUnique({
      where: { id },
      include: {
        cliente: true,
        documentos: true,
        interacciones: true,
        proyectoGenerado: true,
        hitosPago: true,
      },
    });
    if (!cotizacion) {
      throw new NotFoundException(`Cotización con ID "${id}" no encontrada.`);
    }
    return cotizacion;
  }

  async remove(id: string) {
    const cotizacion = await this.prisma.cotizacion.findUnique({
      where: { id },
      include: { documentos: { select: { url: true } } },
    });

    if (!cotizacion) {
      throw new NotFoundException(`Cotización con ID "${id}" no encontrada.`);
    }

    const urlsToDelete = cotizacion.documentos.map((d) => d.url).filter(Boolean);

    const result = await this.prisma.cotizacion.delete({ where: { id } });

    await deletePhysicalFiles(urlsToDelete);

    return result;
  }

  private async generateCode(): Promise<string> {
    const count = await this.prisma.cotizacion.count();
    const year = new Date().getFullYear();
    return `COT-${year}-${(count + 1).toString().padStart(3, '0')}`;
  }
}
