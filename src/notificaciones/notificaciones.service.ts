import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async findAllForUser(
    usuarioId: string,
    page: number = 1,
    limit: number = 50,
    rol: string = 'USER',
  ) {
    const skip = (page - 1) * limit;

    // Si es ADMIN o SUPERVISOR, puede ver todas, si no, solo las suyas
    const where: any =
      rol === 'ADMIN' || rol === 'SUPERVISOR' ? {} : { usuarioId };

    const [data, total] = await Promise.all([
      this.prisma.notificacion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notificacion.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markAsRead(id: string) {
    return this.prisma.notificacion.update({
      where: { id },
      data: { leida: true },
    });
  }

  async markAsUnread(id: string) {
    return this.prisma.notificacion.update({
      where: { id },
      data: { leida: false },
    });
  }

  async markAllAsRead(usuarioId: string, rol: string = 'USER') {
    const where: any = { leida: false };

    if (rol !== 'ADMIN' && rol !== 'SUPERVISOR') {
      where.usuarioId = usuarioId;
    }

    return this.prisma.notificacion.updateMany({
      where,
      data: { leida: true },
    });
  }

  async getUnreadCount(usuarioId: string, rol: string = 'USER') {
    const where: any = { leida: false };

    if (rol !== 'ADMIN' && rol !== 'SUPERVISOR') {
      where.usuarioId = usuarioId;
    }

    return this.prisma.notificacion.count({ where });
  }

  async create(data: any) {
    // CONTROL DE DUPLICADOS RELAJADO: Solo evitar si es exactamente la misma en la última hora (antes era 24h)
    // para permitir re-asignaciones rápidas o múltiples tareas similares.
    const duplicate = await this.prisma.notificacion.findFirst({
      where: {
        usuarioId: data.usuarioId,
        titulo: data.titulo,
        mensaje: data.mensaje,
        tipo: data.tipo,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000),
        },
      },
    });

    if (duplicate) {
      this.logger.log(
        `Notificación duplicada reciente omitida para usuario ${data.usuarioId}`,
      );
      return duplicate;
    }

    const notificacion = await (this.prisma.notificacion as any).create({
      data: {
        usuarioId: data.usuarioId || null,
        titulo: data.titulo,
        mensaje: data.mensaje,
        tipo: data.tipo,
        esGlobal: data.esGlobal || false,
        fechaProgramada: data.fechaProgramada
          ? new Date(data.fechaProgramada)
          : null,
        actividadComercialId: data.actividadComercialId || null,
      },
    });

    // EMISIÓN INSTANTÁNEA (ERROR CORREGIDO):
    // Enviamos por SSE inmediatamente para que el usuario la vea en su campana al instante,
    // aunque la fecha de la tarea sea para el futuro.
    this.emitSse(notificacion);

    return notificacion;
  }

  /**
   * Emite una notificación a través de SSE
   */
  emitSse(notificacion: any) {
    if (notificacion.esGlobal) {
      this.eventEmitter.emit('notification.global', notificacion);
    } else if (notificacion.usuarioId) {
      this.eventEmitter.emit(
        `notification.${notificacion.usuarioId}`,
        notificacion,
      );
    }
  }
}
