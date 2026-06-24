import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Patch,
  Delete,
  UseGuards,
  Req,
  Query,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { LogisticaService } from './logistica.service';
import { CreateInsumoDto } from './dto/create-insumo.dto';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { CreateOrdenCompraDto } from './dto/create-orden-compra.dto';
import { CreatePersonalDto, UpdatePersonalDto } from './dto/create-personal.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModulesGuard } from '../auth/modules.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Modules } from '../auth/modules.decorator';
import { Roles } from '../auth/roles.decorator';
import { AuthService } from '../auth/auth.service';
import { EstadoCompra } from '@prisma/client';

@Controller('logistica')
@UseGuards(JwtAuthGuard, ModulesGuard, RolesGuard)
@Modules('logistica')
export class LogisticaController {
  constructor(
    private readonly logisticaService: LogisticaService,
    private readonly authService: AuthService,
  ) {}

  // ============================================
  // BANDEJA LOGÍSTICA
  // ============================================
  @Get('bandeja-proyectos')
  async getBandejaProyectos() {
    return this.logisticaService.getProyectosPendientesLogistica();
  }

  // ============================================
  // PROVEEDORES
  // ============================================
  @Post('proveedores')
  createProveedor(@Body() dto: CreateProveedorDto) {
    return this.logisticaService.createProveedor(dto);
  }

  @Get('proveedores')
  @Modules('logistica', 'finanzas', 'operaciones')
  findAllProveedores() {
    return this.logisticaService.findAllProveedores();
  }

  // ============================================
  // INSUMOS / ALMACÉN
  // ============================================
  @Post('insumos')
  createInsumo(@Body() dto: CreateInsumoDto) {
    return this.logisticaService.createInsumo(dto);
  }

  @Get('insumos')
  findAllInsumos(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('categoria') categoria?: string,
    @Query('stockStatus') stockStatus?: string,
  ) {
    return this.logisticaService.findAllInsumos(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      search,
      categoria,
      stockStatus,
    );
  }

  @Get('insumos/:id')
  findInsumoById(@Param('id') id: string) {
    return this.logisticaService.findInsumoById(id);
  }

  @Put('insumos/:id')
  updateInsumo(@Param('id') id: string, @Body() dto: Partial<CreateInsumoDto>) {
    return this.logisticaService.updateInsumo(id, dto);
  }

  @Delete('insumos/:id')
  @Roles('ADMIN')
  removeInsumo(@Param('id') id: string) {
    return this.logisticaService.removeInsumo(id);
  }

  @Post('insumos/:id/secure-delete')
  @Roles('ADMIN')
  async secureRemoveInsumo(
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
    return this.logisticaService.removeInsumo(id);
  }

  // ============================================
  // ORDENES DE COMPRA
  // ============================================
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/logistica',
        filename: (req: any, file: any, cb: any) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    }),
  )
  async uploadFile(@UploadedFile() file: any) {
    if (!file) throw new Error('Archivo no válido.');
    return {
      url: `/uploads/logistica/${file.filename}`,
      nombre: file.originalname,
      tipo: file.mimetype,
      tamano: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
    };
  }

  @Post('ordenes')
  createOrdenCompra(@Body() dto: CreateOrdenCompraDto, @Req() req: any) {
    return this.logisticaService.createOrdenCompra(dto, req.user.id);
  }

  @Get('ordenes')
  findAllOrdenes(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('estado') estado?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.logisticaService.findAllOrdenes(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      search,
      estado,
      dateFrom,
      dateTo,
    );
  }

  // ============================================
  // KARDEX / MOVIMIENTOS
  // ============================================
  @Get('movimientos')
  findAllMovimientos(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('tipo') tipo?: any,
  ) {
    return this.logisticaService.findAllMovimientos(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      search,
      tipo,
    );
  }

  @Patch('ordenes/:id')
  updateOrdenCompra(@Param('id') id: string, @Body() dto: any) {
    return this.logisticaService.updateOrdenCompra(id, dto);
  }

  @Post('ordenes/:id/secure-delete')
  @Roles('ADMIN')
  async secureDeleteOrdenCompra(
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
    return this.logisticaService.deleteOrdenCompra(id);
  }

  @Put('ordenes/:id/estado')
  updateEstadoCompra(
    @Param('id') id: string,
    @Body('estado') estado: EstadoCompra,
    @Req() req: any,
  ) {
    return this.logisticaService.updateEstadoCompra(id, estado, req.user.id);
  }

  // ============================================
  // DESPACHOS
  // ============================================
  @Post('despacho')
  registrarDespacho(
    @Body()
    data: {
      insumoId: string;
      cantidad: number;
      proyectoId: string;
      motivo?: string;
    },
    @Req() req: any,
  ) {
    return this.logisticaService.registrarDespacho({
      ...data,
      usuarioId: req.user.id,
    });
  }

  @Get('proyecto/:id/movimientos')
  findMovimientosByProyecto(@Param('id') id: string) {
    return this.logisticaService.findMovimientosByProyecto(id);
  }

  // ============================================
  // PERSONAL DE OBRA
  // ============================================
  @Post('personal')
  createPersonal(@Body() dto: CreatePersonalDto, @Req() req: any) {
    return this.logisticaService.createPersonal(dto, req.user.id);
  }

  @Get('personal')
  findAllPersonal(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('proyectoId') proyectoId?: string,
    @Query('activo') activo?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.logisticaService.findAllPersonal(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
      proyectoId,
      activo,
      search,
      dateFrom,
      dateTo,
    );
  }

  @Get('personal/proyecto/:proyectoId')
  findPersonalByProyecto(@Param('proyectoId') proyectoId: string) {
    return this.logisticaService.findPersonalByProyecto(proyectoId);
  }

  @Put('personal/:id')
  updatePersonal(@Param('id') id: string, @Body() dto: UpdatePersonalDto) {
    return this.logisticaService.updatePersonal(id, dto);
  }

  @Delete('personal/:id')
  removePersonal(@Param('id') id: string) {
    return this.logisticaService.removePersonal(id);
  }

  // ============================================
  // COMPROMISO FINANCIERO DE MANO DE OBRA
  // ============================================

  @Post('personal/:id/comprometer')
  async generarCompromisoPersonal(
    @Param('id') id: string,
    @Body('diasTrabajo') diasTrabajo: number,
    @Body('cajaId') cajaId: string | undefined,
    @Req() req: any,
  ) {
    if (!diasTrabajo || diasTrabajo <= 0) {
      throw new BadRequestException('diasTrabajo debe ser mayor a cero');
    }
    return this.logisticaService.generarCompromisoPersonal(
      id,
      diasTrabajo,
      req.user.id,
      cajaId,
    );
  }

  @Post('personal/comprometer-proyecto/:proyectoId')
  async generarCompromisoPersonalPorProyecto(
    @Param('proyectoId') proyectoId: string,
    @Req() req: any,
  ) {
    return this.logisticaService.generarCompromisoPersonalPorProyecto(
      proyectoId,
      req.user.id,
    );
  }

  @Get('personal/costos/:proyectoId')
  getCostosPersonalProyecto(@Param('proyectoId') proyectoId: string) {
    return this.logisticaService.getCostosPersonalProyecto(proyectoId);
  }

  @Get('presupuesto/:proyectoId')
  async getPresupuestoProyecto(@Param('proyectoId') proyectoId: string) {
    return this.logisticaService.getPresupuestoProyecto(proyectoId);
  }
}
