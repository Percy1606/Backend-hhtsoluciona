import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Res, HttpStatus, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CotizacionesService } from './cotizaciones.service';
import { CreateCotizacionDto } from './dto/create-cotizacion.dto';
import { UpdateCotizacionDto } from './dto/update-cotizacion.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModulesGuard } from '../auth/modules.guard';
import { Modules } from '../auth/modules.decorator';
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

@Controller('crm/cotizaciones')
@UseGuards(JwtAuthGuard, ModulesGuard)
export class CotizacionesController {
  constructor(private readonly cotizacionesService: CotizacionesService) {}

  @Post('upload')
  @Modules('crm')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/cotizaciones',
      filename: (req: any, file: any, cb: any) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  }))
  async uploadFile(@UploadedFile() file: any) {
    if (!file) throw new Error('Archivo no válido.');
    return {
      url: `/uploads/cotizaciones/${file.filename}`,
      nombre: file.originalname,
      tipo: file.mimetype,
      tamano: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
    };
  }

  @Get()
  @Modules('crm')
  findAll() {
    return this.cotizacionesService.findAll();
  }

  @Get(':id')
  @Modules('crm')
  findOne(@Param('id') id: string) {
    return this.cotizacionesService.findOne(id);
  }

  @Post()
  @Modules('crm')
  create(@Body() createCotizacionDto: CreateCotizacionDto) {
    return this.cotizacionesService.create(createCotizacionDto);
  }

  @Put(':id')
  @Modules('crm')
  update(@Param('id') id: string, @Body() updateCotizacionDto: UpdateCotizacionDto) {
    return this.cotizacionesService.update(id, updateCotizacionDto);
  }

  @Delete(':id')
  @Modules('crm')
  remove(@Param('id') id: string) {
    return this.cotizacionesService.remove(id);
  }

  @Get(':id/word')
  @Modules('crm')
  async generateWord(@Param('id') id: string, @Res() res: express.Response) {
    try {
      const quote = await this.cotizacionesService.findOne(id);
      
      if (!quote) {
        return res.status(HttpStatus.NOT_FOUND).json({ message: "Cotización no encontrada" });
      }

      // IMPORTANTE: Asegurar ruta absoluta correcta
      const templatePath = path.resolve(process.cwd(), '..', 'HH-FRONTEND', 'PROFORMA_COT-2026-001.docx');
      
      console.log(`[CRM] Intentando cargar plantilla desde: ${templatePath}`);

      if (!fs.existsSync(templatePath)) {
          console.error(`[CRM] ERROR: No se encontró el archivo en ${templatePath}`);
          return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
              message: "Plantilla no encontrada",
              path: templatePath 
          });
      }

      const content = fs.readFileSync(templatePath, 'binary');
      const zip = new PizZip(content);
      const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
      });

      const scope = typeof quote.alcance === 'string' ? JSON.parse(quote.alcance) : (quote.alcance || {});
      
      const renderData = {
          codigo: quote.codigo,
          fecha: new Date(quote.fecha).toLocaleDateString('es-PE'),
          empresa: quote.cliente?.empresa?.toUpperCase() || '—',
          ruc: quote.cliente?.ruc || '—',
          direccion: quote.cliente?.direccion?.toUpperCase() || '—',
          referencia: quote.referencia?.toUpperCase() || 'SERVICIO TÉCNICO ESPECIALIZADO',
          objetivo: quote.objetivo || 'Realizar los trabajos técnicos según requerimiento.',
          
          // Soporte para el nuevo alcance estructurado y el anterior de lista
          alcance_evaluacion: scope.evaluacion || '—',
          alcance_ingenieria: scope.ingenieria || '—',
          alcance_expediente: scope.expediente || '—',
          alcance_list: Array.isArray(scope) ? scope.map((item, index) => ({ text: `${index + 1}. ${item}` })) : [],
          
          consideraciones: quote.consideraciones || 'No se han especificado consideraciones adicionales.',
          entregables: quote.entregables || 'Informe técnico final.',
          monto: new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(quote.monto),
          plazo: quote.plazo || '12 días calendario',
          validez: quote.validez || '7 días calendario',
          forma_pago: quote.formaPago || '50% adelanto y 50% contra entrega.',
          año: new Date().getFullYear().toString(),
      };

      console.log(`[CRM] Generando Word para ${quote.codigo} con cliente ${renderData.empresa}`);

      doc.render(renderData);

      const buffer = doc.getZip().generate({
          type: 'nodebuffer',
          compression: 'DEFLATE',
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename=PROFORMA_${quote.codigo}.docx`);
      res.status(HttpStatus.OK).send(buffer);

    } catch (error) {
      console.error("[CRM] Error crítico al generar Word:", error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
        message: "Error al editar la plantilla de Word",
        error: error.message 
      });
    }
  }
}
