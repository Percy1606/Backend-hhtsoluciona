import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCotizacionDto } from './dto/create-cotizacion.dto';
import { UpdateCotizacionDto } from './dto/update-cotizacion.dto';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

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
      include: { cliente: true },
    });

    if (!oldQuote) {
      throw new NotFoundException(`Cotización con ID "${id}" no encontrada.`);
    }

    const updated = await this.prisma.cotizacion.update({
      where: { id },
      data: {
        ...dto,
        fecha: dto.fecha ? new Date(dto.fecha) : undefined,
      },
    });

    // TRIGGER: Notificación de Venta Cerrada
    if (dto.estado === 'Aprobado' && oldQuote.estado !== 'Aprobado') {
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
    return this.prisma.cotizacion.delete({ where: { id } });
  }

  private async generateCode(): Promise<string> {
    const count = await this.prisma.cotizacion.count();
    const year = new Date().getFullYear();
    return `COT-${year}-${(count + 1).toString().padStart(3, '0')}`;
  }
}
