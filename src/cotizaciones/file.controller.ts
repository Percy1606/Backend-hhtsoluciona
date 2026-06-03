import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';
import * as fs from 'fs';

@Controller('files')
export class FileController {
  @Get('preview/:folder/:filename')
  async previewFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: express.Response,
  ) {
    const filePath = join(process.cwd(), 'uploads', folder, filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Archivo no encontrado');
    }

    const ext = filename.split('.').pop()?.toLowerCase();
    
    // Mapeo manual de tipos MIME para asegurar la previsualización
    const mimeTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'webp': 'image/webp',
      'gif': 'image/gif',
      'txt': 'text/plain'
    };

    const contentType = mimeTypes[ext || ''] || 'application/octet-stream';

    // LIMPIEZA TOTAL DE HEADERS PREVIOS
    res.removeHeader('Content-Disposition');
    res.removeHeader('Cache-Control');

    // HEADERS CRÍTICOS PARA PREVISUALIZACIÓN
    res.setHeader('Content-Type', contentType);
    
    if (['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext || '')) {
      res.setHeader('Content-Disposition', 'inline');
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    // Enviamos el archivo usando stream para mayor control
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
}
