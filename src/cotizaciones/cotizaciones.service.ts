import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCotizacionDto } from './dto/create-cotizacion.dto';
import { UpdateCotizacionDto } from './dto/update-cotizacion.dto';

@Injectable()
export class CotizacionesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.cotizacion.findMany({
      include: {
        cliente: true,
        documentos: true,
        interacciones: true,
        proyectoGenerado: true
      },
      orderBy: { fechaCreacion: 'desc' }
    });
  }

  async findOne(id: string) {
    const cotizacion = await this.prisma.cotizacion.findUnique({
      where: { id },
      include: {
        cliente: true,
        documentos: true,
        interacciones: true,
        proyectoGenerado: true
      }
    });
    if (!cotizacion) {
      throw new NotFoundException(`Cotización con ID "${id}" no encontrada.`);
    }
    return cotizacion;
  }

  async create(dto: CreateCotizacionDto) {
    const { fileUrl, fileName, fileType, ...quoteData } = dto;
    const codigo = await this.generateCode();
    
    return this.prisma.$transaction(async (tx) => {
      const cotizacion = await tx.cotizacion.create({
        data: {
          ...quoteData,
          codigo,
          fecha: quoteData.fecha ? new Date(quoteData.fecha) : new Date(),
          alcance: quoteData.alcance ? (typeof quoteData.alcance === 'string' ? quoteData.alcance : JSON.stringify(quoteData.alcance)) : "[]",
          version: quoteData.version || 1,
          cotizacionPadreId: quoteData.cotizacionPadreId || null,
        }
      });

      if (fileUrl) {
        await tx.documento.create({
          data: {
            cotizacionId: cotizacion.id,
            clientId: cotizacion.clientId,
            nombre: fileName || `Propuesta ${cotizacion.codigo}`,
            url: fileUrl,
            tipo: 'Tecnica',
            subtype: 'Cotizacion',
            version: '1',
            estado: 'Aprobado',
            subidoPor: 'Sistema CRM',
          }
        });
      }

      return cotizacion;
    });
  }

  async update(id: string, dto: UpdateCotizacionDto) {
    const { fileUrl, fileName, fileType, ...quoteData } = dto as any;
    const data: any = { ...quoteData };
    if (quoteData.fecha) data.fecha = new Date(quoteData.fecha);
    if (quoteData.alcance) data.alcance = typeof quoteData.alcance === 'string' ? quoteData.alcance : JSON.stringify(quoteData.alcance);

    return this.prisma.$transaction(async (tx) => {
      const cotizacion = await tx.cotizacion.update({
        where: { id },
        data,
        include: { 
          cliente: true,
          documentos: true,
          interacciones: true,
          proyectoGenerado: true
        }
      });

      if (fileUrl) {
        // Obtenemos la última versión de los documentos de esta cotización
        const lastDoc = await tx.documento.findFirst({
          where: { cotizacionId: id },
          orderBy: { version: 'desc' }
        });

        const nextVersion = lastDoc ? (parseInt(lastDoc.version || '1') + 1).toString() : '1';

        await tx.documento.create({
          data: {
            cotizacionId: cotizacion.id,
            clientId: cotizacion.clientId,
            nombre: fileName || `Propuesta ${cotizacion.codigo} v${nextVersion}`,
            url: fileUrl,
            tipo: 'Tecnica',
            subtype: 'Cotizacion',
            version: nextVersion,
            estado: 'Aprobado',
            subidoPor: 'Sistema CRM',
          }
        });

        // Actualizamos la versión en la cotización
        await tx.cotizacion.update({
          where: { id },
          data: { version: parseInt(nextVersion) }
        });
      }

      return cotizacion;
    });
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
