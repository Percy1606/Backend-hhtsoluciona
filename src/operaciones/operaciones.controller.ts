import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { OperacionesService } from './operaciones.service';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { CreateActividadDto } from './dto/create-actividad.dto';
import { UpdateActividadDto } from './dto/update-actividad.dto';
import type { Proyecto, Responsable } from '@prisma/client'; // Import Prisma types
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModulesGuard } from '../auth/modules.guard';
import { Modules } from '../auth/modules.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthService } from '../auth/auth.service';

import { CreateComentarioDto } from './dto/create-comentario.dto';
import { CreateEvidenciaDto } from './dto/create-evidencia.dto';
import { CreateReporteDiarioDto } from './dto/create-reporte.dto';
import { CreateDocumentoDto } from './dto/create-documento.dto';

@Controller('operaciones')
@UseGuards(JwtAuthGuard)
export class OperacionesController {
  constructor(
    private readonly operacionesService: OperacionesService,
    private readonly authService: AuthService,
  ) {}

  @Get('ping')
  ping() {
    return { status: 'ok', message: 'OperacionesController is reachable' };
  }

  // ============================================
  // ACTIVIDADES
  // ============================================

  @Get('actividades')
  async findAllActividades(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
    @Query('estado') estado?: string,
    @Query('responsableId') responsableId?: string,
    @Query('proyectoId') proyectoId?: string,
  ) {
    return this.operacionesService.findAllActividades(
      parseInt(page),
      parseInt(limit),
      { search, estado, responsableId, proyectoId },
      req.user,
    );
  }

  @Post('actividades')
  // REMOVIDO @Modules('operaciones') para permitir a cualquier usuario crear
  async createActividad(
    @Req() req: any,
    @Body() createActividadDto: CreateActividadDto,
  ) {
    console.log(
      '[OperacionesController] POST /actividades recibido. Datos:',
      JSON.stringify(createActividadDto, null, 2),
    );
    return this.operacionesService.createActividad(
      createActividadDto,
      req.user,
    );
  }

  @Put('actividades/:id')
  async updateActividad(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateActividadDto: UpdateActividadDto,
  ) {
    return this.operacionesService.updateActividad(
      id,
      updateActividadDto,
      req.user,
    );
  }

  @Delete('actividades/:id')
  @UseGuards(ModulesGuard)
  @Modules('operaciones')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeActividad(@Param('id') id: string) {
    return this.operacionesService.removeActividad(id);
  }

  // ============================================
  // PROYECTOS
  // ============================================

  @Get('proyectos')
  async findAllProyectos(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
    @Query('estado') estado?: string,
    @Query('area') area?: string,
    @Query('responsablePrincipalId') responsablePrincipalId?: string,
  ): Promise<any> {
    return this.operacionesService.findAllProyectos(
      parseInt(page),
      parseInt(limit),
      { search, estado, area, responsablePrincipalId },
      req.user,
    );
  }

  @Get('proyectos/:id')
  async findOneProyecto(@Param('id') id: string): Promise<Proyecto> {
    return this.operacionesService.findOneProyecto(id);
  }

  @Get('proyectos/:id/costos')
  async getProjectCosts(@Param('id') id: string) {
    return this.operacionesService.getProjectCosts(id);
  }

  @Post('proyectos')
  @HttpCode(HttpStatus.CREATED)
  async createProyecto(
    @Req() req: any,
    @Body() createProyectoDto: CreateProyectoDto,
  ): Promise<Proyecto> {
    return this.operacionesService.createProyecto(createProyectoDto, req.user);
  }

  @Put('proyectos/:id')
  async updateProyecto(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateProyectoDto: UpdateProyectoDto,
  ): Promise<Proyecto> {
    return this.operacionesService.updateProyecto(
      id,
      updateProyectoDto,
      req.user,
    );
  }

  @Delete('proyectos/:id')
  @UseGuards(ModulesGuard)
  @Modules('operaciones')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeProyecto(@Param('id') id: string): Promise<void> {
    throw new BadRequestException(
      'La eliminación directa está deshabilitada por seguridad. Use el borrado seguro con contraseña.',
    );
  }

  @Post('proyectos/:id/secure-delete')
  @UseGuards(ModulesGuard)
  @Modules('operaciones')
  async secureRemoveProyecto(
    @Req() req: any,
    @Param('id') id: string,
    @Body('password') password: string,
  ) {
    const isValid = await this.authService.verifyAdminPassword(
      password,
      req.user.id,
    );
    if (!isValid) {
      throw new BadRequestException(
        'La contraseña de administrador es incorrecta.',
      );
    }
    return this.operacionesService.removeProyecto(id, req.user);
  }

