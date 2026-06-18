import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Res,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Query,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CotizacionesService } from './cotizaciones.service';
import { CreateCotizacionDto } from './dto/create-cotizacion.dto';
import { UpdateCotizacionDto } from './dto/update-cotizacion.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModulesGuard } from '../auth/modules.guard';
import { Modules } from '../auth/modules.decorator';
import { AuthService } from '../auth/auth.service';
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

@Controller('crm/cotizaciones')
@UseGuards(JwtAuthGuard)
export class CotizacionesController {
  constructor(
    private readonly cotizacionesService: CotizacionesService,
    private readonly authService: AuthService,
  ) {}

  @Post('upload')
  @UseGuards(ModulesGuard)
  @Modules('crm')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/cotizaciones',
        filename: (req: any, file: any, cb: any) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
    }),
  )
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
  findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('clientId') clientId?: string,
    @Query('estado') estado?: string,
    @Query('search') search?: string,
  ) {
    return this.cotizacionesService.findAll(parseInt(page), parseInt(limit), {
      clientId,
      estado,
      search,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cotizacionesService.findOne(id);
  }

  @Post()
  @UseGuards(ModulesGuard)
  @Modules('crm')
  create(@Body() createCotizacionDto: CreateCotizacionDto) {
    return this.cotizacionesService.create(createCotizacionDto);
  }

  @Put(':id')
  @UseGuards(ModulesGuard)
  @Modules('crm')
  update(
    @Param('id') id: string,
    @Body() updateCotizacionDto: UpdateCotizacionDto,
    @Req() req: any,
  ) {
    return this.cotizacionesService.update(id, updateCotizacionDto, req.user);
  }

  @Delete(':id')
  @UseGuards(ModulesGuard)
  @Modules('crm')
  remove(@Param('id') id: string) {
    return this.cotizacionesService.remove(id);
  }

  @Get(':id/word')
  async generateWord(@Param('id') id: string, @Res() res: express.Response) {
    try {
      const quote = await this.cotizacionesService.findOne(id);

      if (!quote) {
        return res
          .status(HttpStatus.NOT_FOUND)
          .json({ message: 'Cotización no encontrada' });
      }

      const templatePath = path.resolve(
        process.cwd(),
        '..',
        'HH-FRONTEND',
        'PROFORMA_COT-2026-001.docx',
      );

      if (!fs.existsSync(templatePath)) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          message: 'Plantilla no encontrada',
        });
      }

      const content = fs.readFileSync(templatePath, 'binary');
      const zip = new PizZip(content);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      const scope =
        typeof quote.alcance === 'string'
          ? JSON.parse(quote.alcance)
          : quote.alcance || {};

      const renderData = {
        codigo: quote.codigo,
        fecha: new Date(quote.fecha).toLocaleDateString('es-PE'),
        empresa: quote.cliente?.empresa?.toUpperCase() || '—',
        ruc: quote.cliente?.ruc || '—',
        direccion: quote.cliente?.direccion?.toUpperCase() || '—',
        referencia:
          quote.referencia?.toUpperCase() || 'SERVICIO TÉCNICO ESPECIALIZADO',
        objetivo:
          quote.objetivo ||
          'Realizar los trabajos técnicos según requerimiento.',
        alcance_evaluacion: scope.evaluacion || '—',
        alcance_ingenieria: scope.ingenieria || '—',
        alcance_expediente: scope.expediente || '—',
        alcance_list: Array.isArray(scope)
          ? scope.map((item, index) => ({ text: `${index + 1}. ${item}` }))
          : [],
        consideraciones:
          quote.consideraciones ||
          'No se han especificado consideraciones adicionales.',
        entregables: quote.entregables || 'Informe técnico final.',
        monto: new Intl.NumberFormat('es-PE', {
          style: 'currency',
          currency: 'PEN',
        }).format(Number(quote.monto || 0)),
        plazo: quote.plazo || '12 días calendario',
        validez: quote.validez || '7 días calendario',
        forma_pago: quote.formaPago || '50% adelanto y 50% contra entrega.',
        año: new Date().getFullYear().toString(),
      };

      doc.render(renderData);

      const buffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=PROFORMA_${quote.codigo}.docx`,
      );
      res.status(HttpStatus.OK).send(buffer);
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Error al generar Word',
        error: error.message,
      });
    }
  }
}
