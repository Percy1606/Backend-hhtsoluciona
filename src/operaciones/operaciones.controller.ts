import { Controller, Get, Post, Body, Param, Put, Delete, HttpCode, HttpStatus, UsePipes, ValidationPipe, UseGuards } from '@nestjs/common';
import { OperacionesService } from './operaciones.service';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { CreateActividadDto } from './dto/create-actividad.dto';
import { UpdateActividadDto } from './dto/update-actividad.dto';
import type { Proyecto, Responsable } from '@prisma/client'; // Import Prisma types
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModulesGuard } from '../auth/modules.guard';
import { Modules } from '../auth/modules.decorator';

import { CreateComentarioDto } from './dto/create-comentario.dto';
import { CreateEvidenciaDto } from './dto/create-evidencia.dto';
import { CreateReporteDiarioDto } from './dto/create-reporte.dto';
import { CreateDocumentoDto } from './dto/create-documento.dto';

@Controller('operaciones')
@UseGuards(JwtAuthGuard, ModulesGuard)
export class OperacionesController {
  constructor(private readonly operacionesService: OperacionesService) {}

  // ... (previous methods)

  // ============================================
  // COMENTARIOS Y EVIDENCIAS
  // ============================================

  @Post('comentarios')
  @Modules('operaciones')
  async createComentario(@Body() dto: CreateComentarioDto) {
    return this.operacionesService.createComentario(dto);
  }

  @Post('evidencias')
  @Modules('operaciones')
  async createEvidencia(@Body() dto: CreateEvidenciaDto) {
    return this.operacionesService.createEvidencia(dto);
  }

  // ============================================
  // REPORTES DIARIOS
  // ============================================

  @Post('reportes')
  @Modules('operaciones')
  async createReporteDiario(@Body() dto: CreateReporteDiarioDto) {
    return this.operacionesService.createReporteDiario(dto);
  }

  // ============================================
  // DOCUMENTOS
  // ============================================

  @Post('documentos')
  @Modules('operaciones')
  async createDocumento(@Body() dto: CreateDocumentoDto) {
    return this.operacionesService.createDocumento(dto);
  }

  @Put('documentos/:id')
  @Modules('operaciones')
  async updateDocumento(@Param('id') id: string, @Body() dto: any) {
    return this.operacionesService.updateDocumento(id, dto);
  }

  @Delete('documentos/:id')
  @Modules('operaciones')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDocumento(@Param('id') id: string) {
    return this.operacionesService.removeDocumento(id);
  }

  // ============================================
  // SUBOPERACIONES Y ENTREGABLES
  // ============================================

  @Post('suboperaciones')
  @Modules('operaciones')
  async createSuboperacion(@Body() data: any) {
    return this.operacionesService.createSuboperacion(data);
  }

  @Post('entregables')
  @Modules('operaciones')
  async createEntregable(@Body() data: any) {
    return this.operacionesService.createEntregable(data);
  }

  // ============================================
  // ALCANCE TÉCNICO
  // ============================================

  @Post('proyectos/:id/evaluacion-tecnica')
  @Modules('operaciones')
  async createEvaluacionTecnica(@Param('id') id: string, @Body() dto: any) {
    return this.operacionesService.createEvaluacionTecnica(id, dto);
  }

  @Post('proyectos/:id/ingenieria-diseno')
  @Modules('operaciones')
  async createIngenieriaDiseno(@Param('id') id: string, @Body() dto: any) {
    return this.operacionesService.createIngenieriaDiseno(id, dto);
  }

  @Post('proyectos/:id/expediente-tecnico')
  @Modules('operaciones')
  async createExpedienteTecnico(@Param('id') id: string, @Body() dto: any) {
    return this.operacionesService.createExpedienteTecnico(id, dto);
  }

  // ... (rest of the controller)

  @Get('proyectos')
  @Modules('operaciones')
  async findAllProyectos(): Promise<Proyecto[]> {
    return this.operacionesService.findAllProyectos();
  }

  @Get('proyectos/:id')
  @Modules('operaciones')
  async findOneProyecto(@Param('id') id: string): Promise<Proyecto> {
    return this.operacionesService.findOneProyecto(id);
  }

  @Post('proyectos')
  @Modules('operaciones')
  @HttpCode(HttpStatus.CREATED)
  async createProyecto(@Body() createProyectoDto: CreateProyectoDto): Promise<Proyecto> {
    return this.operacionesService.createProyecto(createProyectoDto);
  }

  @Put('proyectos/:id')
  @Modules('operaciones')
  async updateProyecto(@Param('id') id: string, @Body() updateProyectoDto: UpdateProyectoDto): Promise<Proyecto> {
    return this.operacionesService.updateProyecto(id, updateProyectoDto);
  }

  @Delete('proyectos/:id')
  @Modules('operaciones')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeProyecto(@Param('id') id: string): Promise<void> {
    return this.operacionesService.removeProyecto(id);
  }

  // ============================================
  // ACTIVIDADES
  // ============================================

  @Post('actividades')
  @Modules('operaciones')
  async createActividad(@Body() createActividadDto: CreateActividadDto) {
    return this.operacionesService.createActividad(createActividadDto);
  }

  @Put('actividades/:id')
  @Modules('operaciones')
  async updateActividad(@Param('id') id: string, @Body() updateActividadDto: UpdateActividadDto) {
    return this.operacionesService.updateActividad(id, updateActividadDto);
  }

  @Delete('actividades/:id')
  @Modules('operaciones')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeActividad(@Param('id') id: string) {
    return this.operacionesService.removeActividad(id);
  }

  // ============================================
  // SUBTAREAS
  // ============================================

  @Post('subtareas')
  @Modules('operaciones')
  async createSubtarea(@Body() data: any) {
    return this.operacionesService.createSubtarea(data);
  }

  @Put('subtareas/:id')
  @Modules('operaciones')
  async updateSubtarea(@Param('id') id: string, @Body() data: any) {
    return this.operacionesService.updateSubtarea(id, data);
  }

  // ============================================
  // VALIDACIONES
  // ============================================

  @Put('validaciones/:id')
  @Modules('operaciones')
  async updateValidacion(@Param('id') id: string, @Body() data: any) {
    return this.operacionesService.updateValidacion(id, data);
  }

  @Get('responsables')
  async findAllResponsables(): Promise<Responsable[]> {
    return this.operacionesService.findAllResponsables();
  }

  @Post('responsables')
  async createResponsable(@Body() data: any): Promise<Responsable> {
    return this.operacionesService.createResponsable(data);
  }

  @Put('responsables/:id')
  async updateResponsable(@Param('id') id: string, @Body() data: any): Promise<Responsable> {
    return this.operacionesService.updateResponsable(id, data);
  }

  @Get('responsables/:id')
  async findOneResponsable(@Param('id') id: string): Promise<Responsable> {
    return this.operacionesService.findOneResponsable(id);
  }
}
