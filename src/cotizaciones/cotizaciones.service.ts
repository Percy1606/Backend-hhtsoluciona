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
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CotizacionesService {
  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
    private finanzasService: FinanzasService,
  ) {}

  async create(dto: CreateCotizacionDto) {
    try {
      const {
        fileUrl,
        fileName,
        fileType,
        fecha,
        alcance,
        cajaId,
        hitos,
        liderId,
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

        return result;
      });

      // TRIGGER AUTOMÁTICO: Mover a "Cotización Enviada" o "Ganado"
      const esGanada = ['Ganada', 'Aprobado', 'Aprobada'].includes(dto.estado);

      try {
        if (esGanada) {
          // 1. Actualizar Etapa del Cliente a "Ganado"
          await this.prisma.cliente.update({
            where: { id: cotizacion.clientId },
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
              clientId: cotizacion.clientId,
              cotizacionId: cotizacion.id,
              fecha: new Date(),
              tipo: 'Venta',
              accion: 'Cotización Ganada',
              observaciones: `La cotización ${cotizacion.codigo} por S/ ${cotizacion.monto} ha sido creada directamente como Ganada. El cliente ha pasado a etapa "Ganado".`,
              usuario: 'SISTEMA',
            },
          });

          // 3. Notificar a admins
          const admins = await this.prisma.usuario.findMany({
            where: { rol: 'ADMIN' },
          });
          for (const admin of admins) {
            await this.notificacionesService.create({
              usuarioId: admin.id,
              titulo: '¡Venta Cerrada Directa!',
              mensaje: `La cotización ${cotizacion.codigo} ha sido GANADA en el mismo momento de su creación.`,
              tipo: 'COTIZACION',
            });
          }

          // 4. AUTO-GENERACIÓN: Proyecto + OrdenDeServicio
          this.autoGenerarDesdeGanada(cotizacion, null, liderId).catch((err) => {
            console.error('[Cotizaciones] Error en auto-generación al ganar en create:', err.message);
          });

        } else {
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
        }
      } catch (triggerError) {
        console.error(
          '[Cotizaciones] Error en trigger de actualización de etapa en create:',
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

  private async getVersionChainIds(id: string): Promise<string[]> {
    const ids = [id];
    let currentId = id;
    
    // Buscar hacia arriba (padres)
    while (currentId) {
      const q = await this.prisma.cotizacion.findUnique({
        where: { id: currentId },
        select: { cotizacionPadreId: true }
      });
      if (q?.cotizacionPadreId) {
        ids.push(q.cotizacionPadreId);
        currentId = q.cotizacionPadreId;
      } else {
        break;
      }
    }
    
    // Buscar hacia abajo (revisiones)
    const findChildren = async (parentId: string) => {
      const children = await this.prisma.cotizacion.findMany({
        where: { cotizacionPadreId: parentId },
        select: { id: true }
      });
      for (const child of children) {
        ids.push(child.id);
        await findChildren(child.id);
      }
    };
    
    await findChildren(id);
    return [...new Set(ids)]; // Eliminar duplicados
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
      liderId,
      ...quoteData
    } = dto;

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

      return result;
    });

    // TRIGGER: Notificación de Venta Cerrada y Actualización de Cliente
    // Compatible con estados nuevos (Ganada) y legacy (Aprobado/Aprobada)
    const esGanada = ['Ganada', 'Aprobado', 'Aprobada'].includes(dto.estado);
    const eraGanada = ['Ganada', 'Aprobado', 'Aprobada'].includes(oldQuote.estado);

    if (esGanada && !eraGanada) {
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
            accion: 'Cotización Ganada',
            observaciones: `La cotización ${updated.codigo} por S/ ${updated.monto} ha sido marcada como Ganada. El cliente ha pasado a etapa "Ganado".`,
            usuario: 'SISTEMA',
          },
        });
      } catch (triggerError) {
        console.error(
          '[Cotizaciones] Error al actualizar estado de cliente en aprobación:',
          triggerError.message,
        );
      }

      // 3. Notificar a admins
      const admins = await this.prisma.usuario.findMany({
        where: { rol: 'ADMIN' },
      });
      for (const admin of admins) {
        await this.notificacionesService.create({
          usuarioId: admin.id,
          titulo: '¡Venta Cerrada!',
          mensaje: `La cotización ${updated.codigo} del cliente ${oldQuote.cliente.empresa} ha sido GANADA.`,
          tipo: 'COTIZACION',
        });
      }

      // 4. AUTO-GENERACIÓN: Proyecto + OrdenDeServicio (en background, no bloquea)
      this.autoGenerarDesdeGanada(updated, user, liderId).catch((err) => {
        console.error('[Cotizaciones] Error en auto-generación al ganar:', err.message);
      });
    }

    // Si la cotización ya tiene un proyecto generado y se provee liderId, actualizamos el líder del proyecto
    if (liderId) {
      const proyecto = await this.prisma.proyecto.findFirst({
        where: { cotizacionOrigen: { id: id } }
      });
      if (proyecto) {
        await this.prisma.proyecto.update({
          where: { id: proyecto.id },
          data: { responsablePrincipalId: liderId }
        });
      }
    }

    return updated;
  }

  // ============================================================
  // AUTO-GENERACIÓN: Se dispara cuando una cotización es Ganada
  // ============================================================
  private async autoGenerarDesdeGanada(cotizacion: any, user?: any, liderId?: string) {
    console.log(`[AutoGen] Iniciando generación automática para cotización ${cotizacion.codigo}`);

    try {
      // Solo advertir si no hay documentos, pero NO bloquear la creación del proyecto
      const documentos = await this.prisma.documento.findMany({
        where: { cotizacionId: cotizacion.id },
      });
      if (!documentos || documentos.length === 0) {
        console.warn(`[AutoGen] Cotización ${cotizacion.codigo} sin documentos adjuntos. El proyecto se generará igualmente.`);
      }

      // Validación: no generar si ya tiene proyecto
      if (cotizacion.proyectoGeneradoId) {
        console.log(`[AutoGen] Cotización ${cotizacion.codigo} ya tiene proyecto generado. Omitiendo.`);
        return;
      }

      // Se eliminó la validación de cliente con proyecto activo para generar
      // una Orden de Servicio independiente por cada Cotización ganada.
      const responsablePorDefecto = liderId 
        ? await this.prisma.responsable.findUnique({ where: { id: liderId } })
        : await this.prisma.responsable.findFirst({
            where: { activo: true },
            orderBy: { id: 'asc' },
          });
      if (!responsablePorDefecto) {
        console.error('[AutoGen] No hay responsables activos en el sistema. Proyecto no generado.');
        return;
      }

      const proyectoId = uuidv4();
      const projectCode = await this.generateProyectoCodigo();
      const osCode = await this.generateOsCodigo();
      const hoy = new Date();
      const en30Dias = new Date(hoy);
      en30Dias.setDate(en30Dias.getDate() + 30);

      await this.prisma.$transaction(async (tx) => {
        // 1. Crear Proyecto
        const proyecto = await tx.proyecto.create({
          data: {
            id: proyectoId,
            codigo: projectCode,
            nombre: String(cotizacion.referencia || cotizacion.codigo).toUpperCase(),
            descripcion: cotizacion.objetivo || '',
            estado: 'Planificacion',
            semaforo: 'Verde',
            prioridad: 'Media',
            area: 'OperacionesDeCampo',
            fechaInicio: hoy,
            fechaFinEstimada: en30Dias,
            responsablePrincipalId: responsablePorDefecto.id,
            responsablesAdicionales: [],
            ventaContratada: Number(cotizacion.monto),
            costoPresupuestado: 0,
            margenMeta: Number(cotizacion.monto),
            avance: 0,
            avanceCalculado: 0,
            clientId: cotizacion.clientId,
            // Nuevos campos Fase 1
            estadoFinanciero: 'SinPago',
            autorizaCompras: false,
            estadoLogistica: 'PendienteRevision',
            creadoPor: user?.nombre || 'SISTEMA',
            cotizacionOrigen: { connect: { id: cotizacion.id } },
          },
        });

        // Vincular los documentos de la cotización al nuevo proyecto (si existen)
        await tx.documento.updateMany({
          where: { cotizacionId: cotizacion.id },
          data: { proyectoId: proyecto.id },
        });

        // 2. Crear Orden de Servicio
        await tx.ordenDeServicio.create({
          data: {
            codigo: osCode,
            cotizacionId: cotizacion.id,
            proyectoId: proyecto.id,
            terminos: cotizacion.objetivo || '',
            observaciones: cotizacion.alcance ? JSON.stringify(cotizacion.alcance) : null,
            estado: 'Activo',
          },
        });

        // 3. Cargar adelantos desde hitos COBRADOS
        const hitosCobrados = await tx.hitoPago.findMany({
          where: { cotizacionId: cotizacion.id, estado: 'COBRADO' },
        });
        for (const hito of hitosCobrados) {
          await tx.adelantoProyecto.create({
            data: {
              id: uuidv4(),
              proyectoId: proyecto.id,
              monto: Number(hito.monto),
              fechaRecibido: new Date(),
              metodo: 'TRANSFERENCIA',
              referencia: `Hito: ${hito.descripcion}`,
              saldoDisponible: Number(hito.monto),
              montoAplicado: 0,
              observaciones: `Cargado automáticamente desde Cotización ${cotizacion.codigo}`,
              registradoPorId: user?.id || 'SISTEMA',
              updatedAt: new Date(),
            },
          });
          // Si hay adelantos, autorizar compras y actualizar estado financiero
          await tx.proyecto.update({
            where: { id: proyecto.id },
            data: {
              estadoFinanciero: 'AdelantoRecibido',
              autorizaCompras: true,
            },
          });
        }
      });

      console.log(`[AutoGen] ✅ Proyecto ${projectCode} y OS ${osCode} generados exitosamente.`);

      // 4. Notificar a usuarios de Finanzas, Logística y Operaciones
      const usuariosTarget = await this.prisma.usuario.findMany({
        where: { activo: true },
      });
      const cotizacionConCliente = await this.prisma.cotizacion.findUnique({
        where: { id: cotizacion.id },
        include: { cliente: true },
      });
      
      const liderNombre = responsablePorDefecto?.nombre || 'Alguien del equipo';

      for (const u of usuariosTarget) {
        let modulos: string[] = [];
        try {
          modulos = Array.isArray(u.modulos) ? u.modulos as string[] : JSON.parse(u.modulos as string);
        } catch(e) {
          modulos = [];
        }

        const esFinanzasOLogistica = modulos.some((m) =>
          ['finanzas', 'logistica', 'dashboard'].includes(m.toLowerCase()),
        );
        const esOperaciones = modulos.some((m) =>
          ['operaciones', 'dashboard'].includes(m.toLowerCase()),
        );

        if (esFinanzasOLogistica) {
          await this.notificacionesService.create({
            usuarioId: u.id,
            titulo: '🎉 Nuevo Proyecto Generado',
            mensaje: `Se ganó la cotización ${cotizacion.codigo} del cliente ${cotizacionConCliente?.cliente?.empresa || ''}. Proyecto ${projectCode} listo en Finanzas y Logística.`,
            tipo: 'SISTEMA',
          });
        } else if (esOperaciones) {
          await this.notificacionesService.create({
            usuarioId: u.id,
            titulo: '🛠️ Nuevo Proyecto Asignado',
            mensaje: `El Proyecto ${projectCode} ha sido generado exitosamente. Se ha designado a ${liderNombre.toUpperCase()} como Líder del Proyecto.`,
            tipo: 'SISTEMA',
          });
        }
      }
    } catch (err) {
      console.error(`[AutoGen] ❌ Error en auto-generación:`, err);
    }
  }

  // Genera código único para Proyecto (ej: HHT-OPE-26-005)
  private async generateProyectoCodigo(): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = `HHT-OPE-${year}-`;
    const count = await this.prisma.proyecto.count();
    let next = count + 1;
    let code = `${prefix}${next.toString().padStart(3, '0')}`;
    while (await this.prisma.proyecto.findUnique({ where: { codigo: code } })) {
      next++;
      code = `${prefix}${next.toString().padStart(3, '0')}`;
    }
    return code;
  }

  // Genera código único para Orden de Servicio (ej: OS-2026-001)
  private async generateOsCodigo(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `OS-${year}-`;
    const count = await this.prisma.ordenDeServicio.count();
    let next = count + 1;
    let code = `${prefix}${next.toString().padStart(3, '0')}`;
    while (await this.prisma.ordenDeServicio.findUnique({ where: { codigo: code } })) {
      next++;
      code = `${prefix}${next.toString().padStart(3, '0')}`;
    }
    return code;
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
      include: { 
        documentos: { select: { url: true } },
        hitosPago: true,
        facturas: true,
        ordenesDeServicio: true,
        revisiones: true
      },
    });

    if (!cotizacion) {
      throw new NotFoundException(`Cotización con ID "${id}" no encontrada.`);
    }

    if (
      cotizacion.facturas.length > 0 || 
      cotizacion.ordenesDeServicio.length > 0 || 
      cotizacion.proyectoGeneradoId ||
      cotizacion.revisiones.length > 0
    ) {
      const razones = [];
      if (cotizacion.facturas.length > 0) razones.push(`${cotizacion.facturas.length} factura(s)`);
      if (cotizacion.ordenesDeServicio.length > 0) razones.push(`${cotizacion.ordenesDeServicio.length} orden(es) de servicio`);
      if (cotizacion.proyectoGeneradoId) razones.push('1 proyecto generado');
      if (cotizacion.revisiones.length > 0) razones.push(`${cotizacion.revisiones.length} revisión(es) hija(s)`);

      throw new BadRequestException(`No se puede eliminar la cotización porque tiene registros vinculados: ${razones.join(', ')}.`);
    }

    const urlsToDelete = cotizacion.documentos.map((d) => d.url).filter(Boolean);

    // 1. Eliminar archivos físicos primero
    await deletePhysicalFiles(urlsToDelete);

    // 2. Proceder con la eliminación de registros en base de datos
    await this.prisma.$transaction(async (tx) => {
      await tx.hitoPago.deleteMany({ where: { cotizacionId: id } });
      await tx.documento.deleteMany({ where: { cotizacionId: id } });
      
      // Update interacciones just in case Prisma SetNull fails implicitly
      await tx.interaccion.updateMany({
        where: { cotizacionId: id },
        data: { cotizacionId: null }
      });

      await tx.cotizacion.delete({ where: { id } });
    });

    return { message: "Cotización eliminada exitosamente" };
  }

  private async generateCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `COT-${year}-`;
    
    const lastQuote = await this.prisma.cotizacion.findFirst({
      where: {
        codigo: {
          startsWith: prefix,
        },
      },
      orderBy: {
        codigo: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastQuote) {
      const lastNumber = parseInt(lastQuote.codigo.split('-')[2]);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
  }
}
