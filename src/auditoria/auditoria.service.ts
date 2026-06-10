import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditoriaService {
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
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.modulo) where.modulo = filters.modulo;
    if (filters.usuarioId) where.usuarioId = filters.usuarioId;
    if (filters.search) {
      where.OR = [
        { accion: { contains: filters.search } },
        { detalles: { path: '$.mensaje', string_contains: filters.search } },
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
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
        if (typeof processedValue === 'object' && Object.keys(processedValue).length === 0) continue;
        filtered[key] = processedValue;
      }
    }
    
    return Object.keys(filtered).length > 0 ? filtered : null;
  }
}
