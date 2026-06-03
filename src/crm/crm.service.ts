import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { CreateInteraccionDto } from './dto/create-interaccion.dto';

@Injectable()
export class CrmService {
  constructor(private prisma: PrismaService) {}

  async findAllClientes() {
    return this.prisma.cliente.findMany({
      include: {
        interacciones: {
          orderBy: { fecha: 'desc' }
        },
        proyectos: true,
        documentos: true
      },
      orderBy: { fechaCreacion: 'desc' }
    });
  }

  async findOneCliente(id: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
      include: {
        interacciones: {
          orderBy: { fecha: 'desc' }
        },
        proyectos: true,
        documentos: true
      }
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente con ID "${id}" no encontrado.`);
    }
    return cliente;
  }

  async createCliente(dto: CreateClienteDto) {
    const codigo = dto.codigo || await this.generateClienteCode();
    
    return this.prisma.cliente.create({
      data: {
        ...dto,
        codigo,
        ultimoContacto: dto.ultimoContacto ? new Date(dto.ultimoContacto) : null,
        proximoSeguimiento: dto.proximoSeguimiento ? new Date(dto.proximoSeguimiento) : null,
        hallazgosTecnicos: dto.hallazgosTecnicos ? (typeof dto.hallazgosTecnicos === 'string' ? dto.hallazgosTecnicos : JSON.stringify(dto.hallazgosTecnicos)) : "[]",
        solucionesPropuestas: dto.solucionesPropuestas ? (typeof dto.solucionesPropuestas === 'string' ? dto.solucionesPropuestas : JSON.stringify(dto.solucionesPropuestas)) : "[]",
        montoEstimado: dto.montoEstimado || 0,
        probabilidad: dto.probabilidad || 0,
        ventaProyectada: dto.ventaProyectada || 0,
        temperatura: dto.temperatura || "Tibio",
      }
    });
  }

  async updateCliente(id: string, dto: UpdateClienteDto) {
    const data: any = { ...dto };
    if (dto.ultimoContacto) data.ultimoContacto = new Date(dto.ultimoContacto);
    if (dto.proximoSeguimiento) data.proximoSeguimiento = new Date(dto.proximoSeguimiento);
    
    if (dto.hallazgosTecnicos) {
        data.hallazgosTecnicos = typeof dto.hallazgosTecnicos === 'string' ? dto.hallazgosTecnicos : JSON.stringify(dto.hallazgosTecnicos);
    }
    if (dto.solucionesPropuestas) {
        data.solucionesPropuestas = typeof dto.solucionesPropuestas === 'string' ? dto.solucionesPropuestas : JSON.stringify(dto.solucionesPropuestas);
    }

    return this.prisma.cliente.update({
      where: { id },
      data
    });
  }

  async removeCliente(id: string) {
    return this.prisma.cliente.delete({ where: { id } });
  }

  // ============================================
  // INTERACCIONES
  // ============================================

  async createInteraccion(dto: CreateInteraccionDto) {
    return this.prisma.interaccion.create({
      data: {
        ...dto,
        fecha: dto.fecha ? new Date(dto.fecha) : new Date()
      }
    });
  }

  // ============================================
  // UTILS
  // ============================================

  private async generateClienteCode(): Promise<string> {
    const count = await this.prisma.cliente.count();
    return `HHT-CRM-${(count + 1).toString().padStart(3, '0')}`;
  }
}
