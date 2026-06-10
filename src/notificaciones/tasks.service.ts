import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from './notificaciones.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
  ) {}

  // Se ejecuta todos los días a las 8:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleDailyNotifications() {
    this.logger.log(
      'Iniciando proceso diario de notificaciones automáticas...',
    );

    await this.checkExpiringQuotes();
    await this.checkOverdueActivities();
    await this.checkAbandonedClients();
    await this.checkOverdueVisits();
    await this.checkDelayedProjects();
  }

  // Se ejecuta cada 15 minutos para procesar notificaciones programadas
  @Cron('0 */15 * * * *')
  async handleScheduledNotifications() {
    this.logger.log('Revisando notificaciones programadas pendientes...');
    const now = new Date();

    const pendingNotifications = await this.prisma.notificacion.findMany({
      where: {
        fechaProgramada: { lte: now },
        leida: false,
        // Aquí podríamos añadir un campo 'notificada' en el futuro si queremos ser más estrictos,
        // pero por ahora usaremos la lógica de emitir las que ya pasaron su fecha.
      },
    });

    for (const notif of pendingNotifications) {
      this.notificacionesService.emitSse(notif);
    }

    if (pendingNotifications.length > 0) {
      this.logger.log(
        `Se han emitido ${pendingNotifications.length} notificaciones programadas.`,
      );
    }
  }

  // 4. Visitas Técnicas Vencidas (PENDIENTE y fecha pasada)
  private async checkOverdueVisits() {
    const today = new Date();
    const overdueVisits = await this.prisma.fichaTecnica.findMany({
      where: {
        estado: 'PENDIENTE',
        fechaVisita: { lt: today },
      },
      include: { cliente: true, tecnico: true },
    });

    for (const visit of overdueVisits) {
      // Notificar al técnico
      const userTecnico = await this.prisma.usuario.findUnique({
        where: { responsableId: visit.tecnicoId },
      });

      if (userTecnico) {
        // Evitar duplicados: Si ya existe una notificación de este tipo para este técnico hoy
        const existingNotif = await this.prisma.notificacion.findFirst({
          where: {
            usuarioId: userTecnico.id,
            titulo: 'Visita Técnica Vencida',
            mensaje: { contains: visit.cliente.empresa },
            createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        });

        if (!existingNotif) {
          await this.notificacionesService.create({
            usuarioId: userTecnico.id,
            titulo: 'Visita Técnica Vencida',
            mensaje: `Tienes una inspección pendiente para el cliente ${visit.cliente.empresa} que debía realizarse el ${visit.fechaVisita.toLocaleDateString()}.`,
            tipo: 'TECNICO',
          });
        }
      }
    }

  }

  // 5. Proyectos Retrasados (Semaforo Rojo)
  private async checkDelayedProjects() {
    const delayedProjects = await this.prisma.proyecto.findMany({
      where: {
        estado: 'EnEjecucion',
        semaforo: 'Rojo',
      },
      include: { responsablePrincipal: true },
    });

    for (const proyecto of delayedProjects) {
      const user = await this.prisma.usuario.findUnique({
        where: { responsableId: proyecto.responsablePrincipalId },
      });

      if (user) {
        await this.notificacionesService.create({
          usuarioId: user.id,
          titulo: 'Proyecto en Estado Crítico',
          mensaje: `El proyecto ${proyecto.nombre} está marcado en ROJO. Por favor revise el cronograma y actividades.`,
          tipo: 'SISTEMA',
        });
      }
    }
  }

  // 1. Cotizaciones que vencen en 48 horas
  private async checkExpiringQuotes() {
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const expiringQuotes = await this.prisma.cotizacion.findMany({
      where: {
        estado: { notIn: ['Aprobado', 'Rechazado', 'Obsoleto'] },
        fecha: {
          gte: tomorrow,
          lte: twoDaysFromNow,
        },
      },
      include: { cliente: true },
    });

    for (const quote of expiringQuotes) {
      // Buscamos al asesor asignado al cliente usando responsableId (más robusto que el nombre)
      let asesor = null;

      if (quote.cliente.responsableId) {
        asesor = await this.prisma.usuario.findUnique({
          where: { responsableId: quote.cliente.responsableId },
        });
      }

      // Fallback al nombre si no hay ID (comportamiento legado)
      if (!asesor && quote.cliente.asignadoA) {
        asesor = await this.prisma.usuario.findFirst({
          where: { responsable: { nombre: quote.cliente.asignadoA } },
        });
      }

      if (asesor) {
        await this.notificacionesService.create({
          usuarioId: asesor.id,
          titulo: 'Cotización por Vencer',
          mensaje: `La cotización ${quote.codigo} del cliente ${quote.cliente.empresa} vence en menos de 48 horas.`,
          tipo: 'COTIZACION',
        });
      }
    }
  }

  // 2. Actividades (Tareas) vencidas
  private async checkOverdueActivities() {
    const today = new Date();

    const overdueActivities = await this.prisma.actividad.findMany({
      where: {
        estado: { notIn: ['Completada', 'Validada'] },
        fechaVencimiento: { lt: today },
      },
      include: { proyecto: true },
    });

    for (const activity of overdueActivities) {
      // Notificar al responsable de la tarea
      const user = await this.prisma.usuario.findUnique({
        where: { responsableId: activity.responsablePrincipalId },
      });

      if (user) {
        await this.notificacionesService.create({
          usuarioId: user.id,
          titulo: 'Tarea Vencida',
          mensaje: `La actividad "${activity.descripcion}" del proyecto ${activity.proyecto.nombre} ha superado su fecha de vencimiento.`,
          tipo: 'SISTEMA',
        });
      }
    }
  }

  // 3. Clientes sin gestión en más de 7 días
  private async checkAbandonedClients() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const abandonedClients = await this.prisma.cliente.findMany({
      where: {
        deletedAt: null,
        etapaComercial: { notIn: ['Ganado', 'Perdido'] },
        OR: [
          { ultimoContacto: { lt: sevenDaysAgo } },
          { ultimoContacto: null, fechaCreacion: { lt: sevenDaysAgo } },
        ],
      },
    });

    for (const client of abandonedClients) {
      const asesor = await this.prisma.usuario.findFirst({
        where: { responsable: { nombre: client.asignadoA } },
      });

      if (asesor) {
        await this.notificacionesService.create({
          usuarioId: asesor.id,
          titulo: 'Cliente sin Seguimiento',
          mensaje: `El cliente ${client.empresa} no ha tenido gestiones en los últimos 7 días.`,
          tipo: 'SEGUIMIENTO',
        });
      }
    }
  }
}
