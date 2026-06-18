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

        // LÓGICA DE INTEGRACIÓN FINANCIERA (CAJA) - Se ejecuta si hay hitos COBRADOS
        let saldoYaIngresado = 0;
        if (result.cotizacionPadreId) {
          const chainIds = await this.getVersionChainIds(result.cotizacionPadreId);
          const [transacciones, facturas] = await Promise.all([
            tx.transaccionCaja.findMany({
              where: {
                referenciaTipo: 'COTIZACION',
                referenciaId: { in: chainIds }
              }
            }),
            tx.factura.findMany({
              where: { cotizacionId: { in: chainIds } },
              include: { pagos: true }
            })
          ]);

          for (const t of transacciones) {
            if (t.tipo === 'INGRESO') saldoYaIngresado += Number(t.monto);
            if (t.tipo === 'EGRESO') saldoYaIngresado -= Number(t.monto);
          }
          for (const f of facturas) {
            for (const p of f.pagos) {
              saldoYaIngresado += Number(p.monto);
            }
          }
        }

        const montoObjetivo = result.hitosPago
          .filter((h: any) => h.estado === 'COBRADO')
          .reduce((sum: number, h: any) => sum + Number(h.monto), 0);

        const diferencia = Number((montoObjetivo - saldoYaIngresado).toFixed(2));

        if (diferencia !== 0) {
          if (!cajaId) {
            throw new BadRequestException('Debe seleccionar una caja de destino para registrar el cobro de los hitos.');
          }

          const conceptoText = result.cotizacionPadreId 
            ? `Ajuste por Revisión: ${result.codigo} (Hereda de anterior) | Cliente: ${result.cliente?.empresa} | Diferencia: S/ ${diferencia}`
            : `Cobro Inicial Cotización: ${result.codigo} | Cliente: ${result.cliente?.empresa} | Monto Cobrado: S/ ${montoObjetivo}`;

          if (diferencia > 0) {
            await this.finanzasService.sincronizarSaldoIngreso(
              tx,
              diferencia,
              cajaId,
              conceptoText,
              'COTIZACION',
              result.id,
              'SISTEMA'
            );
          } else {
            await this.finanzasService.sincronizarSaldoEgreso(
              tx,
              Math.abs(diferencia),
              cajaId,
              conceptoText,
              'COTIZACION',
              result.id,
              'SISTEMA'
            );
          }
        }

        return result;
      });

      // TRIGGER AUTOMÁTICO: Mover a "Cotización Enviada"
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
      ...quoteData
    } = dto;

    // Preparar datos para la actualización de la cotización
    const updateData: any = {
      ...quoteData,
      fecha: fecha ? new Date(fecha) : undefined,
      alcance: alcance !== undefined ? alcance : undefined,
    };

    if (hitos) {
      updateData.hitosPago = {
        deleteMany: {},
        create: hitos.map((h: any) => ({
          descripcion: h.descripcion,
          porcentaje: Number(h.porcentaje),
          monto: Number(h.monto),
          fechaEstimada: h.fechaEstimada ? new Date(h.fechaEstimada) : null,
          estado: h.estado || 'PENDIENTE',
        })),
      };
    }

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

      // LÓGICA DE INTEGRACIÓN FINANCIERA (CAJA)
      // Solo se activa si la diferencia de dinero cobrado cambia
      
      // 1. Obtener historial de lo ya ingresado a caja por esta cotización y sus versiones anteriores
      const chainIds = await this.getVersionChainIds(result.id);
      
      const [transacciones, facturas] = await Promise.all([
        tx.transaccionCaja.findMany({
          where: {
            referenciaTipo: 'COTIZACION',
            referenciaId: { in: chainIds }
          }
        }),
        tx.factura.findMany({
          where: { cotizacionId: { in: chainIds } },
          include: { pagos: true }
        })
      ]);

      let saldoIngresado = 0;
      // Sumar transacciones directas de caja (adelantos sin factura)
      for (const t of transacciones) {
        if (t.tipo === 'INGRESO') saldoIngresado += Number(t.monto);
        if (t.tipo === 'EGRESO') saldoIngresado -= Number(t.monto);
      }

      // Sumar pagos recibidos por facturas vinculadas a esta cadena de cotizaciones
      for (const f of facturas) {
        for (const p of f.pagos) {
          saldoIngresado += Number(p.monto);
        }
      }

      // 2. Calcular el nuevo monto objetivo basado solo en hitos COBRADOS
      // NOTA: Ignoramos explícitamente 'REPORTE_PAGO' porque es un estado transitorio para validación de finanzas
      let montoObjetivo = 0;
      if (result.hitosPago && result.hitosPago.length > 0) {
        montoObjetivo = result.hitosPago
          .filter((h: any) => h.estado === 'COBRADO')
          .reduce((sum: number, h: any) => sum + Number(h.monto), 0);
      } else if (['Aprobado', 'Aprobada'].includes(result.estado)) {
        // Solo si NO hay hitos, la aprobación marca el monto total como cobrado (retrocompatibilidad)
        montoObjetivo = Number(result.monto);
      }

      const diferencia = Number((montoObjetivo - saldoIngresado).toFixed(2));

      if (diferencia !== 0) {
        if (!cajaId) {
          throw new BadRequestException('Se ha detectado un cambio en los hitos cobrados. Debe seleccionar una caja de destino para procesar el ingreso de dinero.');
        }

        const proyectoRelacionado = await tx.proyecto.findFirst({
          where: { cotizacionOrigen: { id: result.id } }
        });
        const nombreProyecto = proyectoRelacionado?.nombre || 'Preventa';
        const nombreCliente = result.cliente?.empresa || 'Cliente Desconocido';

        // Identificar si es un adelanto adicional para el concepto
        const esAdelantoAdicional = hitos?.some((h: any) => 
          h.estado === 'COBRADO' && 
          (h.descripcion.toLowerCase().includes('adelanto') || h.descripcion.toLowerCase().includes('adicional'))
        );

        const tipoMovimiento = esAdelantoAdicional ? 'Adelanto Adicional' : 'Ajuste Hitos';
        const signo = diferencia > 0 ? '+' : '-';
        const conceptoText = `${tipoMovimiento}: ${result.codigo} | Cliente: ${nombreCliente} | Proyecto: ${nombreProyecto} | Ajuste: ${signo}S/ ${Math.abs(diferencia)}`;

        if (diferencia > 0) {
          await this.finanzasService.sincronizarSaldoIngreso(
            tx,
            diferencia,
            cajaId,
            conceptoText,
            'COTIZACION',
            result.id,
            user?.id || 'SISTEMA'
          );
        } else {
          // Si el usuario reduce el monto cobrado (ej: desmarca un hito), se genera un egreso de ajuste
          await this.finanzasService.sincronizarSaldoEgreso(
            tx,
            Math.abs(diferencia),
            cajaId,
            conceptoText,
            'COTIZACION',
            result.id,
            user?.id || 'SISTEMA'
          );
        }
      }

      return result;
    });

    // TRIGGER: Notificación de Venta Cerrada y Actualización de Cliente
    if (['Aprobado', 'Aprobada'].includes(dto.estado) && !['Aprobado', 'Aprobada'].includes(oldQuote.estado)) {
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
