import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import * as fs from 'fs';
import * as path from 'path';

export interface ManualVideo {
  id: string;
  titulo: string;
  descripcion?: string;
  moduloId: string;
  driveUrl: string;
  driveEmbedUrl: string;
  orden?: number;
  duracion?: string;
  fechaCreacion: string;
}

export interface ManualModulo {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
}

const MODULOS_DEFAULT: ManualModulo[] = [
  { id: 'comercial', nombre: 'CRM y Ventas', descripcion: 'Gestión de clientes, cotizaciones y oportunidades', icono: 'Users' },
  { id: 'operaciones', nombre: 'Operaciones y Proyectos', descripcion: 'Planificación, tareas, cronograma y validaciones', icono: 'Briefcase' },
  { id: 'logistica', nombre: 'Logística y Almacén', descripcion: 'Inventario, insumos, órdenes de compra y kardex', icono: 'Truck' },
  { id: 'finanzas', nombre: 'Finanzas e Ingresos', descripcion: 'Caja chica, gastos, facturación y cobranzas', icono: 'BarChart3' },
  { id: 'configuracion', nombre: 'Configuración y Usuarios', descripcion: 'Gestión de accesos, trabajadores y parámetros', icono: 'Settings' },
];

@Controller('config/manuales')
@UseGuards(JwtAuthGuard)
export class ManualesController {
  private dataDir = path.join(process.cwd(), 'uploads', 'data');
  private dataFile = path.join(this.dataDir, 'manuales_videos.json');

  constructor() {
    this.ensureDataFileExists();
  }

  private ensureDataFileExists() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      if (!fs.existsSync(this.dataFile)) {
        const initialData: { modulos: ManualModulo[]; videos: ManualVideo[] } = {
          modulos: MODULOS_DEFAULT,
          videos: [],
        };
        fs.writeFileSync(this.dataFile, JSON.stringify(initialData, null, 2), 'utf-8');
      }
    } catch (e) {
      console.error('[Manuales] Error initializing data file:', e);
    }
  }

  private readData(): { modulos: ManualModulo[]; videos: ManualVideo[] } {
    this.ensureDataFileExists();
    try {
      const content = fs.readFileSync(this.dataFile, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        modulos: parsed.modulos?.length ? parsed.modulos : MODULOS_DEFAULT,
        videos: parsed.videos || [],
      };
    } catch (error) {
      console.error('[Manuales] Error reading data:', error);
      return { modulos: MODULOS_DEFAULT, videos: [] };
    }
  }

  private writeData(data: { modulos: ManualModulo[]; videos: ManualVideo[] }) {
    this.ensureDataFileExists();
    fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  private convertToEmbedUrl(url: string): string {
    if (!url) return '';
    let clean = url.trim();

    if (clean.includes('drive.google.com') && clean.includes('/preview')) {
      return clean;
    }

    const driveMatch = clean.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }

    const driveIdMatch = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (driveIdMatch && driveIdMatch[1]) {
      return `https://drive.google.com/file/d/${driveIdMatch[1]}/preview`;
    }

    const ytMatch = clean.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (ytMatch && ytMatch[1]) {
      return `https://www.youtube.com/embed/${ytMatch[1]}`;
    }

    return clean;
  }

  @Get()
  getAll() {
    return this.readData();
  }

  @Post('video')
  createVideo(
    @Body() body: { titulo: string; descripcion?: string; moduloId: string; driveUrl: string; duracion?: string },
  ) {
    if (!body.titulo || !body.moduloId || !body.driveUrl) {
      throw new BadRequestException('Título, módulo y URL de Drive son obligatorios');
    }

    const data = this.readData();
    const embedUrl = this.convertToEmbedUrl(body.driveUrl);

    const newVideo: ManualVideo = {
      id: `vid_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      titulo: body.titulo.trim(),
      descripcion: body.descripcion?.trim() || '',
      moduloId: body.moduloId,
      driveUrl: body.driveUrl.trim(),
      driveEmbedUrl: embedUrl,
      duracion: body.duracion?.trim() || '',
      orden: data.videos.filter((v) => v.moduloId === body.moduloId).length + 1,
      fechaCreacion: new Date().toISOString(),
    };

    data.videos.push(newVideo);
    this.writeData(data);
    return newVideo;
  }

  @Put('video/:id')
  updateVideo(
    @Param('id') id: string,
    @Body() body: { titulo?: string; descripcion?: string; moduloId?: string; driveUrl?: string; duracion?: string; orden?: number },
  ) {
    const data = this.readData();
    const index = data.videos.findIndex((v) => v.id === id);
    if (index === -1) {
      throw new NotFoundException(`Video con ID ${id} no encontrado`);
    }

    const current = data.videos[index];
    const updatedDriveUrl = body.driveUrl !== undefined ? body.driveUrl.trim() : current.driveUrl;

    data.videos[index] = {
      ...current,
      titulo: body.titulo !== undefined ? body.titulo.trim() : current.titulo,
      descripcion: body.descripcion !== undefined ? body.descripcion.trim() : current.descripcion,
      moduloId: body.moduloId !== undefined ? body.moduloId : current.moduloId,
      driveUrl: updatedDriveUrl,
      driveEmbedUrl: body.driveUrl !== undefined ? this.convertToEmbedUrl(body.driveUrl) : current.driveEmbedUrl,
      duracion: body.duracion !== undefined ? body.duracion.trim() : current.duracion,
      orden: body.orden !== undefined ? body.orden : current.orden,
    };

    this.writeData(data);
    return data.videos[index];
  }

  @Delete('video/:id')
  deleteVideo(@Param('id') id: string) {
    const data = this.readData();
    const initialCount = data.videos.length;
    data.videos = data.videos.filter((v) => v.id !== id);

    if (data.videos.length === initialCount) {
      throw new NotFoundException(`Video con ID ${id} no encontrado`);
    }

    this.writeData(data);
    return { success: true, message: 'Video eliminado con éxito' };
  }
}
