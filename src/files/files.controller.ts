import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  UseGuards,
  Req,
} from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';

@Controller()
export class FilesController {
  constructor(private jwtService: JwtService) {}

  // Ruta estándar usada por el sistema para visualización directa
  @Get('uploads/:folder/:filename')
  async getFile(
    @Req() req: any,
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: express.Response,
  ) {
    await this.validateAccess(req);
    return this.serveFile(folder, filename, res);
  }

  // Compatibilidad con la ruta antigua de previsualización de cotizaciones
  @Get('files/preview/:folder/:filename')
  async previewFile(
    @Req() req: any,
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: express.Response,
  ) {
    await this.validateAccess(req);
    return this.serveFile(folder, filename, res);
  }

  // Soporte para archivos en la raíz de uploads
  @Get('uploads/:filename')
  async getRootFile(
    @Req() req: any,
    @Param('filename') filename: string,
    @Res() res: express.Response,
  ) {
    await this.validateAccess(req);
    const filePath = join(process.cwd(), 'uploads', filename);
    if (!fs.existsSync(filePath))
      throw new NotFoundException('Archivo no encontrado');

    res.setHeader('Content-Disposition', 'inline');
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  private async validateAccess(req: any) {
    // 1. Intentar obtener token de la cabecera (standard JWT)
    let token = req.headers.authorization?.split(' ')[1];

    // 2. Si no hay cabecera, intentar obtener de la query string (para img src y a href)
    if (!token && req.query.token) {
      token = req.query.token;
    }

    if (!token)
      throw new NotFoundException('No autorizado para ver este archivo');

    try {
      await this.jwtService.verifyAsync(token);
    } catch (e) {
      throw new NotFoundException('Sesión inválida o expirada');
    }
  }

  private async serveFile(
    folder: string,
    filename: string,
    res: express.Response,
  ) {
    const filePath = join(process.cwd(), 'uploads', folder, filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Archivo no encontrado');
    }

    const ext = filename.split('.').pop()?.toLowerCase();

    // Mapeo manual de tipos MIME
    const mimeTypes: { [key: string]: string } = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
      txt: 'text/plain',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
    };

    const contentType = mimeTypes[ext || ''] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    if (['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext || '')) {
      res.setHeader('Content-Disposition', 'inline');
    } else {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
    }

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
}
