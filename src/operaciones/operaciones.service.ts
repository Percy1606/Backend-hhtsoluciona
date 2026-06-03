import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Import PrismaService
import { PrismaClient, Proyecto as PrismaProyecto, Responsable as PrismaResponsable, Semaforo, EstadoProyecto, Actividad, EstadoActividad } from '@prisma/client'; // Import Prisma types
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { CreateActividadDto } from './dto/create-actividad.dto';
import { UpdateActividadDto } from './dto/update-actividad.dto';
import { CreateComentarioDto } from './dto/create-comentario.dto';
import { CreateEvidenciaDto } from './dto/create-evidencia.dto';
import { CreateReporteDiarioDto } from './dto/create-reporte.dto';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OperacionesService {
  constructor(private prisma: PrismaService) {} // Inject PrismaService

  // ... (previous methods)

  // ============================================
  // COMENTARIOS Y EVIDENCIAS
  // ============================================

  async createComentario(dto: CreateComentarioDto) {
    return this.prisma.comentario.create({ data: dto });
  }

  async createEvidencia(dto: CreateEvidenciaDto) {
    return this.prisma.evidencia.create({ data: dto });
  }

  // ============================================
  // REPORTES DIARIOS
  // ============================================

  async createReporteDiario(dto: CreateReporteDiarioDto) {
    return this.prisma.reporteDiario.create({
      data: {
        ...dto,
        fecha: new Date(dto.fecha),
      },
    });
  }

  // ============================================
  // DOCUMENTOS
  // ============================================

  async createDocumento(dto: CreateDocumentoDto) {
    const { fechaVencimiento, ...data } = dto;
    return this.prisma.documento.create({
      data: {
        ...data,
        fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
      } as any, // Bypass for complex XOR types if mapping is still ambiguous
    });
  }

  async updateDocumento(id: string, dto: any) {
    return this.prisma.documento.update({
      where: { id },
      data: {
        ...dto,
        fechaVencimiento: dto.fechaVencimiento ? new Date(dto.fechaVencimiento) : undefined,
      },
    });
  }

  async removeDocumento(id: string) {
    return this.prisma.documento.delete({ where: { id } });
  }

  // ============================================
  // SUBOPERACIONES Y ENTREGABLES
  // ============================================

  async createSuboperacion(data: any) {
    return this.prisma.suboperacion.create({
      data: {
        ...data,
        responsablesApoyo: JSON.stringify(data.responsablesApoyo || []),
        fechaInicio: new Date(data.fechaInicio),
        fechaFinEstimada: new Date(data.fechaFinEstimada),
      },
    });
  }

  async createEntregable(data: any) {
    return this.prisma.entregable.create({ data });
  }

  // ============================================
  // ALCANCE TÉCNICO
  // ============================================

  async createEvaluacionTecnica(proyectoId: string, dto: any) {
    return this.prisma.evaluacionTecnica.create({
      data: {
        ...dto,
        proyectoId,
        fechaEvaluacion: new Date(dto.fechaEvaluacion),
        hallazgos: JSON.stringify(dto.hallazgos || []),
        solucionesPropuestas: JSON.stringify(dto.solucionesPropuestas || []),
      },
    });
  }

  async createIngenieriaDiseno(proyectoId: string, dto: any) {
    return this.prisma.ingenieriaDiseno.create({
      data: {
        ...dto,
        proyectoId,
        fechaInicio: new Date(dto.fechaInicio),
        fechaFinEstimada: dto.fechaFinEstimada ? new Date(dto.fechaFinEstimada) : null,
        especificaciones: JSON.stringify(dto.especificaciones || []),
      },
    });
  }

  async createExpedienteTecnico(proyectoId: string, dto: any) {
    return this.prisma.expedienteTecnico.create({
      data: {
        ...dto,
        proyectoId,
      },
    });
  }

  // ... (rest of the class)

  async findAllProyectos(): Promise<PrismaProyecto[]> {
    return this.prisma.proyecto.findMany({
      include: {
        responsablePrincipal: true,
        cotizacionOrigen: {
          select: {
            estado: true
          }
        },
        actividades: {
          include: {
            responsablePrincipal: true,
            subtareas: true,
            validacionesRequeridas: true,
            comentarios: true,
            evidencias: true,
          },
        },
        comentarios: true,
        evidencias: true,
        documentos: true,
        suboperaciones: {
          include: {
            responsablePrincipal: true,
            entregables: true,
          },
        },
        evaluacionTecnica: true,
        ingenieriaDiseno: {
          include: {
            planos: true,
          },
        },
        expedienteTecnico: {
          include: {
            contenido: true,
          },
        },
        reportesDiarios: {
          include: {
            evidencias: true,
          },
        },
        indicadoresAvance: true,
        historialCambios: true,
      },
      orderBy: { fechaCreacion: 'desc' },
    });
  }

  async findOneProyecto(id: string): Promise<PrismaProyecto> {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id },
      include: {
        responsablePrincipal: true,
        cotizacionOrigen: {
          select: {
            estado: true
          }
        },
        actividades: {
          include: {
            responsablePrincipal: true,
            subtareas: true,
            validacionesRequeridas: true,
            comentarios: true,
            evidencias: true,
          },
        },
        comentarios: true,
        evidencias: true,
        documentos: true,
        suboperaciones: {
          include: {
            responsablePrincipal: true,
            entregables: true,
          },
        },
        evaluacionTecnica: true,
        ingenieriaDiseno: {
          include: {
            planos: true,
          },
        },
        expedienteTecnico: {
          include: {
            contenido: true,
          },
        },
        reportesDiarios: {
          include: {
            evidencias: true,
          },
        },
        indicadoresAvance: true,
        historialCambios: true,
      },
    });
    if (!proyecto) {
      throw new NotFoundException(`Proyecto con ID "${id}" no encontrado.`);
    }
    return proyecto;
  }

  async createProyecto(createProyectoDto: CreateProyectoDto): Promise<PrismaProyecto> {
    const { cotizacionId, ...dto } = createProyectoDto;

    // VALIDACIÓN: Verificar si existe la cotización y si está aprobada
    const cotizacion = await this.prisma.cotizacion.findUnique({
      where: { id: cotizacionId },
    });

    if (!cotizacion) {
      throw new BadRequestException('La cotización asociada no existe.');
    }

    // Aceptamos tanto 'Aprobada' (DB comment) como 'Aprobado' (Frontend/CRM store)
    const approvedStatuses = ['Aprobada', 'Aprobado'];
    if (!approvedStatuses.includes(cotizacion.estado)) {
      throw new BadRequestException({
        error: 'Proyecto no autorizado',
        message: 'No es posible registrar este proyecto porque la cotización asociada aún no ha sido aprobada por el cliente.\n\nPor favor, contacte al área comercial para validar el estado de la negociación o gestionar la aprobación correspondiente antes de continuar.\n\nUna vez que la cotización se encuentre en estado APROBADA, podrá registrar el proyecto.'
      });
    }

    const newProyectoId = uuidv4();
    const projectCode = await this.generateProjectCode();
    const initialSemaforo = this.calculateSemaforo({
      ...dto,
      fechaInicio: new Date(dto.fechaInicio),
      fechaFinEstimada: new Date(dto.fechaFinEstimada),
    });

    const responsablesAdicionalesJson = JSON.stringify(dto.responsablesAdicionales || []);

    const proyecto = await this.prisma.proyecto.create({
      data: {
        id: newProyectoId,
        codigo: projectCode,
        semaforo: initialSemaforo,
        avance: 0,
        avanceCalculado: 0,
        creadoPor: 'Admin',
        fechaCreacion: new Date().toISOString(),
        ...dto,
        fechaInicio: new Date(dto.fechaInicio),
        fechaFinEstimada: new Date(dto.fechaFinEstimada),
        responsablesAdicionales: responsablesAdicionalesJson,
        cotizacionOrigen: { connect: { id: cotizacionId } }
      },
    });

    await this.registrarHistorial(proyecto.id, null, 'PROYECTO_CREADO', '', 'Proyecto creado');
    return proyecto;
  }

  async updateProyecto(id: string, updateProyectoDto: UpdateProyectoDto): Promise<PrismaProyecto> {
    const proyectoToUpdate = await this.findOneProyecto(id);

    let updatedSemaforo: Semaforo = proyectoToUpdate.semaforo;
    if (updateProyectoDto.fechaFinEstimada || updateProyectoDto.estado || updateProyectoDto.fechaInicio) {
      updatedSemaforo = this.calculateSemaforo({
        ...proyectoToUpdate,
        fechaInicio: updateProyectoDto.fechaInicio ? new Date(updateProyectoDto.fechaInicio) : proyectoToUpdate.fechaInicio,
        fechaFinEstimada: updateProyectoDto.fechaFinEstimada ? new Date(updateProyectoDto.fechaFinEstimada) : proyectoToUpdate.fechaFinEstimada,
        estado: updateProyectoDto.estado || proyectoToUpdate.estado,
      });
    }

    const responsablesAdicionalesJson = updateProyectoDto.responsablesAdicionales
      ? JSON.stringify(updateProyectoDto.responsablesAdicionales)
      : undefined;

    const updated = await this.prisma.proyecto.update({
      where: { id },
      data: {
        ...updateProyectoDto,
        fechaInicio: updateProyectoDto.fechaInicio ? new Date(updateProyectoDto.fechaInicio) : undefined,
        fechaFinEstimada: updateProyectoDto.fechaFinEstimada ? new Date(updateProyectoDto.fechaFinEstimada) : undefined,
        fechaFinReal: updateProyectoDto.fechaFinReal ? new Date(updateProyectoDto.fechaFinReal) : undefined,
        semaforo: updatedSemaforo,
        responsablesAdicionales: responsablesAdicionalesJson,
        fechaActualizacion: new Date().toISOString(),
      },
    });

    if (updateProyectoDto.estado && updateProyectoDto.estado !== proyectoToUpdate.estado) {
      await this.registrarHistorial(id, null, 'ESTADO_PROYECTO', proyectoToUpdate.estado, updateProyectoDto.estado);
    }

    return updated;
  }

  async removeProyecto(id: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Obtener IDs de entidades relacionadas para borrado manual en cascada
        const actividades = await tx.actividad.findMany({ where: { proyectoId: id }, select: { id: true } });
        const actividadIds = actividades.map(a => a.id);

        const suboperaciones = await tx.suboperacion.findMany({ where: { proyectoId: id }, select: { id: true } });
        const subopIds = suboperaciones.map(s => s.id);

        const ingenierias = await tx.ingenieriaDiseno.findMany({ where: { proyectoId: id }, select: { id: true } });
        const ingIds = ingenierias.map(i => i.id);

        // 2. Borrar dependencias de Nivel 3 (hijos de actividades, subops e ingenierias)
        if (actividadIds.length > 0) {
           await tx.subtarea.deleteMany({ where: { actividadId: { in: actividadIds } } });
           await tx.validacionRequerida.deleteMany({ where: { actividadId: { in: actividadIds } } });
           // Evidencia, Comentario y HistorialCambio tienen onDelete: Cascade en la DB, pero si no funcionan, los borramos igual
           await tx.evidencia.deleteMany({ where: { actividadId: { in: actividadIds } } });
           await tx.comentario.deleteMany({ where: { actividadId: { in: actividadIds } } });
           await tx.historialCambio.deleteMany({ where: { actividadId: { in: actividadIds } } });
        }

        if (subopIds.length > 0) {
           await tx.entregable.deleteMany({ where: { suboperacionId: { in: subopIds } } });
        }

        if (ingIds.length > 0) {
           await tx.planoDiseno.deleteMany({ where: { ingenieriaDisenoId: { in: ingIds } } });
        }

        // 3. Borrar dependencias de Nivel 2 (relacionadas directamente al proyecto)
        await tx.actividad.deleteMany({ where: { proyectoId: id } });
        await tx.suboperacion.deleteMany({ where: { proyectoId: id } });
        await tx.ingenieriaDiseno.deleteMany({ where: { proyectoId: id } });
        
        await tx.reporteDiario.deleteMany({ where: { proyectoId: id } });
        await tx.comentario.deleteMany({ where: { proyectoId: id } });
        await tx.evidencia.deleteMany({ where: { proyectoId: id } });
        await tx.documento.deleteMany({ where: { proyectoId: id } });
        await tx.evaluacionTecnica.deleteMany({ where: { proyectoId: id } });
        await tx.expedienteTecnico.deleteMany({ where: { proyectoId: id } });
        await tx.historialCambio.deleteMany({ where: { proyectoId: id } });
        await tx.indicadorAvance.deleteMany({ where: { proyectoId: id } });

        // 4. Finalmente borrar el proyecto
        await tx.proyecto.delete({ where: { id } });
      });
    } catch (error: any) {
      console.error("[Operaciones] Error al eliminar proyecto:", error);
      if (error.code === 'P2025') {
        throw new NotFoundException(`Proyecto con ID "${id}" no encontrado.`);
      }
      throw error;
    }
  }

  // ============================================
  // ACTIVIDADES
  // ============================================

  async createActividad(dto: CreateActividadDto): Promise<any> {
    const { userRole, ...prismaData } = dto;
    const actividad = await this.prisma.actividad.create({
      data: {
        ...prismaData,
        fechaCreacion: new Date(dto.fechaCreacion),
        fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : null,
        fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
        fechaVencimiento: dto.fechaVencimiento ? new Date(dto.fechaVencimiento) : null,
        responsablesApoyo: JSON.stringify(dto.responsablesApoyo || []),
      },
    });

    await this.registrarHistorial(dto.proyectoId, actividad.id, 'ACTIVIDAD_CREADA', '', actividad.descripcion);
    await this.updateProjectProgress(dto.proyectoId);
    return actividad;
  }

  async updateActividad(id: string, dto: UpdateActividadDto, userRole?: string): Promise<any> {
    const oldActividad = await this.prisma.actividad.findUnique({ where: { id } });
    if (!oldActividad) throw new NotFoundException(`Actividad con ID "${id}" no encontrada.`);

    // Restricciones de estado 'Validada'
    if (dto.estado === 'Validada' && userRole !== 'ADMIN') {
      throw new Error('Solo el administrador puede validar actividades.');
    }

    // Si la actividad ya está validada, solo el admin puede tocarla
    if (oldActividad.estado === 'Validada' && userRole !== 'ADMIN') {
      throw new Error('Esta actividad ya ha sido validada y está bloqueada. Contacte al administrador.');
    }

    // Calcular progreso automático basado en el estado si se cambia el estado
    let nuevoProgreso = dto.progreso;
    if (dto.estado && dto.estado !== oldActividad.estado) {
      if (dto.estado === 'Pendiente') nuevoProgreso = 0;
      else if (dto.estado === 'EnProgreso') nuevoProgreso = 50;
      else if (dto.estado === 'Completada' || dto.estado === 'Validada') nuevoProgreso = 100;
    }

    const { userRole: _, ...prismaData } = dto;

    const updated = await this.prisma.actividad.update({
      where: { id },
      data: {
        ...prismaData,
        progreso: nuevoProgreso !== undefined ? nuevoProgreso : oldActividad.progreso,
        fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : undefined,
        fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : undefined,
        fechaVencimiento: dto.fechaVencimiento ? new Date(dto.fechaVencimiento) : undefined,
        responsablesApoyo: dto.responsablesApoyo ? JSON.stringify(dto.responsablesApoyo) : undefined,
      },
    });

    if (dto.estado && dto.estado !== oldActividad.estado) {
      await this.registrarHistorial(oldActividad.proyectoId, id, 'ESTADO_ACTIVIDAD', oldActividad.estado, dto.estado);
      await this.updateProjectProgress(oldActividad.proyectoId);
    }

    return updated;
  }

  async removeActividad(id: string): Promise<void> {
    const actividad = await this.prisma.actividad.findUnique({ where: { id } });
    if (actividad) {
      await this.prisma.actividad.delete({ where: { id } });
      await this.updateProjectProgress(actividad.proyectoId);
    }
  }

  // ============================================
  // SUBTAREAS
  // ============================================

  async createSubtarea(data: any): Promise<any> {
    const subtarea = await this.prisma.subtarea.create({ data });
    const actividad = await this.prisma.actividad.findUnique({ where: { id: data.actividadId } });
    if (actividad) {
      await this.recalculateActivityProgress(actividad.id);
    }
    return subtarea;
  }

  async updateSubtarea(id: string, data: any): Promise<any> {
    const subtarea = await this.prisma.subtarea.update({ where: { id }, data });
    await this.recalculateActivityProgress(subtarea.actividadId);
    return subtarea;
  }

  // ============================================
  // VALIDACIONES
  // ============================================

  async updateValidacion(id: string, data: any): Promise<any> {
    const validacion = await this.prisma.validacionRequerida.update({
      where: { id },
      data: {
        ...data,
        fechaValidacion: data.fechaValidacion ? new Date(data.fechaValidacion) : undefined,
      },
    });

    // If approved, check if all validations are approved to update activity state
    if (data.estado === 'Aprobada' || data.estado === 'Rechazada') {
      const activity = await this.prisma.actividad.findUnique({
        where: { id: validacion.actividadId }
      });
      if (activity) {
        await this.registrarHistorial(
          activity.proyectoId, 
          activity.id, 
          data.estado === 'Aprobada' ? 'VALIDACION_APROBADA' : 'VALIDACION_RECHAZADA', 
          validacion.tipo, 
          data.observaciones || 'Sin observaciones'
        );
      }

      if (data.estado === 'Aprobada') {
        const activityWithValidations = await this.prisma.actividad.findUnique({
          where: { id: validacion.actividadId },
          include: { validacionesRequeridas: true }
        });
        if (activityWithValidations && activityWithValidations.validacionesRequeridas.every(v => v.estado === 'Aprobada')) {
          await this.prisma.actividad.update({
            where: { id: activityWithValidations.id },
            data: { estado: 'Validada' }
          });
          await this.registrarHistorial(activityWithValidations.proyectoId, activityWithValidations.id, 'ESTADO_ACTIVIDAD', activityWithValidations.estado, 'Validada');
          await this.updateProjectProgress(activityWithValidations.proyectoId);
        }
      }
    }

    return validacion;
  }

  // ============================================
  // UTILS
  // ============================================

  private async registrarHistorial(proyectoId: string, actividadId: string | null, campo: string, valorAnterior: string, valorNuevo: string) {
    await this.prisma.historialCambio.create({
      data: {
        proyectoId,
        actividadId,
        campo,
        valorAnterior: String(valorAnterior),
        valorNuevo: String(valorNuevo),
        usuario: 'Sistema',
        area: 'OperacionesDeCampo',
        fecha: new Date(), // Esto ya guarda la hora real (UTC) en la DB
      }
    });
  }

  private async recalculateActivityProgress(actividadId: string) {
    const subtareas = await this.prisma.subtarea.findMany({ where: { actividadId } });
    if (subtareas.length === 0) return;

    const completadas = subtareas.filter(s => s.completada).length;
    const progreso = Math.round((completadas / subtareas.length) * 100);
    
    let estado: EstadoActividad = EstadoActividad.Pendiente;
    if (progreso === 100) estado = EstadoActividad.Completada;
    else if (progreso > 0) estado = EstadoActividad.EnProgreso;

    const actividad = await this.prisma.actividad.update({
      where: { id: actividadId },
      data: { progreso, estado }
    });

    await this.updateProjectProgress(actividad.proyectoId);
  }

  private async updateProjectProgress(proyectoId: string) {
    const actividades = await this.prisma.actividad.findMany({ where: { proyectoId } });
    if (actividades.length === 0) return;

    const totalPeso = actividades.reduce((acc, a) => acc + (a.ponderacion || 1), 0);
    const pesosCompletados = actividades
      .filter(a => a.estado === 'Completada' || a.estado === 'Validada')
      .reduce((acc, a) => acc + (a.ponderacion || 1), 0);
    
    const avance = totalPeso > 0 ? Math.round((pesosCompletados / totalPeso) * 100) : 0;

    await this.prisma.proyecto.update({
      where: { id: proyectoId },
      data: { avance, avanceCalculado: avance }
    });
  }

  async createResponsable(data: any): Promise<PrismaResponsable> {
    return this.prisma.responsable.create({ data });
  }

  async updateResponsable(id: string, data: any): Promise<PrismaResponsable> {
    return this.prisma.responsable.update({ where: { id }, data });
  }

  async findAllResponsables(): Promise<PrismaResponsable[]> {
    return this.prisma.responsable.findMany();
  }

  async findOneResponsable(id: string): Promise<PrismaResponsable> {
    const responsable = await this.prisma.responsable.findUnique({ where: { id } });
    if (!responsable) {
      throw new NotFoundException(`Responsable con ID "${id}" no encontrado.`);
    }
    return responsable;
  }

  private async generateProjectCode(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.proyecto.count(); // Get count from DB
    return `HHT-OPE-${year.toString().slice(-2)}-${(count + 1).toString().padStart(3, '0')}`;
  }

  private calculateSemaforo(proyecto: Partial<PrismaProyecto | CreateProyectoDto>): Semaforo {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (proyecto.estado === EstadoProyecto.Finalizado) return Semaforo.Verde;
    if (proyecto.estado === EstadoProyecto.Detenido) return Semaforo.Rojo;

    const fechaFin = proyecto.fechaFinEstimada ? new Date(proyecto.fechaFinEstimada as string | Date) : null;
    if (!fechaFin) return Semaforo.Amarillo;

    const diasRestantes = Math.ceil((fechaFin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

    if (diasRestantes < 3) return Semaforo.Rojo;
    if (diasRestantes <= 7) return Semaforo.Amarillo;
    return Semaforo.Verde;
  }
}

