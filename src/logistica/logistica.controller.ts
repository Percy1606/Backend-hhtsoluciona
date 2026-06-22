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
} from '@nestjs/common';
import { LogisticaService } from './logistica.service';
import { CreateInsumoDto } from './dto/create-insumo.dto';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { CreateOrdenCompraDto } from './dto/create-orden-compra.dto';
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

  @Get('presupuesto/:proyectoId')
  async getPresupuestoProyecto(@Param('proyectoId') proyectoId: string) {
    return this.logisticaService.getPresupuestoProyecto(proyectoId);
  }
}
