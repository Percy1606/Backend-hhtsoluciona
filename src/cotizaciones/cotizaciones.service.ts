import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCotizacionDto } from './dto/create-cotizacion.dto';
import { UpdateCotizacionDto } from './dto/update-cotizacion.dto';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { deletePhysicalFiles } from '../common/utils/file-utils';

@Injectable()
export class CotizacionesService {
  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
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

      const { fileUrl, fileName, fileType, fecha, alcance, ...quoteData } = dto;
      const codigo = await this.generateCode();

      // Normalización de datos para Prisma
      const data: any = {
        ...quoteData,
        codigo,
        fecha: fecha ? new Date(fecha) : new Date(),
        alcance: alcance || [],
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

      const cotizacion = await this.prisma.cotizacion.create({
        data,
        include: {
          cliente: true,
          documentos: true,
        },
      });

      // TRIGGER AUTOMÁTICO: Mover a "Cotización Enviada" (Error Solicitado)
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

        console.log(
          `[Cotizaciones] Cliente ${cotizacion.cliente?.empresa} movido automáticamente a "Cotización Enviada"`,
        );
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

  async update(id: string, dto: UpdateCotizacionDto) {
    const oldQuote = await this.prisma.cotizacion.findUnique({
      where: { id },
      include: { cliente: true, documentos: true },
    });

    if (!oldQuote) {
      throw new NotFoundException(`Cotización con ID "${id}" no encontrada.`);
    }

    const { fileUrl, fileName, fileType, fecha, alcance, ...quoteData } = dto;

    // Preparar datos para la actualización de la cotización
    const updateData: any = {
      ...quoteData,
      fecha: fecha ? new Date(fecha) : undefined,
      alcance: alcance !== undefined ? alcance : undefined,
    };

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

    const updated = await this.prisma.cotizacion.update({
      where: { id },
      data: updateData,
      include: {
        cliente: true,
        documentos: true,
      },
    });

    // TRIGGER: Notificación de Venta Cerrada y Actualización de Cliente
    if (dto.estado === 'Aprobado' && oldQuote.estado !== 'Aprobado') {
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
