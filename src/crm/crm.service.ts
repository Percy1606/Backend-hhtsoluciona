import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { CreateInteraccionDto } from './dto/create-interaccion.dto';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { deletePhysicalFiles } from '../common/utils/file-utils';

@Injectable()
export class CrmService {
  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
    private auditoriaService: AuditoriaService,
  ) {}

  async findAllClientes(
    page: number = 1,
    limit: number = 20,
    filters: any = {},
    user?: any,
  ) {
    const skip = (page - 1) * limit;

    // Construcción del objeto where para Prisma
    const where: any = {};

    if (filters.search) {
      where.OR = [
        { empresa: { contains: filters.search } },
        { ruc: { contains: filters.search } },
        { contacto: { contains: filters.search } },
        { codigo: { contains: filters.search } },
      ];
    }

    if (filters.tarifa) where.tarifa = filters.tarifa;
    if (filters.zona) where.zona = filters.zona;
    if (filters.asignadoA) where.asignadoA = filters.asignadoA;
    if (filters.clasificacion) where.clasificacion = filters.clasificacion;
    if (filters.estado) where.estado = filters.estado;
    if (filters.etapaComercial) where.etapaComercial = filters.etapaComercial;
    
    // FILTRO POR FECHA DE CREACIÓN (PROSPECTANDO POR DÍA)
    if (filters.startDate || filters.endDate) {
      where.fechaCreacion = {};
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        where.fechaCreacion.gte = start;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.fechaCreacion.lte = end;
      }
    }

    if (filters.esClienteReal !== undefined)
      where.esClienteReal =
        filters.esClienteReal === 'true' || filters.esClienteReal === true;

    // ELIMINADO: Ahora todos los usuarios con acceso al CRM pueden ver todos los clientes
    /*
    if (user && user.rol !== 'ADMIN') {
      const responsableId = user.responsable?.id;
      if (responsableId) {
        where.responsableId = responsableId;
      } else {
        where.responsableId = 'NONE';
      }
    }
    */

    where.deletedAt = null;

    try {
      const [data, total] = await Promise.all([
        this.prisma.cliente.findMany({
          where,
          include: {
            interacciones: {
              orderBy: { fecha: 'desc' },
            },
            proyectos: true,
            documentos: true,
            _count: {
              select: { cotizaciones: true }
            }
          },
          orderBy: { fechaCreacion: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.cliente.count({ where }),
      ]);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Error in findAllClientes:', error);
      throw new InternalServerErrorException(
        'Error al obtener la lista de clientes.',
      );
    }
  }

  async findOneCliente(id: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: id.includes('-') ? { id } : { codigo: id },
      include: {
        interacciones: {
          orderBy: { fecha: 'desc' },
        },
        proyectos: true,
        documentos: true,
        _count: {
          select: { cotizaciones: true }
        }
      },
    });
    if (!cliente || cliente.deletedAt) {
      throw new NotFoundException(
        `Cliente con ID/CÓDIGO "${id}" no encontrado.`,
      );
    }
    return cliente;
  }

  async createCliente(dto: CreateClienteDto, user?: any) {
    try {
      const codigo = dto.codigo || (await this.generateClienteCode());

      // Normalización de Enums para evitar errores de Prisma
      const normalizeEnum = (val: string, defaultVal: string) => {
        if (!val) return defaultVal;
        const normalized = val.toUpperCase().replace(/\s+/g, '_');
        return normalized;
      };

      const stage = (dto.etapaComercial || '').toUpperCase();
      const esClienteReal = stage === 'GANADO' || dto.esClienteReal || false;

      let tipoCliente = normalizeEnum(
        dto.tipoCliente || 'PROSPECTO',
        'PROSPECTO',
      );
      if (esClienteReal) tipoCliente = 'CLIENTE';

      const clasificacion = normalizeEnum(
        dto.clasificacion || 'RENTABLE',
        'RENTABLE',
      );

      const safeDate = (dateStr?: string) => {
        if (!dateStr || dateStr.trim() === '') return null;
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
      };

      const parseJson = (val: any) => {
        if (!val) return [];
        if (typeof val === 'string') {
          try {
            return JSON.parse(val);
          } catch {
            return [];
          }
        }
        return val;
      };

      const {
        ultimoContacto,
        proximoSeguimiento,
        hallazgosTecnicos,
        solucionesPropuestas,
        ...rest
      } = dto;

      const cliente = await this.prisma.cliente.create({
        data: {
          ...rest,
          ruc: dto.ruc && dto.ruc.trim() !== '' ? dto.ruc : null, // Permitir múltiples nulls
          codigo,
          tipoCliente: tipoCliente as any,
          clasificacion: clasificacion as any,
          esClienteReal,
          ultimoContacto: safeDate(ultimoContacto),
          proximoSeguimiento: safeDate(proximoSeguimiento),
          hallazgosTecnicos: parseJson(hallazgosTecnicos),
          solucionesPropuestas: parseJson(solucionesPropuestas),
          montoEstimado: dto.montoEstimado || 0,
          probabilidad: dto.probabilidad || 0,
          ventaProyectada: dto.ventaProyectada || 0,
          temperatura: dto.temperatura || 'Tibio',
          semaforo: dto.semaforo || 'Verde',
        },
      });

      if (user) {
        await this.auditoriaService.createLog({
          usuarioId: user.id,
          modulo: 'CRM',
          accion: 'CREAR_CLIENTE',
          detalles: { clienteId: cliente.id, empresa: cliente.empresa },
        });
      }

      return cliente;
    } catch (error) {
      console.error('Error creating client:', error);
      if (error.code === 'P2002') {
        throw new ConflictException(
          `Conflicto de datos: El RUC o Código ya existe en el sistema.`,
        );
      }
      throw new BadRequestException(
        'Error al crear el cliente: ' + (error.message || 'Datos inválidos'),
      );
    }
  }

  async updateCliente(id: string, dto: UpdateClienteDto, user?: any) {
    try {
      // 0. Verificar si el cliente ya está en estado GANADO
      const currentCliente = await this.prisma.cliente.findUnique({
        where: { id },
      });
      if (!currentCliente) throw new NotFoundException('Cliente no encontrado');

      if (
        currentCliente.etapaComercial &&
        currentCliente.etapaComercial.toUpperCase() === 'GANADO'
      ) {
        // Si ya está ganado, no permitimos cambiar la etapa ni el tipo
        if (
          dto.etapaComercial &&
          dto.etapaComercial.toUpperCase() !== 'GANADO'
        ) {
          throw new BadRequestException(
            'No se puede cambiar el estado de un cliente que ya ha sido marcado como GANADO.',
          );
        }
      }

      const {
        ultimoContacto,
        proximoSeguimiento,
        hallazgosTecnicos,
        solucionesPropuestas,
        ...rest
      } = dto;

      const data: any = { ...rest };

      const normalizeEnum = (val: string) => {
        if (!val) return undefined;
        return val.toUpperCase().replace(/\s+/g, '_');
      };

      if (dto.tipoCliente) data.tipoCliente = normalizeEnum(dto.tipoCliente);
      if (dto.clasificacion)
        data.clasificacion = normalizeEnum(dto.clasificacion);

      if (
        dto['etapaComercial'] &&
        dto['etapaComercial'].toUpperCase() === 'GANADO'
      ) {
        data.esClienteReal = true;
        data.tipoCliente = 'CLIENTE';
      }

      const safeDate = (dateStr?: string) => {
        if (!dateStr || dateStr.trim() === '') return undefined;
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? undefined : date;
      };

      const parseJson = (val: any) => {
        if (val === undefined) return undefined;
        if (!val) return [];
        if (typeof val === 'string') {
          try {
            return JSON.parse(val);
          } catch {
            return [];
          }
        }
        return val;
      };

      if (ultimoContacto !== undefined)
        data.ultimoContacto = safeDate(ultimoContacto);
      if (proximoSeguimiento !== undefined)
        data.proximoSeguimiento = safeDate(proximoSeguimiento);
      if (hallazgosTecnicos !== undefined)
        data.hallazgosTecnicos = parseJson(hallazgosTecnicos);
      if (solucionesPropuestas !== undefined)
        data.solucionesPropuestas = parseJson(solucionesPropuestas);

      const cliente = await this.prisma.cliente.update({
        where: { id },
        data,
      });

      if (user) {
        await this.auditoriaService.createLog({
          usuarioId: user.id,
          modulo: 'CRM',
          accion: 'ACTUALIZAR_CLIENTE',
          detalles: { clienteId: id, empresa: cliente.empresa, cambios: dto },
        });
      }

      return cliente;
    } catch (error) {
      console.error('Error updating client:', error);
      if (error.code === 'P2002') {
        throw new ConflictException(
          `Conflicto de datos: El RUC o Código ya existe en otro registro.`,
        );
      }
      throw new BadRequestException(
        'Error al actualizar el cliente: ' +
          (error.message || 'ID o datos inválidos'),
      );
    }
  }

  async removeCliente(id: string, user?: any) {
    try {
      const proyectos = await this.prisma.proyecto.findMany({
        where: { clientId: id },
      });
      if (proyectos.length > 0) {
        throw new BadRequestException(
          `No se puede eliminar el cliente porque tiene ${proyectos.length} proyectos registrados en el módulo de Operaciones.`,
        );
      }

      // 1. Recolectar URLs de archivos antes de borrar
      const cliente = await this.prisma.cliente.findUnique({
        where: { id },
        include: {
          documentos: { select: { url: true } },
          fichasTecnicas: {
            include: { adjuntos: { select: { url: true } } },
          },
          cotizaciones: {
            include: { documentos: { select: { url: true } } },
          },
        },
      });

      const urlsToDelete: string[] = [];
      if (cliente) {
        if (cliente.propuestaTecnicaUrl)
          urlsToDelete.push(cliente.propuestaTecnicaUrl);
        cliente.documentos.forEach((d) => urlsToDelete.push(d.url));
        cliente.fichasTecnicas.forEach((f) => {
          f.adjuntos.forEach((a) => urlsToDelete.push(a.url));
        });
        cliente.cotizaciones.forEach((c) => {
          c.documentos.forEach((d) => urlsToDelete.push(d.url));
        });
      }

      const clienteEliminado = await this.prisma.$transaction(async (tx) => {
        const fichas = await tx.fichaTecnica.findMany({
          where: { clienteId: id },
          select: { id: true },
        });
        const fichaIds = fichas.map((f) => f.id);
        if (fichaIds.length > 0) {
          await tx.fichaTecnicaAdjunto.deleteMany({
            where: { fichaTecnicaId: { in: fichaIds } },
          });
          await tx.fichaTecnica.deleteMany({ where: { clienteId: id } });
        }

        const cotizaciones = await tx.cotizacion.findMany({
          where: { clientId: id },
          select: { id: true },
        });
        const quoteIds = cotizaciones.map((q) => q.id);
        if (quoteIds.length > 0) {
          await tx.documento.deleteMany({
            where: { cotizacionId: { in: quoteIds } },
          });
          await tx.interaccion.deleteMany({
            where: { cotizacionId: { in: quoteIds } },
          });
          await tx.cotizacion.deleteMany({ where: { clientId: id } });
        }

        await tx.actividadComercial.deleteMany({ where: { clienteId: id } });
        await tx.interaccion.deleteMany({ where: { clientId: id } });

        return await tx.cliente.delete({
          where: { id },
        });
      });

      // 2. Borrar archivos físicos solo si la transacción fue exitosa
      await deletePhysicalFiles(urlsToDelete);

      if (user) {
        await this.auditoriaService.createLog({
          usuarioId: user.id,
          modulo: 'CRM',
          accion: 'ELIMINAR_CLIENTE',
          detalles: { clienteId: id, empresa: clienteEliminado.empresa },
        });
      }

      return clienteEliminado;
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        error.message || 'Error al eliminar el cliente.',
      );
    }
  }

  async createInteraccion(dto: CreateInteraccionDto) {
    return this.prisma.interaccion.create({
      data: {
        ...dto,
        fecha: dto.fecha ? new Date(dto.fecha) : new Date(),
      },
    });
  }

  async createActividadComercial(dto: any) {
    const actividad = await this.prisma.actividadComercial.create({
      data: {
        clienteId: dto.clienteId,
        usuarioId: dto.usuarioId,
        tipoActividad: dto.tipoActividad,
        descripcion: dto.descripcion,
        fechaActividad: dto.fechaActividad
          ? new Date(dto.fechaActividad)
          : new Date(),
        proximoSeguimiento: dto.proximoSeguimiento
          ? new Date(dto.proximoSeguimiento)
          : null,
        estado: dto.estado || 'PENDIENTE',
      },
    });

    // 1. Notificación para el técnico asignado (si es Visita Técnica)
    // ELIMINADO: Se maneja ahora centralmente en Operaciones para evitar duplicados
    /*
    if (actividad.tipoActividad === 'VISITA_TECNICA' && dto.tecnicoId) {
      ...
    }
    */

    // 2. Recordatorio de próximo seguimiento (para cualquier tipo de actividad)
    if (actividad.proximoSeguimiento) {
      await this.notificacionesService.create({
        usuarioId: actividad.usuarioId,
        titulo: `Recordatorio: ${actividad.tipoActividad}`,
        mensaje: `Tienes un seguimiento programado para el cliente ${dto.clienteNombre || 'Empresa'}.`,
        tipo: 'SEGUIMIENTO',
        fechaProgramada: actividad.proximoSeguimiento,
        actividadComercialId: actividad.id,
      });
    }

    // 3. Notificación general para otros tipos (Problema 5)
    // Si es una reunión o cotización importante, podríamos notificar al admin
    if (
      ['REUNION', 'COTIZACION', 'VISITA_TECNICA'].includes(
        actividad.tipoActividad,
      )
    ) {
      // Notificación global o para admins (opcional, dependiendo de la política)
      // Por ahora aseguramos que al menos el usuario asignado tenga su recordatorio arriba.
    }

    return actividad;
  }

  async findAllActividades(
    page: number = 1,
    limit: number = 20,
    filters: any = {},
    user?: any,
  ) {
    const skip = (page - 1) * limit;
    const where: any = { ...filters };

    if (user && user.rol !== 'ADMIN') {
      where.usuarioId = user.id;
    }

    const [data, total] = await Promise.all([
      this.prisma.actividadComercial.findMany({
        where,
        include: { cliente: true },
        orderBy: { fechaActividad: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.actividadComercial.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async updateActividad(id: string, dto: any) {
    return this.prisma.actividadComercial.update({
      where: { id },
      data: {
        ...dto,
        fechaActividad: dto.fechaActividad
          ? new Date(dto.fechaActividad)
          : undefined,
        proximoSeguimiento: dto.proximoSeguimiento
          ? new Date(dto.proximoSeguimiento)
          : undefined,
      },
    });
  }

  async findDistinctZones() {
    try {
      const zones = await this.prisma.cliente.findMany({
        where: { deletedAt: null },
        select: { zona: true },
        distinct: ['zona'],
      });
      return zones
        .map((z) => z.zona)
        .filter(Boolean)
        .sort();
    } catch (error) {
      console.error('[CRM] Error al obtener zonas:', error);
      throw error;
    }
  }

  private async generateClienteCode(): Promise<string> {
    const count = await this.prisma.cliente.count();
    let nextNumber = count + 1;
    let code = `HHT-CRM-${nextNumber.toString().padStart(3, '0')}`;

    // Verificar colisiones y aumentar el número hasta que sea único (BUG-002)
    let exists = await this.prisma.cliente.findUnique({
      where: { codigo: code },
    });

    while (exists) {
      nextNumber++;
      code = `HHT-CRM-${nextNumber.toString().padStart(3, '0')}`;
      exists = await this.prisma.cliente.findUnique({
        where: { codigo: code },
      });
    }

    return code;
  }

  async createDocumento(dto: any) {
    const { clientId, cotizacionId, ...data } = dto;

    // Normalización para Prisma Enums
    const tipo =
      data.tipo &&
      ['Tecnica', 'Administrativa', 'Legal', 'Financiero'].includes(data.tipo)
        ? data.tipo
        : 'Otro';

    const estado =
      data.estado &&
      ['Borrador', 'PendienteRevision', 'Aprobado', 'Obsoleto'].includes(
        data.estado,
      )
        ? data.estado
        : 'Aprobado';

    const connectData: any = {};
    if (clientId) connectData.cliente = { connect: { id: clientId } };
    if (cotizacionId) connectData.cotizacion = { connect: { id: cotizacionId } };

    return this.prisma.documento.create({
      data: {
        ...data,
        tipo: tipo,
        estado: estado,
        ...connectData,
      },
    });
  }

  async removeDocumento(id: string) {
    const doc = await this.prisma.documento.findUnique({
      where: { id },
      select: { url: true },
    });

    const result = await this.prisma.documento.delete({
      where: { id },
    });

    if (doc?.url) {
      await deletePhysicalFiles([doc.url]);
    }

    return result;
  }
}
