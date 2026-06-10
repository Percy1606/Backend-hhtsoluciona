import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FinanzasService } from './finanzas.service';
import { AuthService } from '../auth/auth.service';
import { CreateFacturaDto } from './dto/create-factura.dto';
import { CreatePagoDto } from './dto/create-pago.dto';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { UpdateFacturaDto } from './dto/update-factura.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModulesGuard } from '../auth/modules.guard';
import { Modules } from '../auth/modules.decorator';

@Controller('finanzas')
@UseGuards(JwtAuthGuard)
export class FinanzasController {
  constructor(
    private readonly finanzasService: FinanzasService,
    private readonly authService: AuthService,
  ) {}

  @Get('dashboard-stats')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  getStats(@Query('mes') mes?: string, @Query('anio') anio?: string) {
    const mesNum =
      mes && !isNaN(parseInt(mes, 10)) ? parseInt(mes, 10) : undefined;
    const anioNum =
      anio && !isNaN(parseInt(anio, 10)) ? parseInt(anio, 10) : undefined;
    return this.finanzasService.getDashboardStats(mesNum, anioNum);
  }

  @Get('cash-flow')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  getCashFlow(@Query('mes') mes?: string, @Query('anio') anio?: string) {
    const mesNum =
      mes && !isNaN(parseInt(mes, 10)) ? parseInt(mes, 10) : undefined;
    const anioNum =
      anio && !isNaN(parseInt(anio, 10)) ? parseInt(anio, 10) : undefined;
    return this.finanzasService.getCashFlowData(mesNum, anioNum);
  }

  // ============================================
  // FACTURAS
  // ============================================

  @Get('facturas')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  findAllFacturas(
    @Query('clienteId') clienteId?: string,
    @Query('proyectoId') proyectoId?: string,
    @Query('estado') estado?: string,
  ) {
    const filters: any = {};
    if (clienteId) filters.clienteId = clienteId;
    if (proyectoId) filters.proyectoId = proyectoId;
    if (estado) filters.estado = estado;

    return this.finanzasService.findAllFacturas(filters);
  }

  @Get('facturas/:id')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  findOneFactura(@Param('id') id: string) {
    return this.finanzasService.findOneFactura(id);
  }

  @Post('facturas')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  createFactura(@Body() dto: CreateFacturaDto) {
    return this.finanzasService.createFactura(dto);
  }

  @Patch('facturas/:id')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  updateFactura(@Param('id') id: string, @Body() dto: UpdateFacturaDto) {
    return this.finanzasService.updateFactura(id, dto);
  }

  @Post('facturas/:id/secure-delete')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  async secureRemoveFactura(
    @Req() req: any,
    @Param('id') id: string,
    @Body('password') password: string,
  ) {
    const isValid = await this.authService.verifyAdminPassword(password, req.user.id);
    if (!isValid) {
      throw new BadRequestException(
        'La contraseña de administrador es incorrecta.',
      );
    }
    return this.finanzasService.deleteFactura(id);
  }

  // ============================================
  // PAGOS
  // ============================================

  @Post('pagos')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  registerPago(@Req() req: any, @Body() dto: CreatePagoDto) {
    const usuarioId = req.user.id || req.user.sub || 'system';
    return this.finanzasService.registerPago(dto, usuarioId);
  }

  // ============================================
  // GASTOS
  // ============================================

  @Get('gastos')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  findAllGastos(
    @Query('proveedorId') proveedorId?: string,
    @Query('proyectoId') proyectoId?: string,
    @Query('tipo') tipo?: string,
  ) {
    const filters: any = {};
    if (proveedorId) filters.proveedorId = proveedorId;
    if (proyectoId) filters.proyectoId = proyectoId;
    if (tipo) filters.tipo = tipo;

    return this.finanzasService.findAllGastos(filters);
  }

  @Post('gastos')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  createGasto(@Req() req: any, @Body() dto: CreateGastoDto) {
    const usuarioId = req.user.id || req.user.sub || 'system';
    return this.finanzasService.createGasto(dto, usuarioId);
  }

  @Patch('gastos/:id')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  updateGasto(@Param('id') id: string, @Body() dto: any) {
    return this.finanzasService.updateGasto(id, dto);
  }

  @Post('gastos/:id/secure-delete')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  async secureRemoveGasto(
    @Req() req: any,
    @Param('id') id: string,
    @Body('password') password: string,
  ) {
    const isValid = await this.authService.verifyAdminPassword(password, req.user.id);
    if (!isValid) {
      throw new BadRequestException(
        'La contraseña de administrador es incorrecta.',
      );
    }
    return this.finanzasService.deleteGasto(id);
  }
}