  // ============================================
  // ARCHIVOS (SUBIDA REAL)
  // ============================================
  @Post('upload')
  @UseGuards(ModulesGuard)
  @Modules('operaciones')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req: any, file: any, cb: any) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
  )
  async uploadFile(@UploadedFile() file: any) {
    if (!file) {
      throw new Error(
        'No se pudo procesar el archivo. Verifique el tamaño (máx 10MB).',
      );
    }
    return {
      url: `/uploads/${file.filename}`,
      nombre: file.originalname,
      tipo: file.mimetype,
      tamano: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
    };
  }

  // ============================================
  // COMENTARIOS Y EVIDENCIAS
  // ============================================

  @Post('comentarios')
  async createComentario(@Body() dto: CreateComentarioDto) {
    return this.operacionesService.createComentario(dto);
  }

  @Post('evidencias')
  async createEvidencia(@Body() dto: CreateEvidenciaDto) {
    return this.operacionesService.createEvidencia(dto);
  }

  // ============================================
  // REPORTES DIARIOS
  // ============================================

  @Post('reportes')
  async createReporteDiario(@Body() dto: CreateReporteDiarioDto) {
    return this.operacionesService.createReporteDiario(dto);
  }

  // ============================================
  // DOCUMENTOS
  // ============================================

  @Post('documentos')
  async createDocumento(@Body() dto: CreateDocumentoDto) {
    return this.operacionesService.createDocumento(dto);
  }

  @Put('documentos/:id')
  async updateDocumento(@Param('id') id: string, @Body() dto: any) {
    return this.operacionesService.updateDocumento(id, dto);
  }

  @Delete('documentos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDocumento(@Param('id') id: string) {
    return this.operacionesService.removeDocumento(id);
  }

  // ============================================
  // SUBOPERACIONES Y ENTREGABLES
  // ============================================

  @Post('suboperaciones')
  async createSuboperacion(@Body() data: any) {
    return this.operacionesService.createSuboperacion(data);
  }

  @Post('entregables')
  async createEntregable(@Body() data: any) {
    return this.operacionesService.createEntregable(data);
  }

  // ============================================
  // ALCANCE TÉCNICO
  // ============================================

  @Post('proyectos/:id/evaluacion-tecnica')
  async createEvaluacionTecnica(@Param('id') id: string, @Body() dto: any) {
    return this.operacionesService.createEvaluacionTecnica(id, dto);
  }

  @Post('proyectos/:id/ingenieria-diseno')
  async createIngenieriaDiseno(@Param('id') id: string, @Body() dto: any) {
    return this.operacionesService.createIngenieriaDiseno(id, dto);
  }

  @Post('proyectos/:id/expediente-tecnico')
  async createExpedienteTecnico(@Param('id') id: string, @Body() dto: any) {
    return this.operacionesService.createExpedienteTecnico(id, dto);
  }

  // ============================================
  // SUBTAREAS
  // ============================================

  @Post('subtareas')
  async createSubtarea(@Body() data: any) {
    return this.operacionesService.createSubtarea(data);
  }

  @Put('subtareas/:id')
  async updateSubtarea(@Param('id') id: string, @Body() data: any) {
    return this.operacionesService.updateSubtarea(id, data);
  }

  // ============================================
  // VALIDACIONES
  // ============================================

  @Put('validaciones/:id')
  async updateValidacion(
    @Req() req: any,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.operacionesService.updateValidacion(id, data, req.user);
  }

  // ============================================
  // FICHAS TÉCNICAS
  // ============================================

  @Post('fichas-tecnicas/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/fichas-tecnicas',
        filename: (req: any, file: any, cb: any) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
    }),
  )
  async uploadFichaFile(@UploadedFile() file: any) {
    if (!file) throw new Error('Archivo no válido.');
    return {
      url: `/uploads/fichas-tecnicas/${file.filename}`,
      nombre: file.originalname,
      tipo: file.mimetype,
      tamano: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
    };
  }

  @Post('fichas-tecnicas')
  createFicha(@Req() req: any, @Body() dto: any) {
    return this.operacionesService.createFichaTecnica(dto, req.user);
  }

  @Get('fichas-tecnicas')
  findAllFichas(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('clienteId') clienteId?: string,
    @Query('tecnicoId') tecnicoId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    const filters: any = {};
    if (clienteId) filters.clienteId = clienteId;
    if (tecnicoId) filters.tecnicoId = tecnicoId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (search) filters.search = search;
    return this.operacionesService.findAllFichas(
      parseInt(page),
      parseInt(limit),
      filters,
      req.user,
    );
  }

  @Put('fichas-tecnicas/:id')
  updateFicha(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.operacionesService.updateFicha(id, dto, req.user);
  }

  @Post('fichas-tecnicas/:id/secure-delete')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async secureRemoveFicha(
    @Req() req: any,
    @Param('id') id: string,
    @Body('password') password: string,
  ) {
    // 1. Validar contraseña
    const isValid = await this.authService.validateUser(
      req.user.username,
      password,
    );
    if (!isValid) {
      throw new BadRequestException('Contraseña de administrador incorrecta.');
    }

    return this.operacionesService.removeFicha(id, req.user);
  }

  @Get('responsables')
  async findAllResponsables(): Promise<Responsable[]> {
    return this.operacionesService.findAllResponsables();
  }

  @Post('responsables')
  @UseGuards(ModulesGuard)
  @Modules('configuracion')
  async createResponsable(@Body() data: any): Promise<Responsable> {
    return this.operacionesService.createResponsable(data);
  }

  @Put('responsables/:id')
  @UseGuards(ModulesGuard)
  @Modules('configuracion')
  async updateResponsable(
    @Param('id') id: string,
    @Body() data: any,
  ): Promise<Responsable> {
    return this.operacionesService.updateResponsable(id, data);
  }

  @Get('responsables/:id')
  async findOneResponsable(@Param('id') id: string): Promise<Responsable> {
    return this.operacionesService.findOneResponsable(id);
  }

  // ============================================
  // TIMELINE / HISTORIAL
  // ============================================

  @Get('timeline')
  async getTimeline(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('proyectoId') proyectoId?: string,
    @Query('tipo') tipo?: string,
    @Query('search') search?: string,
  ) {
    return this.operacionesService.getTimelinePaginado(
      parseInt(page),
      parseInt(limit),
      { proyectoId, tipo, search },
    );
  }
}
