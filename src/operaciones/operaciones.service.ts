import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service'; // Import PrismaService
import {
  PrismaClient,
  Proyecto as PrismaProyecto,
  Responsable as PrismaResponsable,
  Semaforo,
  EstadoProyecto,
  Actividad,
  EstadoActividad,
} from '@prisma/client'; // Import Prisma types
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { CreateActividadDto } from './dto/create-actividad.dto';
import { UpdateActividadDto } from './dto/update-actividad.dto';
import { CreateComentarioDto } from './dto/create-comentario.dto';
import { CreateEvidenciaDto } from './dto/create-evidencia.dto';
import { CreateReporteDiarioDto } from './dto/create-reporte.dto';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { v4 as uuidv4 } from 'uuid';
import { deletePhysicalFiles } from '../common/utils/file-utils';

@Injectable()
export class OperacionesService {
  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
    private auditoriaService: AuditoriaService,
  ) {}

  async createComentario(dto: CreateComentarioDto) {
    return this.prisma.comentario.create({ data: dto });
  }

  async createEvidencia(dto: CreateEvidenciaDto) {
    return this.prisma.evidencia.create({ data: dto });
  }

  async createReporteDiario(dto: CreateReporteDiarioDto) {
    return this.prisma.reporteDiario.create({
      data: {
        ...dto,
        fecha: new Date(dto.fecha),
      },
    });
  }

  async createDocumento(dto: any) {
    console.log('[Service] createDocumento - DTO Inicial:', dto);
    const { fechaVencimiento, fechaSubida, area, validaciones, proyectoId, ...data } = dto;
    
    const dataToPrisma: any = {
      ...data,
      fechaSubida: fechaSubida ? new Date(fechaSubida) : new Date(),
      fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
    };
    
    if (proyectoId) {
      dataToPrisma.proyecto = { connect: { id: proyectoId } };
    }
    if (area) {
      dataToPrisma.area = area;
    }
    
    console.log('[Service] createDocumento - Datos enviados a Prisma:', dataToPrisma);

    try {
      return await this.prisma.documento.create({
        data: dataToPrisma,
      });
    } catch (error) {
      console.error('[Service] createDocumento - Error Prisma:', error);
      throw error;
    }
  }

  async updateDocumento(id: string, dto: any) {
    const { proyectoId, area, ...data } = dto;
    const dataToPrisma: any = {
      ...data,
      fechaVencimiento: dto.fechaVencimiento
        ? new Date(dto.fechaVencimiento)
        : undefined,
    };
    if (proyectoId) {
      dataToPrisma.proyecto = { connect: { id: proyectoId } };
    }
    if (area) {
      dataToPrisma.area = area;
    }
    return this.prisma.documento.update({
      where: { id },
      data: dataToPrisma,
    });
  }

  async removeDocumento(id: string) {
    const doc = await this.prisma.documento.findUnique({
      where: { id },
      select: { url: true },
    });

    const result = await this.prisma.documento.delete({ where: { id } });

    if (doc?.url) {
      await deletePhysicalFiles([doc.url]);
    }

    return result;
  }

  async findAllDocumentos(filters: { area?: string; proyectoId?: string }) {
    return this.prisma.documento.findMany({
      where: {
        area: (filters.area as any) || undefined,
        proyectoId: filters.proyectoId || undefined,
      } as any,
      include: {
        proyecto: true,
      },
      orderBy: {
        fechaSubida: 'desc',
      },
    });
  }

  async createSuboperacion(data: any) {
    return this.prisma.suboperacion.create({
      data: {
        ...data,
        responsablesApoyo: data.responsablesApoyo || [],
        fechaInicio: new Date(data.fechaInicio),
        fechaFinEstimada: new Date(data.fechaFinEstimada),
      },
    });
  }

  async createEntregable(data: any) {
    return this.prisma.entregable.create({ data });
  }

  async createEvaluacionTecnica(proyectoId: string, dto: any) {
    return this.prisma.evaluacionTecnica.create({
      data: {
        ...dto,
        proyectoId,
        fechaEvaluacion: new Date(dto.fechaEvaluacion),
        hallazgos: dto.hallazgos || [],
        solucionesPropuestas: dto.solucionesPropuestas || [],
      },
    });
  }

  async createIngenieriaDiseno(proyectoId: string, dto: any) {
    return this.prisma.ingenieriaDiseno.create({
      data: {
        ...dto,
        proyectoId,
        fechaInicio: new Date(dto.fechaInicio),
        fechaFinEstimada: dto.fechaFinEstimada
          ? new Date(dto.fechaFinEstimada)
          : null,
        especificaciones: dto.especificaciones || [],
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

  async findAllProyectos(
    page: number = 1,
    limit: number = 20,
    filters: any = {},
    user?: any,
  ): Promise<any> {
    const skip = (page - 1) * limit;
    const where: any = {};
    const andConditions: any[] = [];

    // 1. Filtro de búsqueda por texto (Nombre o Código)
    if (filters.search) {
      andConditions.push({
        OR: [
          { nombre: { contains: filters.search } },
          { codigo: { contains: filters.search } },
        ],
      });
    }

    // 2. Filtros de estado y área
    if (filters.estado) where.estado = filters.estado;
    if (filters.area) where.area = filters.area;

    // 3. Si se solicita un responsable específico desde el filtro de UI (Filtro explícito)
    if (filters.responsablePrincipalId) {
      where.responsablePrincipalId = filters.responsablePrincipalId;
    }

    // 4. FILTRO DE SEGURIDAD POR ROL (REMOVIDO POR SOLICITUD)
    // Ahora todos los usuarios pueden ver todos los proyectos
    /*
    if (user && user.rol !== 'ADMIN' && user.rol !== 'SUPERVISOR') {
      const responsableId = user.responsable?.id;
      if (responsableId) {
        andConditions.push({
          OR: [
            { responsablePrincipalId: responsableId },
            { responsablesAdicionales: { array_contains: responsableId } },
          ],
        });
      } else {
        where.responsablePrincipalId = 'NONE';
      }
    }
    */

    // Combinar todas las condiciones AND si existen
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [data, total] = await Promise.all([
      this.prisma.proyecto.findMany({
        where,
        include: {
          cliente: true,
          responsablePrincipal: true,
          ordenesDeServicio: true,
          cotizacionOrigen: { select: { estado: true, monto: true } },
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
          ingenieriaDiseno: { include: { planos: true } },
          expedienteTecnico: { include: { contenido: true } },
          reportesDiarios: { include: { evidencias: true } },
          indicadoresAvance: true,
          historialCambios: true,
        },
        orderBy: { fechaCreacion: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.proyecto.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  @OnEvent('proyecto.costChanged')
  async handleProjectCostChanged(payload: { proyectoId: string }) {
    await this.checkProjectOvercost(payload.proyectoId);
  }

  async checkProjectOvercost(proyectoId: string) {
    const costs = await this.getProjectCosts(proyectoId);
    if (!costs) return;

    const { presupuesto, costoTotalReal, porcentajeConsumo, nombre } = costs;

    // ALERTA: Si el consumo supera el 60% del presupuesto
    if (presupuesto > 0 && porcentajeConsumo >= 60) {
      console.log(
        `[Operaciones] ALERTA SOBRECOSTO: Proyecto ${nombre} al ${porcentajeConsumo}%`,
      );

      // 1. Buscar usuarios de finanzas y admins
      const allUsers = await this.prisma.usuario.findMany({
        where: {
          OR: [{ rol: 'ADMIN' }, { rol: 'SUPERVISOR' }],
        },
      });

      // También buscamos usuarios que tengan el módulo 'finanzas'
      const financeUsers = await this.prisma.usuario.findMany({
        where: {
          NOT: [{ rol: 'ADMIN' }, { rol: 'SUPERVISOR' }],
        },
      });

      const targetUsers = [
        ...allUsers,
        ...financeUsers.filter((u) => {
          const mods = u.modulos as any[];
          return Array.isArray(mods) && mods.includes('finanzas');
        }),
      ];

      // 2. Notificar a cada uno
      for (const u of targetUsers) {
        await this.notificacionesService.create({
          usuarioId: u.id,
          titulo: '⚠️ Alerta de Sobrecosto',
          mensaje: `El proyecto "${nombre}" ha superado el 60% de su presupuesto (${porcentajeConsumo}%). Costo Actual: S/ ${costoTotalReal.toLocaleString()}. Presupuesto: S/ ${presupuesto.toLocaleString()}.`,
          tipo: 'ALERTA',
        });
      }
    }
  }

  async findOneProyecto(id: string): Promise<PrismaProyecto> {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id },
      include: {
        responsablePrincipal: true,
        cotizacionOrigen: { select: { estado: true } },
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
        ingenieriaDiseno: { include: { planos: true } },
        expedienteTecnico: { include: { contenido: true } },
        reportesDiarios: { include: { evidencias: true } },
        indicadoresAvance: true,
        historialCambios: true,
      },
    });
    if (!proyecto)
      throw new NotFoundException(`Proyecto con ID "${id}" no encontrado.`);
    return proyecto;
  }

  async getProjectCosts(id: string) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id },
      include: {
        cotizacionOrigen: { select: { monto: true } },
      },
    });
    if (!proyecto)
      throw new NotFoundException(`Proyecto con ID "${id}" no encontrado.`);

    // 1. Costos de Logística (Despachos de materiales a la obra)
    const movimientos = await this.prisma.movimientoAlmacen.findMany({
      where: { proyectoId: id, tipo: 'SALIDA' },
      include: {
        insumo: { select: { precioReferencial: true, nombre: true } },
      },
    });

    const costoMateriales = movimientos.reduce((sum, mov) => {
      const precio = Number(
        mov.costoUnitarioHistorico || mov.insumo?.precioReferencial || 0,
      );
      const cantidad = Number(mov.cantidad || 0);
      return sum + cantidad * precio;
    }, 0);

    // 2. Costos de Finanzas (Gastos directos asignados a la obra)
    const gastos = await this.prisma.gasto.findMany({
      where: {
        proyectoId: id,
        estado: { in: ['PENDIENTE', 'PAGADO', 'SOLICITADO', 'APROBADO'] as any },
      },
    });

    const costoManoObra = gastos
      .filter((g) => g.tipo === 'PERSONAL' || g.tipo === 'PLANILLA' || g.categoriaDistribucion === 'MANO_OBRA')
      .reduce((sum, g) => sum + Number(g.montoTotal || 0), 0);

    const costoMaterialesLogistica = gastos
      .filter((g) => g.categoriaDistribucion === 'MATERIALES')
      .reduce((sum, g) => sum + Number(g.montoTotal || 0), 0);
      
    const costoMaterialesTotal = costoMateriales + costoMaterialesLogistica;

    const costoServiciosYVarios = gastos
      .filter((g) => g.tipo !== 'PERSONAL' && g.tipo !== 'PLANILLA' && g.categoriaDistribucion !== 'MANO_OBRA' && g.categoriaDistribucion !== 'MATERIALES')
      .reduce((sum, g) => sum + Number(g.montoTotal || 0), 0);

    const costoTotalReal =
      costoMaterialesTotal + costoManoObra + costoServiciosYVarios;
    const presupuesto = Number(proyecto.costoPresupuestado || 0);
    const venta = Number(proyecto.cotizacionOrigen?.monto || 0);

    const utilidadReal = venta - costoTotalReal;
    const margenReal = venta > 0 ? (utilidadReal / venta) * 100 : 0;

    // ACTUALIZAR REGISTRO EN BD PARA PERSISTENCIA
    await this.prisma.proyecto.update({
      where: { id },
      data: {
        costoTotalReal: costoTotalReal,
        consumoMaterialesReal: costoMaterialesTotal,
        consumoManoObraReal: costoManoObra,
        consumoServiciosReal: costoServiciosYVarios,
        utilidadProyectada: utilidadReal,
      },
    });

    return {
      proyectoId: id,
      nombre: proyecto.nombre,
      venta,
      presupuesto,
      costoTotalReal,
      utilidadReal,
      margenReal: Math.round(margenReal * 100) / 100,
      porcentajeConsumo:
        presupuesto > 0
          ? Math.round((costoTotalReal / presupuesto) * 10000) / 100
          : 0,
      desglose: {
        materiales: costoMateriales,
        manoObra: costoManoObra,
        serviciosYVarios: costoServiciosYVarios,
      },
      historialMateriales: movimientos.map((m) => {
        const p = Number(
          m.costoUnitarioHistorico || m.insumo?.precioReferencial || 0,
        );
        const c = Number(m.cantidad || 0);
        return {
          fecha: m.fecha,
          material: m.insumo?.nombre || 'Insumo Eliminado',
          cantidad: c,
          costoCalculado: c * p,
        };
      }),
      historialGastos: gastos.map((g) => ({
        fecha: g.fechaEmision,
        concepto: g.concepto,
        monto: Number(g.montoTotal || 0),
        tipo: g.tipo,
      })),
    };
  }

  async createProyecto(
    createProyectoDto: CreateProyectoDto,
    user?: any,
  ): Promise<PrismaProyecto> {
    const { cotizacionId, ...dto } = createProyectoDto;

    // Si se pasa cotización, verificar que no pertenezca ya a un proyecto activo diferente
    if (cotizacionId) {
      const existingProjectWithQuote = await this.prisma.proyecto.findFirst({
        where: {
          cotizacionOrigen: { id: cotizacionId },
          estado: { not: 'Finalizado' },
        },
      });

      if (existingProjectWithQuote) {
        throw new BadRequestException(
          `La cotización seleccionada ya se encuentra vinculada al proyecto activo "${existingProjectWithQuote.nombre}" (${existingProjectWithQuote.codigo}). Debe utilizar una cotización diferente o registrar el nuevo servicio en Modo Preventa.`
        );
      }
    }

    let cotizacion = null;
    let cliente = null;

    if (cotizacionId) {
      cotizacion = await this.prisma.cotizacion.findUnique({
        where: { id: cotizacionId },
      });
      if (!cotizacion) throw new BadRequestException('La cotización asociada no existe.');

      cliente = await this.prisma.cliente.findUnique({
        where: { id: cotizacion.clientId },
      });
      if (!cliente) throw new BadRequestException('El cliente asociado a la cotización no existe.');

      const allowedStages = ['Ganado', 'Orden de Servicio'];
      if (!allowedStages.includes(cliente.etapaComercial)) {
        throw new BadRequestException({
          error: 'Proyecto no autorizado',
          message: `No es posible registrar este proyecto porque el cliente (${cliente.empresa}) se encuentra en etapa "${cliente.etapaComercial}".`,
        });
      }
    } else {
      // Flujo de Preventa
      cliente = await this.prisma.cliente.findUnique({
        where: { id: dto.clientId },
      });
      if (!cliente) throw new BadRequestException('El cliente seleccionado no existe.');
    }

    const newProyectoId = uuidv4();
    const projectCode = await this.generateProjectCode();

    let initialSemaforo: Semaforo = Semaforo.Verde;
    try {
      initialSemaforo = this.calculateSemaforo({
        estado: dto.estado,
        fechaFinEstimada: dto.fechaFinEstimada,
      });
    } catch (e) {
      console.error('Error calculating semaforo:', e);
    }

    try {
      const proyecto = await this.prisma.proyecto.create({
        data: {
          id: newProyectoId,
          codigo: projectCode,
          nombre: String(dto.nombre).toUpperCase(),
          descripcion: dto.descripcion || '',
          estado: dto.estado,
          prioridad: dto.prioridad,
          area: dto.area,
          semaforo: initialSemaforo,
          avance: 0,
          avanceCalculado: 0,

          ventaContratada: cotizacion ? Number(cotizacion.monto) : 0,
          costoPresupuestado: Number(dto.costoPresupuestado || 0) || (cotizacion ? Number(cotizacion.monto) * 0.60 : 0),
          margenMeta: (cotizacion ? Number(cotizacion.monto) : 0) - (Number(dto.costoPresupuestado || 0) || (cotizacion ? Number(cotizacion.monto) * 0.60 : 0)),

          creadoPor: user?.nombre || 'Admin',
          fechaCreacion: new Date(),
          fechaInicio: new Date(dto.fechaInicio),
          fechaFinEstimada: new Date(dto.fechaFinEstimada),
          clientId: dto.clientId,
          responsablePrincipalId: dto.responsablePrincipalId,
          responsablesAdicionales: dto.responsablesAdicionales || [],
          cotizacionOrigen: cotizacionId ? { connect: { id: cotizacionId } } : undefined,
        },
      });

      // Vincular los documentos de la cotización al nuevo proyecto
      if (cotizacionId) {
        await this.prisma.documento.updateMany({
          where: { cotizacionId: cotizacionId },
          data: { proyectoId: newProyectoId },
        });
      }

      if (user) {
        await this.auditoriaService.createLog({
          usuarioId: user.id,
          modulo: 'OPERACIONES',
          accion: 'CREAR_PROYECTO',
          detalles: { proyectoId: proyecto.id, nombre: proyecto.nombre },
        });
      }

      // TRIGGER: Notificar al Responsable Principal
      const userResponsable = await this.prisma.usuario.findUnique({
        where: { responsableId: dto.responsablePrincipalId },
      });

      if (userResponsable) {
        await this.notificacionesService.create({
          usuarioId: userResponsable.id,
          titulo: 'Nuevo Proyecto Asignado',
          mensaje: `Se te ha asignado como Responsable Principal del proyecto: ${proyecto.nombre}.`,
          tipo: 'SISTEMA',
        });
      }

      // TRIGGER: Notificación Global de Nuevo Proyecto
      await this.notificacionesService.create({
        titulo: `🚀 NUEVO PROYECTO: ${proyecto.codigo}`,
        mensaje: `Se ha registrado el proyecto ${proyecto.nombre} para el cliente ${cliente.empresa}.`,
        tipo: 'SISTEMA',
        esGlobal: true,
      });

      // TRIGGER: Notificar a Finanzas para la facturación inicial
      if (cotizacionId) {
        try {
          const hitos = await this.prisma.hitoPago.findMany({
            where: { cotizacionId },
            orderBy: { porcentaje: 'asc' }
          });
  
          let descHitos = 'el Hito Inicial (50%)';
          if (hitos && hitos.length > 0) {
            const primerHito = hitos[0];
            descHitos = `el Hito Inicial: "${primerHito.descripcion}" (${Number(primerHito.porcentaje)}% - S/ ${Number(primerHito.monto).toLocaleString('es-PE')})`;
          }
  
          const financeUsers = await this.prisma.usuario.findMany({
            where: { activo: true },
          });
          const targetUsers = financeUsers.filter((u) => {
            try {
              const mods = typeof u.modulos === 'string' ? JSON.parse(u.modulos) : u.modulos;
              return Array.isArray(mods) && mods.includes('finanzas');
            } catch (e) {
              return String(u.modulos).includes('finanzas');
            }
          });
          for (const u of targetUsers) {
            await this.notificacionesService.create({
              usuarioId: u.id,
              titulo: 'Facturación Inicial Pendiente',
              mensaje: `Se ha registrado el proyecto "${proyecto.nombre}" (${proyecto.codigo}). Recuerde facturar ${descHitos}.`,
              tipo: 'ALERTA',
            });
          }
        } catch (e) {
          console.error('Error al generar notificación para Finanzas en createProyecto:', e);
        }
  
        // NUEVA LÓGICA: Crear Adelantos automáticos si la cotización tiene hitos COBRADOS
        const hitosCobrados = await this.prisma.hitoPago.findMany({
          where: {
            cotizacionId: cotizacionId,
            estado: 'COBRADO'
          }
        });
  
        for (const hito of hitosCobrados) {
          await this.prisma.adelantoProyecto.create({
            data: {
              id: uuidv4(),
              proyectoId: proyecto.id,
              monto: Number(hito.monto),
              fechaRecibido: new Date(),
              metodo: 'TRANSFERENCIA',
              referencia: `Hito: ${hito.descripcion}`,
              saldoDisponible: Number(hito.monto),
              montoAplicado: 0,
              observaciones: `Cargado automáticamente desde Cotización ${cotizacion?.codigo}`,
              registradoPorId: user?.id || 'SISTEMA',
              updatedAt: new Date()
            }
          });
        }
      }

      await this.registrarHistorial(
        proyecto.id,
        null,
        'PROYECTO_CREADO',
        '',
        'Proyecto creado desde CRM',
        user,
      );
      return proyecto;
    } catch (error) {
      console.error('Error in createProyecto Prisma call:', error);
      throw error;
    }
  }

  async updateProyecto(
    id: string,
    updateProyectoDto: UpdateProyectoDto,
    user?: any,
  ): Promise<PrismaProyecto> {
    const proyectoToUpdate = await this.findOneProyecto(id);

    let updatedSemaforo: Semaforo = proyectoToUpdate.semaforo;
    if (
      updateProyectoDto.fechaFinEstimada ||
      updateProyectoDto.estado ||
      updateProyectoDto.fechaInicio
    ) {
      updatedSemaforo = this.calculateSemaforo({
        ...proyectoToUpdate,
        fechaInicio: updateProyectoDto.fechaInicio
          ? new Date(updateProyectoDto.fechaInicio)
          : proyectoToUpdate.fechaInicio,
        fechaFinEstimada: updateProyectoDto.fechaFinEstimada
          ? new Date(updateProyectoDto.fechaFinEstimada)
          : proyectoToUpdate.fechaFinEstimada,
        estado: updateProyectoDto.estado || proyectoToUpdate.estado,
      });
    }

    const updated = await this.prisma.proyecto.update({
      where: { id },
      data: {
        ...updateProyectoDto,
        fechaInicio: updateProyectoDto.fechaInicio
          ? new Date(updateProyectoDto.fechaInicio)
          : undefined,
        fechaFinEstimada: updateProyectoDto.fechaFinEstimada
          ? new Date(updateProyectoDto.fechaFinEstimada)
          : undefined,
        fechaFinReal: updateProyectoDto.fechaFinReal
          ? new Date(updateProyectoDto.fechaFinReal)
          : undefined,
        semaforo: updatedSemaforo,
        fechaActualizacion: new Date().toISOString(),
      },
    });

    if (user) {
      await this.auditoriaService.createLog({
        usuarioId: user.id,
        modulo: 'OPERACIONES',
        accion: 'ACTUALIZAR_PROYECTO',
        detalles: { proyectoId: id, cambios: updateProyectoDto },
      });
    }

    if (
      updateProyectoDto.estado &&
      updateProyectoDto.estado !== proyectoToUpdate.estado
    ) {
      if (updateProyectoDto.estado === 'Finalizado') {
        try {
          const projectWithQuote = await this.prisma.proyecto.findUnique({
            where: { id },
            select: {
              cotizacionOrigen: {
                select: {
                  id: true
                }
              }
            }
          });

          let descHitos = 'el Hito Final (50%)';
          if (projectWithQuote?.cotizacionOrigen?.id) {
            const hitos = await this.prisma.hitoPago.findMany({
              where: { cotizacionId: projectWithQuote.cotizacionOrigen.id },
              orderBy: { porcentaje: 'asc' }
            });
            if (hitos && hitos.length > 0) {
              const ultimoHito = hitos[hitos.length - 1];
              descHitos = `el Hito Final: "${ultimoHito.descripcion}" (${Number(ultimoHito.porcentaje)}% - S/ ${Number(ultimoHito.monto).toLocaleString('es-PE')})`;
              
              const hitosPendientes = hitos.filter(h => h.estado !== 'FACTURADO' && h.estado !== 'COBRADO');
              if (hitosPendientes.length > 1) {
                descHitos = `los hitos pendientes: ` + hitosPendientes.map(h => `"${h.descripcion}" (${Number(h.porcentaje)}%)`).join(', ');
              }
            }
          }

          const financeUsers = await this.prisma.usuario.findMany({
            where: { activo: true },
          });
          const targetUsers = financeUsers.filter((u) => {
            try {
              const mods = typeof u.modulos === 'string' ? JSON.parse(u.modulos) : u.modulos;
              return Array.isArray(mods) && mods.includes('finanzas');
            } catch (e) {
              return String(u.modulos).includes('finanzas');
            }
          });
          for (const u of targetUsers) {
            await this.notificacionesService.create({
              usuarioId: u.id,
              titulo: 'Facturación de Cierre Pendiente',
              mensaje: `El proyecto "${proyectoToUpdate.nombre}" (${proyectoToUpdate.codigo}) ha finalizado en campo. Recuerde facturar ${descHitos}.`,
              tipo: 'ALERTA',
            });
          }
        } catch (e) {
          console.error('Error al generar notificación para Finanzas en updateProyecto:', e);
        }
      }

      await this.registrarHistorial(
        id,
        null,
        'ESTADO_PROYECTO',
        proyectoToUpdate.estado,
        updateProyectoDto.estado,
        user,
      );
    }

    return updated;
  }

  async removeProyecto(id: string, user?: any): Promise<void> {
    try {
      const proyecto = await this.prisma.proyecto.findUnique({
        where: { id },
        include: {
          evidencias: true,
          documentos: true,
          ingenieriaDiseno: { include: { planos: true } },
          suboperaciones: { include: { entregables: true } },
          reportesDiarios: { include: { evidencias: true } },
          evaluacionTecnica: true,
          actividades: {
            include: {
              evidencias: true,
              validacionesRequeridas: true,
            },
          },
        },
      });

      if (!proyecto) throw new NotFoundException('Proyecto no encontrado');

      // 1. RECOPILAR TODAS LAS URL DE ARCHIVOS ASOCIADOS AL PROYECTO
      const urlsToDelete: string[] = [];

      proyecto.evidencias.forEach((e) => {
        if (e.url) urlsToDelete.push(e.url);
      });
      proyecto.documentos.forEach((d) => {
        if (d.url) urlsToDelete.push(d.url);
      });

      if (proyecto.ingenieriaDiseno) {
        proyecto.ingenieriaDiseno.planos.forEach((p) => {
          if (p.url) urlsToDelete.push(p.url);
        });
      }

      proyecto.suboperaciones.forEach((s) => {
        s.entregables.forEach((en) => {
          if (en.url) urlsToDelete.push(en.url);
        });
      });

      proyecto.reportesDiarios.forEach((r) => {
        r.evidencias.forEach((ev) => {
          if (ev.url) urlsToDelete.push(ev.url);
        });
      });

      if (proyecto.evaluacionTecnica?.documentoUrl) {
        urlsToDelete.push(proyecto.evaluacionTecnica.documentoUrl);
      }

      proyecto.actividades.forEach((act) => {
        act.evidencias.forEach((ev) => {
          if (ev.url) urlsToDelete.push(ev.url);
        });
        act.validacionesRequeridas.forEach((val) => {
          if (val.evidenciaUrl) urlsToDelete.push(val.evidenciaUrl);
        });
      });

      // 1. ELIMINACIÓN FÍSICA DE LOS ARCHIVOS DEL DISCO PRIMERO
      await deletePhysicalFiles(urlsToDelete);

      // 2. PROCEDER CON LA ELIMINACIÓN DE REGISTROS EN LA BD
      await this.prisma.$transaction(async (tx) => {
        const actividades = await tx.actividad.findMany({
          where: { proyectoId: id },
          select: { id: true },
        });
        const actividadIds = actividades.map((a) => a.id);
        const suboperaciones = await tx.suboperacion.findMany({
          where: { proyectoId: id },
          select: { id: true },
        });
        const subopIds = suboperaciones.map((s) => s.id);
        const ingenierias = await tx.ingenieriaDiseno.findMany({
          where: { proyectoId: id },
          select: { id: true },
        });
        const ingIds = ingenierias.map((i) => i.id);

        if (actividadIds.length > 0) {
          await tx.subtarea.deleteMany({
            where: { actividadId: { in: actividadIds } },
          });
          await tx.validacionRequerida.deleteMany({
            where: { actividadId: { in: actividadIds } },
          });
          await tx.evidencia.deleteMany({
            where: { actividadId: { in: actividadIds } },
          });
          await tx.comentario.deleteMany({
            where: { actividadId: { in: actividadIds } },
          });
          await tx.historialCambio.deleteMany({
            where: { actividadId: { in: actividadIds } },
          });
        }
        if (subopIds.length > 0)
          await tx.entregable.deleteMany({
            where: { suboperacionId: { in: subopIds } },
          });
        if (ingIds.length > 0)
          await tx.planoDiseno.deleteMany({
            where: { ingenieriaDisenoId: { in: ingIds } },
          });

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
        await tx.proyecto.delete({ where: { id } });
      });

      if (user) {
        await this.auditoriaService.createLog({
          usuarioId: user.id,
          modulo: 'OPERACIONES',
          accion: 'ELIMINAR_PROYECTO',
          detalles: { proyectoId: id, nombre: proyecto?.nombre },
        });
      }
    } catch (error: any) {
      console.error('[Operaciones] Error al eliminar proyecto:', error);
      throw error;
    }
  }

  async createActividad(
    createActividadDto: CreateActividadDto,
    user?: any,
  ): Promise<any> {
    console.log(
      '[OperacionesService] Iniciando createActividad para proyecto:',
      createActividadDto.proyectoId,
    );
    const { userRole, ...prismaData } = createActividadDto;

    // VALIDACIÓN CRONOLÓGICA
    const start = prismaData.fechaInicio
      ? new Date(prismaData.fechaInicio)
      : null;
    const due = prismaData.fechaVencimiento
      ? new Date(prismaData.fechaVencimiento)
      : null;
    const minDate = new Date('2000-01-01');

    if (start && start < minDate)
      throw new BadRequestException(
        'La fecha de inicio no puede ser anterior al año 2000.',
      );
    if (due && due < minDate)
      throw new BadRequestException(
        'La fecha de vencimiento no puede ser anterior al año 2000.',
      );
    if (start && due && due < start)
      throw new BadRequestException(
        'La fecha de vencimiento no puede ser anterior a la fecha de inicio.',
      );

    try {
      const actividad = await this.prisma.actividad.create({
        data: {
          ...prismaData,
          fechaCreacion: prismaData.fechaCreacion
            ? new Date(prismaData.fechaCreacion)
            : new Date(),
          fechaInicio: prismaData.fechaInicio
            ? new Date(prismaData.fechaInicio)
            : null,
          fechaFin: prismaData.fechaFin ? new Date(prismaData.fechaFin) : null,
          fechaVencimiento: prismaData.fechaVencimiento
            ? new Date(prismaData.fechaVencimiento)
            : null,
          responsablesApoyo: prismaData.responsablesApoyo || [],
        },
        include: { proyecto: true },
      });

      if (user) {
        await this.auditoriaService.createLog({
          usuarioId: user.id,
          modulo: 'OPERACIONES',
          accion: 'CREAR_ACTIVIDAD',
          detalles: {
            actividadId: actividad.id,
            descripcion: actividad.descripcion,
            proyecto: actividad.proyecto.nombre,
          },
        });
      }

      // TRIGGER: Notificar al Responsable de Actividad (Seguimiento Técnico)
      const userResponsable = await this.prisma.usuario.findUnique({
        where: { responsableId: prismaData.responsablePrincipalId },
      });

      if (userResponsable) {
        await this.notificacionesService.create({
          usuarioId: userResponsable.id,
          titulo: 'Actividad asignada',
          mensaje: `Se te asignó la actividad "${actividad.descripcion}" del proyecto ${actividad.proyecto.nombre}`,
          tipo: 'TECNICO',
        });
      }

      await this.registrarHistorial(
        prismaData.proyectoId,
        actividad.id,
        'ACTIVIDAD_CREADA',
        '',
        actividad.descripcion,
        user,
      );
      await this.updateProjectProgress(prismaData.proyectoId);

      console.log(
        '[OperacionesService] Actividad creada exitosamente:',
        actividad.id,
      );
      return actividad;
    } catch (error) {
      console.error('[OperacionesService] Error al crear actividad:', error);
      throw error;
    }
  }

  async updateActividad(
    id: string,
    dto: UpdateActividadDto,
    user?: any,
  ): Promise<any> {
    const oldActividad = await this.prisma.actividad.findUnique({
      where: { id },
      include: { proyecto: true },
    });
    if (!oldActividad)
      throw new NotFoundException(`Actividad con ID "${id}" no encontrada.`);

    const isAdmin = user?.rol === 'ADMIN';
    const isLider =
      dto.responsableId &&
      oldActividad.proyecto.responsablePrincipalId === dto.responsableId;

    console.log(
      `[updateActividad] ID: ${id}, Role: ${user?.rol}, isAdmin: ${isAdmin}, isLider: ${isLider}`,
    );

    if (dto.estado === 'Validada' && !isAdmin && !isLider) {
      console.error(
        `[updateActividad] Permission Denied: User is not ADMIN or Project Leader`,
      );
      throw new BadRequestException(
        'Solo el administrador o el Jefe de Proyecto pueden validar actividades.',
      );
    }

    if (oldActividad.estado === 'Validada' && !isAdmin && !isLider) {
      console.error(
        `[updateActividad] Locked: Activity is already validated and user is not ADMIN or Project Leader`,
      );
      throw new BadRequestException('Actividad bloqueada por validación.');
    }

    console.log('[updateActividad] progreso recibido:', dto.progreso, '| estado:', dto.estado, '| oldProgreso:', oldActividad.progreso, '| oldEstado:', oldActividad.estado);

    let nuevoProgreso = dto.progreso;
    let nuevoEstado = dto.estado;

    // LÓGICA DE ESTADOS AUTOMÁTICOS POR PROGRESO
    if (nuevoProgreso !== undefined) {
      if (nuevoProgreso === 0) {
        nuevoEstado = 'Pendiente';
      } else if (nuevoProgreso > 0 && nuevoProgreso < 100) {
        if (oldActividad.estado !== 'Validada') {
          nuevoEstado = 'EnProgreso';
        }
      } else if (nuevoProgreso === 100) {
        // Si llega al 100% y no estaba validada, pasa a Completada (esperando validación)
        if (oldActividad.estado !== 'Validada') {
          nuevoEstado = 'Completada';
        }
      }
    }

    // LÓGICA DE PROGRESO POR ESTADO
    if (dto.estado && dto.estado !== oldActividad.estado) {
      if (dto.estado === 'Pendiente') nuevoProgreso = 0;
      else if (
        dto.estado === 'EnProgreso' &&
        (oldActividad.progreso === 0 || oldActividad.progreso === 100)
      )
        nuevoProgreso = 50;
      else if (dto.estado === 'Completada' || dto.estado === 'Validada')
        nuevoProgreso = 100;
    }

    const { userRole: _, responsableId: __, ...prismaData } = dto;
    const updated = await this.prisma.actividad.update({
      where: { id },
      data: {
        ...prismaData,
        estado: nuevoEstado || undefined,
        progreso:
          nuevoProgreso !== undefined ? nuevoProgreso : oldActividad.progreso,
        fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : undefined,
        fechaFin:
          nuevoEstado === 'Completada' || nuevoEstado === 'Validada'
            ? new Date()
            : dto.fechaFin
              ? new Date(dto.fechaFin)
              : undefined,
        fechaVencimiento: dto.fechaVencimiento
          ? new Date(dto.fechaVencimiento)
          : undefined,
        responsablesApoyo: dto.responsablesApoyo || undefined,
      },
      include: { proyecto: true },
    });

    // TRIGGER: Notificar si fue Validada o Observada (Rechazada)
    if (updated.estado === 'Validada' && oldActividad.estado !== 'Validada') {
      const userResp = await this.prisma.usuario.findUnique({
        where: { responsableId: updated.responsablePrincipalId },
      });
      if (userResp) {
        await this.notificacionesService.create({
          usuarioId: userResp.id,
          titulo: 'Actividad Validada',
          mensaje: `Tu actividad "${updated.descripcion}" ha sido validada y finalizada correctamente.`,
          tipo: 'SISTEMA',
        });
      }
    }

    if (dto.estado === 'EnProgreso' && oldActividad.estado === 'Completada') {
      // Esto significa que fue rechazada/observada desde la bandeja de validación
      const userResp = await this.prisma.usuario.findUnique({
        where: { responsableId: updated.responsablePrincipalId },
      });
      if (userResp) {
        await this.notificacionesService.create({
          usuarioId: userResp.id,
          titulo: 'Actividad Observada',
          mensaje: `Se requiere revisar la actividad "${updated.descripcion}". Motivo: ${dto.observaciones || 'No especificado'}.`,
          tipo: 'SISTEMA',
        });
      }
    }

    // TRIGGER: Notificar al Proyecto cuando una tarea se completa
    if (
      (updated.estado === 'Completada' || updated.estado === 'Validada') &&
      oldActividad.estado !== 'Completada' &&
      oldActividad.estado !== 'Validada'
    ) {
      const principal = await this.prisma.usuario.findUnique({
        where: { responsableId: updated.proyecto.responsablePrincipalId },
      });
      if (principal) {
        await this.notificacionesService.create({
          usuarioId: principal.id,
          titulo: 'Tarea Finalizada',
          mensaje: `La actividad "${updated.descripcion}" del proyecto ${updated.proyecto.nombre} ha sido marcada como ${updated.estado}.`,
          tipo: 'SISTEMA',
        });
      }
    }

    if (dto.estado && dto.estado !== oldActividad.estado) {
      await this.registrarHistorial(
        oldActividad.proyectoId,
        id,
        'ESTADO_ACTIVIDAD',
        oldActividad.estado,
        dto.estado,
        user,
      );
      await this.updateProjectProgress(oldActividad.proyectoId);
    }
    return updated;
  }

  async removeActividad(id: string): Promise<void> {
    const actividad = await this.prisma.actividad.findUnique({
      where: { id },
      include: {
        evidencias: { select: { url: true } },
        validacionesRequeridas: { select: { evidenciaUrl: true } },
      },
    });

    if (actividad) {
      const urlsToDelete: string[] = [];
      actividad.evidencias.forEach((e) => {
        if (e.url) urlsToDelete.push(e.url);
      });
      actividad.validacionesRequeridas.forEach((v) => {
        if (v.evidenciaUrl) urlsToDelete.push(v.evidenciaUrl);
      });

      // 1. Eliminar archivos físicos primero
      await deletePhysicalFiles(urlsToDelete);

      // 2. Proceder con la eliminación del registro
      await this.prisma.actividad.delete({ where: { id } });

      await this.updateProjectProgress(actividad.proyectoId);
    }
  }

  async findAllActividades(
    page: number = 1,
    limit: number = 20,
    filters: any = {},
    user?: any,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};
    const andConditions: any[] = [];

    // 1. Filtros básicos
    if (filters.proyectoId) where.proyectoId = filters.proyectoId;
    if (filters.estado && filters.estado !== 'all')
      where.estado = filters.estado;
    if (filters.responsableId && filters.responsableId !== 'all')
      where.responsablePrincipalId = filters.responsableId;

    // 2. Filtro de búsqueda por texto
    if (filters.search) {
      andConditions.push({
        OR: [
          { descripcion: { contains: filters.search } },
          { proyecto: { codigo: { contains: filters.search } } },
          { proyecto: { nombre: { contains: filters.search } } },
        ],
      });
    }

    // 3. FILTRO DE SEGURIDAD POR ROL (REMOVIDO POR SOLICITUD)
    /*
    if (user && user.rol !== 'ADMIN' && user.rol !== 'SUPERVISOR') {
      const responsableId = user.responsable?.id;
      if (responsableId) {
        // El usuario estándar ve tareas donde es Principal O donde es de Apoyo
        andConditions.push({
          OR: [
            { responsablePrincipalId: responsableId },
            { responsablesApoyo: { array_contains: responsableId } },
          ],
        });
      } else {
        where.responsablePrincipalId = 'NONE';
      }
    }
    */

    // Combinar condiciones AND si existen
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    console.log(
      `[OperacionesService] Buscando actividades para usuario ${user?.username} (${user?.rol}). Filtros Finales:`,
      where,
    );

    const [data, total] = await Promise.all([
      this.prisma.actividad.findMany({
        where,
        include: {
          proyecto: { select: { codigo: true, nombre: true } },
          responsablePrincipal: true,
          subtareas: true,
          validacionesRequeridas: true,
        },
        orderBy: { fechaCreacion: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.actividad.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createSubtarea(data: any): Promise<any> {
    const subtarea = await this.prisma.subtarea.create({ data });
    const actividad = await this.prisma.actividad.findUnique({
      where: { id: data.actividadId },
    });
    if (actividad) await this.recalculateActivityProgress(actividad.id);
    return subtarea;
  }

  async updateSubtarea(id: string, data: any): Promise<any> {
    const subtarea = await this.prisma.subtarea.update({ where: { id }, data });
    await this.recalculateActivityProgress(subtarea.actividadId);
    return subtarea;
  }

  async updateValidacion(id: string, data: any, user?: any): Promise<any> {
    const validacion = await this.prisma.validacionRequerida.update({
      where: { id },
      data: {
        ...data,
        fechaValidacion: data.fechaValidacion
          ? new Date(data.fechaValidacion)
          : undefined,
      },
    });
    if (data.estado === 'Aprobada' || data.estado === 'Rechazada') {
      const activity = await this.prisma.actividad.findUnique({
        where: { id: validacion.actividadId },
      });
      if (activity) {
        await this.registrarHistorial(
          activity.proyectoId,
          activity.id,
          data.estado === 'Aprobada'
            ? 'VALIDACION_APROBADA'
            : 'VALIDACION_RECHAZADA',
          validacion.tipo,
          data.observaciones || 'Sin observaciones',
          user,
        );
      }
      if (data.estado === 'Aprobada') {
        const activityWithVal = await this.prisma.actividad.findUnique({
          where: { id: validacion.actividadId },
          include: { validacionesRequeridas: true },
        });
        if (
          activityWithVal &&
          activityWithVal.validacionesRequeridas.every(
            (v) => v.estado === 'Aprobada',
          )
        ) {
          await this.prisma.actividad.update({
            where: { id: activityWithVal.id },
            data: { estado: 'Validada' },
          });
          await this.registrarHistorial(
            activityWithVal.proyectoId,
            activityWithVal.id,
            'ESTADO_ACTIVIDAD',
            activityWithVal.estado,
            'Validada',
            user,
          );
          await this.updateProjectProgress(activityWithVal.proyectoId);
        }
      }
    }
    return validacion;
  }

  async createFichaTecnica(dto: any, user?: any) {
    // RESTRICCIÓN: Un cliente solo puede tener UNA visita técnica activa a la vez.
    // Estados activos: PENDIENTE, PROGRAMADA, EN_PROCESO
    const activeStates = ['PENDIENTE', 'PROGRAMADA', 'EN_PROCESO'];

    const clientHasActiveVisit = await this.prisma.fichaTecnica.findFirst({
      where: {
        clienteId: dto.clienteId,
        estado: { in: activeStates },
      },
      include: { cliente: true, tecnico: true },
    });

    if (clientHasActiveVisit) {
      throw new BadRequestException({
        error: 'Cliente con Visita Activa',
        message: `El cliente ${clientHasActiveVisit.cliente.empresa} ya tiene una visita técnica activa (${clientHasActiveVisit.estado}) asignada al técnico ${clientHasActiveVisit.tecnico.nombre}. Debe finalizarla (Marcar como COMPLETADA) antes de registrar una nueva.`,
      });
    }

    const ficha = await this.prisma.fichaTecnica.create({
      data: {
        clienteId: dto.clienteId,
        tecnicoId: dto.tecnicoId,
        fechaVisita: new Date(dto.fechaVisita),
        observaciones: dto.observaciones,
        hallazgos: dto.hallazgos,
        recomendaciones: dto.recomendaciones,
        estado: dto.estado || 'PENDIENTE',
        firmaTecnico: dto.firmaTecnico,
        costoMovilidad: dto.costoMovilidad ? Number(dto.costoMovilidad) : 0,
        costoViaticos: dto.costoViaticos ? Number(dto.costoViaticos) : 0,
        costoOtros: dto.costoOtros ? Number(dto.costoOtros) : 0,
        costoTotal: dto.costoTotal !== undefined 
          ? Number(dto.costoTotal) 
          : (Number(dto.costoMovilidad || 0) + Number(dto.costoViaticos || 0) + Number(dto.costoOtros || 0)),
        observacionesCostos: dto.observacionesCostos || null,
        gastosImputados: dto.gastosImputados || false,
        adjuntos: {
          create:
            dto.adjuntos?.map((adj: any) => ({
              nombre: adj.nombre,
              url: adj.url,
              tipo: adj.tipo,
            })) || [],
        },
      },
      include: { adjuntos: true, cliente: true, tecnico: true },
    });

    if (user) {
      await this.auditoriaService.createLog({
        usuarioId: user.id,
        modulo: 'OPERACIONES',
        accion: 'CREAR_FICHA_TECNICA',
        detalles: { fichaId: ficha.id, cliente: ficha.cliente.empresa },
      });
    }

    // REGISTRAR EN BITÁCORA DE SEGUIMIENTO (CRM)
    try {
      const fechaVisita = new Date(ficha.fechaVisita);
      const dia = String(fechaVisita.getDate()).padStart(2, '0');
      const mes = String(fechaVisita.getMonth() + 1).padStart(2, '0');
      const anio = fechaVisita.getFullYear();
      const hora = String(fechaVisita.getHours()).padStart(2, '0');
      const min = String(fechaVisita.getMinutes()).padStart(2, '0');
      const fechaFmt = `${dia}/${mes}/${anio} ${hora}:${min}`;

      await this.prisma.interaccion.create({
        data: {
          clientId: ficha.clienteId,
          fecha: new Date(),
          tipo: 'Visita Técnica',
          accion: 'Visita Técnica Programada',
          observaciones: `Visita agendada para el ${fechaFmt}. Técnico: ${ficha.tecnico.nombre}. ${ficha.observaciones ? 'Notas: ' + ficha.observaciones : ''}`,
          usuario: user?.nombre || 'SISTEMA',
        },
      });
      console.log(
        `[Operaciones] Bitácora CRM actualizada (Programación) para cliente ${ficha.clienteId}`,
      );
    } catch (error) {
      console.error(
        '[Operaciones] Error al registrar bitácora CRM (Programación):',
        error.message,
      );
    }

    // TRIGGER: Notificar al Técnico Asignado (Seguimiento Técnico)
    const userTecnico = await this.prisma.usuario.findUnique({
      where: { responsableId: dto.tecnicoId },
    });

    if (userTecnico) {
      const fechaFormateada = new Date(ficha.fechaVisita).toLocaleString(
        'es-PE',
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        },
      );

      await this.notificacionesService.create({
        usuarioId: userTecnico.id,
        titulo: 'Seguimiento Técnico Asignado',
        mensaje: `Se ha registrado una visita técnica para el cliente ${ficha.cliente.empresa}. Programada para: ${fechaFormateada}. Por favor, revise su bandeja técnica.`,
        tipo: 'TECNICO',
        fechaProgramada: ficha.fechaVisita,
      });
      console.log(
        `[Operaciones] Notificación enviada a técnico ${userTecnico.nombre} (ID: ${userTecnico.id})`,
      );
    } else {
      console.warn(
        `[Operaciones] No se encontró usuario para el responsable técnico ID: ${dto.tecnicoId}`,
      );
    }

    return ficha;
  }

  async findAllFichas(
    page: number = 1,
    limit: number = 20,
    filters: any = {},
    user?: any,
  ) {
    // PROTECCIÓN: Evitar NaN si el frontend envía basura en los parámetros
    const safePage = isNaN(page) || page < 1 ? 1 : page;
    const safeLimit = isNaN(limit) || limit < 1 ? 20 : limit;

    const skip = (safePage - 1) * safeLimit;

    // Construcción robusta del objeto where
    let where: any = {};

    if (typeof filters === 'string') {
      where.tecnicoId = filters;
    } else if (filters && typeof filters === 'object') {
      where = { ...filters };
    }

    if (filters.search) {
      const search = filters.search;
      where.OR = [
        { cliente: { empresa: { contains: search } } },
        { cliente: { ruc: { contains: search } } },
        { tecnico: { nombre: { contains: search } } },
      ];
      delete where.search;
    }

    // Filtro por Fecha
    if (filters.startDate || filters.endDate) {
      where.fechaVisita = {};
      if (filters.startDate) {
        // Usar inicio del día local
        where.fechaVisita.gte = new Date(filters.startDate + 'T00:00:00');
      }
      if (filters.endDate) {
        // Usar fin del día local
        where.fechaVisita.lte = new Date(filters.endDate + 'T23:59:59');
      }
      delete where.startDate;
      delete where.endDate;
    }

    // FILTRO POR ROL (REMOVIDO POR SOLICITUD)
    // Ahora todos pueden ver todas las fichas técnicas
    /*
    if (user && user.rol !== 'ADMIN' && user.rol !== 'SUPERVISOR') {
      const responsableId = user.responsable?.id;
      if (responsableId) {
        where.tecnicoId = responsableId;
      } else {
        // Si no tiene responsable vinculado y no es Admin/Supervisor, no debería ver nada
        where.tecnicoId = 'NONE';
      }
    } else if (
      user &&
      (user.rol === 'ADMIN' || user.rol === 'SUPERVISOR') &&
      filters.tecnicoId
    ) {
      // Si es ADMIN/SUPERVISOR y filtró por un técnico específico, lo respetamos
      where.tecnicoId = filters.tecnicoId;
    }
    */
    
    // Si filtró explícitamente por un técnico, lo respetamos (sin importar rol)
    if (filters.tecnicoId) {
      where.tecnicoId = filters.tecnicoId;
    }

    const [data, total, pending, completed] = await Promise.all([
      this.prisma.fichaTecnica.findMany({
        where,
        include: { cliente: true, tecnico: true, adjuntos: true },
        orderBy: { fechaVisita: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.fichaTecnica.count({ where }),
      this.prisma.fichaTecnica.count({
        where: { ...where, estado: 'PENDIENTE' },
      }),
      this.prisma.fichaTecnica.count({
        where: { ...where, estado: 'COMPLETADA' },
      }),
    ]);
    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
      stats: { pending, completed },
    };
  }

  async updateFicha(id: string, dto: any, user?: any) {
    const { adjuntos, datosTecnicos, ...rest } = dto;
    const data: any = {
      ...rest,
      fechaVisita: dto.fechaVisita ? new Date(dto.fechaVisita) : undefined,
    };
    if (rest.costoMovilidad !== undefined) data.costoMovilidad = Number(rest.costoMovilidad);
    if (rest.costoViaticos !== undefined) data.costoViaticos = Number(rest.costoViaticos);
    if (rest.costoOtros !== undefined) data.costoOtros = Number(rest.costoOtros);
    if (rest.costoTotal !== undefined) {
      data.costoTotal = Number(rest.costoTotal);
    } else if (rest.costoMovilidad !== undefined || rest.costoViaticos !== undefined || rest.costoOtros !== undefined) {
      const current = await this.prisma.fichaTecnica.findUnique({ where: { id } });
      const m = rest.costoMovilidad !== undefined ? Number(rest.costoMovilidad) : Number(current?.costoMovilidad || 0);
      const v = rest.costoViaticos !== undefined ? Number(rest.costoViaticos) : Number(current?.costoViaticos || 0);
      const o = rest.costoOtros !== undefined ? Number(rest.costoOtros) : Number(current?.costoOtros || 0);
      data.costoTotal = m + v + o;
    }
    if (datosTecnicos !== undefined) data.datosTecnicos = datosTecnicos;
    if (adjuntos && Array.isArray(adjuntos)) {
      // 1. Obtener URLs de adjuntos antiguos para borrarlos físicamente
      const oldAdjuntos = await this.prisma.fichaTecnicaAdjunto.findMany({
        where: { fichaTecnicaId: id },
        select: { url: true },
      });
      const oldUrls = oldAdjuntos.map((a) => a.url).filter(Boolean);

      await this.prisma.fichaTecnicaAdjunto.deleteMany({
        where: { fichaTecnicaId: id },
      });

      // 2. Borrar físicamente los archivos antiguos que ya no se usan
      const newUrls = adjuntos.map((a: any) => a.url).filter(Boolean);
      const urlsToDelete = oldUrls.filter((url) => !newUrls.includes(url));
      await deletePhysicalFiles(urlsToDelete);

      data.adjuntos = {
        create: adjuntos.map((a: any) => ({
          nombre: a.nombre,
          url: a.url,
          tipo: a.tipo || 'Documento',
        })),
      };
    }
    const updatedFicha = await this.prisma.fichaTecnica.update({
      where: { id },
      data,
      include: { adjuntos: true, cliente: true },
    });

    if (user) {
      await this.auditoriaService.createLog({
        usuarioId: user.id,
        modulo: 'OPERACIONES',
        accion: 'ACTUALIZAR_FICHA_TECNICA',
        detalles: { fichaId: id, cliente: updatedFicha.cliente.empresa },
      });
    }

    // TRIGGER: Notificaciones y Actualización CRM al completar la ficha
    if (dto.estado === 'COMPLETADA') {
      console.log(
        `[Operaciones] >>> INICIANDO PROCESO DE FINALIZACIÓN para ficha ${id}`,
      );

      try {
        // 1. Notificar al Asesor Específico (si existe)
        const nombreAsesor = updatedFicha.cliente?.asignadoA?.trim();
        if (nombreAsesor) {
          const asesor = await this.prisma.usuario.findFirst({
            where: { responsable: { nombre: { contains: nombreAsesor } } },
          });
          if (asesor) {
            await this.notificacionesService.create({
              usuarioId: asesor.id,
              titulo: '¡Tu Inspección está Lista!',
              mensaje: `Se ha completado la ficha de ${updatedFicha.cliente.empresa}. Ya puedes generar la cotización.`,
              tipo: 'VISITA',
            });
          }
        }

        // 2. NOTIFICAR A TODO EL EQUIPO COMERCIAL (ERROR SOLICITADO)
        // Buscamos usuarios activos que tengan 'comercial' o 'crm' en sus módulos
        const usuariosComerciales = await this.prisma.usuario.findMany({
          where: { activo: true },
        });

        for (const u of usuariosComerciales) {
          let tieneAcceso = false;
          try {
            const modulos =
              typeof u.modulos === 'string' ? JSON.parse(u.modulos) : u.modulos;
            if (Array.isArray(modulos)) {
              tieneAcceso = modulos.some((m) =>
                ['comercial', 'crm'].includes(String(m).toLowerCase()),
              );
            }
          } catch (e) {
            if (
              String(u.modulos).toLowerCase().includes('comercial') ||
              String(u.modulos).toLowerCase().includes('crm')
            ) {
              tieneAcceso = true;
            }
          }

          // Evitar notificar dos veces al mismo si él era el asesor principal (ya notificado arriba)
          if (tieneAcceso && (!nombreAsesor || u.nombre !== nombreAsesor)) {
            await this.notificacionesService.create({
              usuarioId: u.id,
              titulo: 'Nueva Inspección Finalizada',
              mensaje: `La inspección para ${updatedFicha.cliente.empresa} ha finalizado. Los datos técnicos están sincronizados para cotizar.`,
              tipo: 'VISITA',
            });
          }
        }

        // 3. REGISTRAR EN BITÁCORA DE SEGUIMIENTO (CRM)
        await this.prisma.interaccion.create({
          data: {
            clientId: updatedFicha.clienteId,
            fecha: new Date(),
            tipo: 'Visita',
            accion: 'Inspección Finalizada',
            observaciones: `El equipo técnico ha finalizado la inspección en campo para ${updatedFicha.cliente.empresa}. Hallazgos y recomendaciones sincronizados.`,
            usuario: user?.nombre || 'TÉCNICO DE CAMPO',
          },
        });

        // 4. Actualizar etapa comercial del cliente a "Inspección Realizada"
        await this.prisma.cliente.update({
          where: { id: updatedFicha.clienteId },
          data: {
            etapaComercial: 'Inspección Realizada',
            ultimoContacto: new Date(),
            // Asegurar sincronización de datos técnicos al perfil del cliente
            hallazgosTecnicos: dto.hallazgos
              ? String(dto.hallazgos)
                  .split('\n')
                  .filter((s) => s.trim() !== '')
              : undefined,
            solucionesPropuestas: dto.recomendaciones
              ? String(dto.recomendaciones)
                  .split('\n')
                  .filter((s) => s.trim() !== '')
              : undefined,
            accion: 'Realizar Cotización',
          },
        });

        console.log(
          `[Operaciones] >>> ÉXITO: Cliente ${updatedFicha.cliente.empresa} movido a "Inspección Realizada"`,
        );
      } catch (triggerError) {
        console.error(
          '[Operaciones] ERROR en triggers de finalización:',
          triggerError,
        );
      }
    }
    return updatedFicha;
  }

  async removeFicha(id: string, user?: any) {
    const ficha = await this.prisma.fichaTecnica.findUnique({
      where: { id },
      include: { adjuntos: true, cliente: true },
    });
    if (!ficha) throw new NotFoundException('Ficha técnica no encontrada');

    // 1. RECOPILAR TODAS LAS URL DE ADJUNTOS
    const urlsToDelete =
      ficha.adjuntos?.map((adj) => adj.url).filter(Boolean) || [];

    // 1. ELIMINACIÓN FÍSICA PRIMERO
    await deletePhysicalFiles(urlsToDelete);

    // 2. PROCEDER CON LA ELIMINACIÓN DE REGISTROS EN LA BD
    await this.prisma.$transaction(async (tx) => {
      await tx.fichaTecnicaAdjunto.deleteMany({
        where: { fichaTecnicaId: id },
      });
      await tx.fichaTecnica.delete({ where: { id } });
    });

    if (user) {
      await this.auditoriaService.createLog({
        usuarioId: user.id,
        modulo: 'OPERACIONES',
        accion: 'ELIMINAR_FICHA_TECNICA',
        detalles: { fichaId: id, cliente: ficha.cliente.empresa },
      });
    }
    return { success: true };
  }

  private async registrarHistorial(
    proyectoId: string,
    actividadId: string | null,
    campo: string,
    valorAnterior: string,
    valorNuevo: string,
    user?: any,
  ) {
    // 1. Identificar al usuario que realiza la acción (Diego, Percy, etc)
    const usuarioFinal =
      user?.nombre ||
      user?.username ||
      (user?.id ? `ID:${user.id.slice(0, 5)}` : 'Sistema');

    // 2. Obtener el nombre del responsable para que quede grabado "en piedra"
    let responsableAGrabar = null;
    try {
      if (actividadId) {
        const act = await this.prisma.actividad.findUnique({
          where: { id: actividadId },
          include: { responsablePrincipal: { select: { nombre: true } } },
        });
        responsableAGrabar = act?.responsablePrincipal?.nombre;
      }

      // Si no hay actividad o no tiene responsable, buscamos el del proyecto
      if (!responsableAGrabar && proyectoId) {
        const proy = await this.prisma.proyecto.findUnique({
          where: { id: proyectoId },
          include: { responsablePrincipal: { select: { nombre: true } } },
        });
        responsableAGrabar = proy?.responsablePrincipal?.nombre;
      }
    } catch (e) {
      console.error(
        '[registrarHistorial] Error al buscar responsable:',
        e.message,
      );
    }

    await this.prisma.historialCambio.create({
      data: {
        proyectoId,
        actividadId,
        campo,
        valorAnterior: String(valorAnterior),
        valorNuevo: String(valorNuevo),
        usuario: usuarioFinal,
        area: 'OperacionesDeCampo',
        fecha: new Date(),
        motivo: responsableAGrabar, // Persistimos el nombre aquí
      },
    });
  }

  private async recalculateActivityProgress(actividadId: string) {
    const subtareas = await this.prisma.subtarea.findMany({
      where: { actividadId },
    });
    if (subtareas.length === 0) return;
    const completadas = subtareas.filter((s) => s.completada).length;
    const progreso = Math.round((completadas / subtareas.length) * 100);
    let estado: EstadoActividad = EstadoActividad.Pendiente;
    if (progreso === 100) estado = EstadoActividad.Completada;
    else if (progreso > 0) estado = EstadoActividad.EnProgreso;
    const actividad = await this.prisma.actividad.update({
      where: { id: actividadId },
      data: { progreso, estado },
    });
    await this.updateProjectProgress(actividad.proyectoId);
  }

  private async updateProjectProgress(proyectoId: string) {
    const actividades = await this.prisma.actividad.findMany({
      where: { proyectoId },
    });
    if (actividades.length === 0) return;
    const totalPeso = actividades.reduce(
      (acc, a) => acc + (a.ponderacion || 1),
      0,
    );
    const pesosCompletados = actividades
      .filter((a) => a.estado === 'Completada' || a.estado === 'Validada')
      .reduce((acc, a) => acc + (a.ponderacion || 1), 0);
    const avance =
      totalPeso > 0 ? Math.round((pesosCompletados / totalPeso) * 100) : 0;
    await this.prisma.proyecto.update({
      where: { id: proyectoId },
      data: { avance, avanceCalculado: avance },
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
    const responsable = await this.prisma.responsable.findUnique({
      where: { id },
    });
    if (!responsable)
      throw new NotFoundException(`Responsable con ID "${id}" no encontrado.`);
    return responsable;
  }

  // ============================================
  // TIMELINE / HISTORIAL
  // ============================================

  async getTimelinePaginado(
    page: number = 1,
    limit: number = 20,
    filters: { proyectoId?: string; tipo?: string; search?: string } = {},
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};
    const andConditions: any[] = [];

    // 1. Filtro por Proyecto
    if (filters.proyectoId && filters.proyectoId !== 'all') {
      where.proyectoId = filters.proyectoId;
    }

    // 2. Filtro por Tipo de Evento
    if (filters.tipo && filters.tipo !== 'all') {
      if (filters.tipo === 'proyectos') {
        andConditions.push({
          OR: [
            { campo: { contains: 'PROYECTO' } },
            { campo: { contains: 'ESTADO_PROYECTO' } },
          ],
        });
      } else if (filters.tipo === 'actividades') {
        andConditions.push({
          OR: [
            { campo: { contains: 'ACTIVIDAD' } },
            { campo: { contains: 'ESTADO_ACTIVIDAD' } },
          ],
        });
      } else if (filters.tipo === 'validaciones') {
        andConditions.push({
          campo: { contains: 'VALIDACION' },
        });
      } else if (filters.tipo === 'checklist') {
        andConditions.push({
          campo: { contains: 'CHECKLIST' },
        });
      }
    }

    // 3. Filtro por Búsqueda (Texto)
    if (filters.search) {
      andConditions.push({
        OR: [
          { campo: { contains: filters.search } },
          { valorNuevo: { contains: filters.search } },
          { usuario: { contains: filters.search } },
          {
            proyecto: {
              OR: [
                { nombre: { contains: filters.search } },
                { codigo: { contains: filters.search } },
              ],
            },
          },
          {
            actividad: {
              descripcion: { contains: filters.search },
            },
          },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [data, total] = await Promise.all([
      this.prisma.historialCambio.findMany({
        where,
        include: {
          proyecto: {
            select: {
              codigo: true,
              nombre: true,
              responsablePrincipal: { select: { nombre: true } },
            },
          },
          actividad: {
            select: {
              descripcion: true,
              responsablePrincipal: { select: { nombre: true } },
            },
          },
        },
        orderBy: { fecha: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.historialCambio.count({ where }),
    ]);

    // Mapear al formato que espera el frontend
    const formattedData = data.map((h) => ({
      ...h,
      proyectoNombre: h.proyecto?.nombre,
      proyectoCodigo: h.proyecto?.codigo,
      actividadDescripcion: h.actividad?.descripcion,
      responsableNombre:
        h.motivo ||
        h.actividad?.responsablePrincipal?.nombre ||
        h.proyecto?.responsablePrincipal?.nombre,
    }));

    return {
      data: formattedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async generateProjectCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `HHT-OPE-${year.toString().slice(-2)}-`;
    const count = await this.prisma.proyecto.count();
    let nextNumber = count + 1;
    let code = `${prefix}${nextNumber.toString().padStart(3, '0')}`;

    // Verificar colisiones y aumentar el número hasta que sea único
    let exists = await this.prisma.proyecto.findUnique({
      where: { codigo: code },
    });

    while (exists) {
      nextNumber++;
      code = `${prefix}${nextNumber.toString().padStart(3, '0')}`;
      exists = await this.prisma.proyecto.findUnique({
        where: { codigo: code },
      });
    }

    return code;
  }
  private calculateSemaforo(
    proyecto: Partial<PrismaProyecto | CreateProyectoDto>,
  ): Semaforo {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (proyecto.estado === EstadoProyecto.Finalizado) return Semaforo.Verde;
    if (proyecto.estado === EstadoProyecto.Detenido) return Semaforo.Rojo;
    const fechaFin = proyecto.fechaFinEstimada
      ? new Date(proyecto.fechaFinEstimada)
      : null;
    if (!fechaFin) return Semaforo.Amarillo;
    const diasRestantes = Math.ceil(
      (fechaFin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diasRestantes < 3) return Semaforo.Rojo;
    if (diasRestantes <= 7) return Semaforo.Amarillo;
    return Semaforo.Verde;
  }
}
