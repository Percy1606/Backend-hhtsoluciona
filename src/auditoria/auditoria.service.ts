import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

// Días de retención para logs no críticos
const RETENTION_DAYS = 90;

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private prisma: PrismaService) {}

  async createLog(data: {
    usuarioId: string;
    modulo: string;
    accion: string;
    detalles?: any;
    ip?: string;
  }) {
    return await (this.prisma as any).auditLog.create({
      data: {
        usuarioId: data.usuarioId,
        modulo: data.modulo,
        accion: data.accion,
        detalles: data.detalles || {},
        ip: data.ip,
      },
    });
  }

  async findAll(filters: {
    page?: number;
    limit?: number;
    modulo?: string;
    usuarioId?: string;
    search?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.modulo) where.modulo = filters.modulo;
    if (filters.usuarioId) where.usuarioId = filters.usuarioId;
    if (filters.fechaDesde || filters.fechaHasta) {
      where.fechaCreacion = {};
      if (filters.fechaDesde) where.fechaCreacion.gte = new Date(`${filters.fechaDesde}T00:00:00`);
      if (filters.fechaHasta) where.fechaCreacion.lte = new Date(`${filters.fechaHasta}T23:59:59`);
    }
    if (filters.search) {
      where.OR = [
        { accion: { contains: filters.search } },
        { detalles: { path: '$.mensaje', string_contains: filters.search } },
        { modulo: { contains: filters.search } },
        { usuario: { nombre: { contains: filters.search } } },
      ];
    }

    const [rawLogs, total] = await Promise.all([
      (this.prisma as any).auditLog.findMany({
        where,
        include: {
          usuario: {
            select: { nombre: true, username: true },
          },
        },
        orderBy: { fechaCreacion: 'desc' },
        skip,
        take: limit,
      }),
      (this.prisma as any).auditLog.count({ where }),
    ]);

    // Limpiar IDs y UUIDs de los detalles para que sea información funcional
    const data = rawLogs.map((log: any) => ({
      id: log.id,
      usuarioId: log.usuarioId,
      usuario: log.usuario,
      modulo: log.modulo,
      accion: log.accion,
      detalles: this.filterTechnicalData(log.detalles),
      ip: log.ip,
      fechaCreacion: log.fechaCreacion,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private filterTechnicalData(obj: any): any {
    if (!obj) return obj;

    // Si es un string que parece JSON, intentar parsearlo
    if (typeof obj === 'string') {
      try {
        const parsed = JSON.parse(obj);
        if (typeof parsed === 'object') {
          return this.filterTechnicalData(parsed);
        }
      } catch (e) {
        return obj;
      }
    }

    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj
        .map((item) => this.filterTechnicalData(item))
        .filter((item) => item !== undefined && item !== null);
    }

    const filtered: any = {};
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const key in obj) {
      const value = obj[key];

      // 1. Omitir por nombre de clave técnica
      const isTechnicalKey =
        key.toLowerCase() === 'id' ||
        key.toLowerCase() === 'uuid' ||
        key.toLowerCase().endsWith('id') ||
        key.toLowerCase().endsWith('uuid') ||
        key.toLowerCase().includes('_id');

      if (isTechnicalKey) continue;

      // 2. Omitir si el valor es un UUID
      if (typeof value === 'string' && uuidRegex.test(value)) continue;

      // 3. Procesar recursivamente
      const processedValue = this.filterTechnicalData(value);

      // Solo agregar si el valor procesado tiene contenido útil
      if (processedValue !== undefined && processedValue !== null) {
        if (
          typeof processedValue === 'object' &&
          Object.keys(processedValue).length === 0
        )
          continue;
        filtered[key] = processedValue;
      }
    }

    return Object.keys(filtered).length > 0 ? filtered : null;
  }

  /**
   * Purga automática nocturna: elimina logs de hace más de RETENTION_DAYS días,
   * EXCEPTO los que corresponden a acciones de eliminación (críticos y permanentes).
   * Se ejecuta todos los días a las 02:00 AM (hora de Lima).
   */
  @Cron('0 2 * * *', { timeZone: 'America/Lima' })
  async purgarLogsAntiguos() {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - RETENTION_DAYS);

    try {
      const resultado = await (this.prisma as any).auditLog.deleteMany({
        where: {
          fechaCreacion: { lt: fechaLimite },
          // Conservar permanentemente cualquier acción de eliminación
          NOT: {
            accion: { startsWith: 'ELIMINAR' },
          },
        },
      });
      this.logger.log(
        `Purga de auditoría: ${resultado.count} logs eliminados (anteriores a ${fechaLimite.toLocaleDateString('es-PE')}).`,
      );
      return resultado.count;
    } catch (err) {
      this.logger.error('Error en la purga automática de auditoría:', err);
      return 0;
    }
  }

  /**
   * Purga manual invocada desde el controlador por un ADMIN.
   * Misma lógica que la automática.
   */
  async purgarManual(): Promise<{ eliminados: number; fechaLimite: string }> {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - RETENTION_DAYS);

    const resultado = await (this.prisma as any).auditLog.deleteMany({
      where: {
        fechaCreacion: { lt: fechaLimite },
        NOT: {
          accion: { startsWith: 'ELIMINAR' },
        },
      },
    });

    this.logger.log(
      `Purga manual: ${resultado.count} logs eliminados por admin.`,
    );

    return {
      eliminados: resultado.count,
      fechaLimite: fechaLimite.toLocaleDateString('es-PE'),
    };
  }

  /**
   * Limpia TODO el ruido de auditoría sin importar la fecha:
   * Elimina todos los logs CREAR_* y ACTUALIZAR_*.
   * Solo conserva los ELIMINAR_* (permanentes) y cualquier otro prefijo.
   */
  async limpiarRuido(): Promise<{ eliminados: number }> {
    const resultado = await (this.prisma as any).auditLog.deleteMany({
      where: {
        OR: [
          { accion: { startsWith: 'CREAR' } },
          { accion: { startsWith: 'ACTUALIZAR' } },
        ],
      },
    });

    this.logger.log(
      `Limpieza de ruido: ${resultado.count} logs CREAR/ACTUALIZAR eliminados por admin.`,
    );

    return { eliminados: resultado.count };
  }
}
