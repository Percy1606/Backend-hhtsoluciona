import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
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
import { UpdateGastoDto } from './dto/update-gasto.dto';
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

  @Get('global-stats')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  getGlobalStats() {
    return this.finanzasService.getGlobalKPIs();
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

  @Get('executive-dashboard')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  getExecutiveDashboard() {
    return this.finanzasService.getExecutiveDashboard();
  }

  // ============================================
  // FACTURAS
  // ============================================

  @Get('facturas')
  @UseGuards(ModulesGuard)
  @Modules('finanzas', 'operaciones')
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
  createFactura(@Body() dto: CreateFacturaDto, @Req() req: any) {
    const usuarioId = req.user.id || req.user.sub || 'system';
    return this.finanzasService.createFactura(dto, usuarioId);
  }

  @Patch('facturas/:id')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  updateFactura(
    @Param('id') id: string,
    @Body() dto: UpdateFacturaDto,
    @Req() req: any,
  ) {
    const usuarioId = req.user.id || req.user.sub || 'system';
    return this.finanzasService.updateFactura(id, dto, usuarioId);
  }

  @Post('facturas/:id/secure-delete')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  async secureRemoveFactura(
    @Req() req: any,
    @Param('id') id: string,
    @Body('password') password: string,
  ) {
    const isValid = await this.authService.verifyAdminPassword(
      password,
      req.user.id,
    );
    if (!isValid)
      throw new BadRequestException(
        'La contraseña de administrador es incorrecta.',
      );
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
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('proveedorId') proveedorId?: string,
    @Query('proyectoId') proyectoId?: string,
    @Query('tipo') tipo?: string,
  ) {
    const filters: any = {};
    if (proveedorId) filters.proveedorId = proveedorId;
    if (proyectoId) filters.proyectoId = proyectoId;
    if (tipo) filters.tipo = tipo;
    return this.finanzasService.findAllGastos(
      parseInt(page),
      parseInt(limit),
      filters,
    );
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
  updateGasto(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateGastoDto,
  ) {
    const usuarioId = req.user.id || req.user.sub || 'system';
    return this.finanzasService.updateGasto(id, dto, usuarioId);
  }

  @Post('gastos/:id/secure-delete')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  async secureRemoveGasto(
    @Req() req: any,
    @Param('id') id: string,
    @Body('password') password: string,
  ) {
    const isValid = await this.authService.verifyAdminPassword(
      password,
      req.user.id,
    );
    if (!isValid)
      throw new BadRequestException(
        'La contraseña de administrador es incorrecta.',
      );
    return this.finanzasService.deleteGasto(id);
  }

  // ============================================
  // ADELANTOS
  // ============================================

  @Get('adelantos')
  @UseGuards(ModulesGuard)
  @Modules('finanzas', 'operaciones')
  findAllAdelantos(@Query('proyectoId') proyectoId?: string) {
    return this.finanzasService.findAllAdelantos(proyectoId);
  }

  @Post('adelantos')
  @UseGuards(ModulesGuard)
  @Modules('finanzas', 'operaciones')
  createAdelanto(@Req() req: any, @Body() dto: any) {
    const usuarioId = req.user.id || req.user.sub || 'system';
    return this.finanzasService.createAdelanto(dto, usuarioId);
  }

  // ============================================
  // RENTABILIDAD POR PROYECTO
  // ============================================

  @Get('proyectos/:id/rentabilidad')
  @UseGuards(ModulesGuard)
  @Modules('finanzas', 'operaciones')
  getProjectRentabilidad(@Param('id') id: string) {
    return this.finanzasService.getProjectProfitability(id);
  }

  @Get('proyectos/:id/distribucion')
  @UseGuards(ModulesGuard)
  @Modules('finanzas', 'operaciones')
  getProjectDistribution(@Param('id') id: string) {
    return this.finanzasService.getProjectDistribution(id);
  }

  // ============================================
  // CAJA
  // ============================================

  @Get('cajas')
  @UseGuards(ModulesGuard)
  @Modules('finanzas', 'operaciones')
  findAllCajas(@Req() req: any) {
    return this.finanzasService.findAllCajas(req.user);
  }

  @Post('cajas')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  createCaja(@Body() dto: any) {
    console.log('[Finanzas] Petición para crear caja:', dto.nombre);
    return this.finanzasService.createCaja(dto);
  }

  @Put('cajas/:id')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  updateCaja(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    const usuarioId = req.user.id || 'system';
    return this.finanzasService.updateCaja(id, dto, usuarioId);
  }

  @Post('cajas/:id/secure-delete')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  async secureRemoveCaja(
    @Req() req: any,
    @Param('id') id: string,
    @Body('password') password: string,
  ) {
    const isValid = await this.authService.verifyAdminPassword(
      password,
      req.user.id,
    );
    if (!isValid)
      throw new BadRequestException(
        'La contraseña de administrador es incorrecta.',
      );
    return this.finanzasService.deleteCaja(id);
  }

  @Post('cajas/transfer')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  async transferFunds(@Req() req: any, @Body() dto: any) {
    const usuarioId = req.user.id || 'system';
    return this.finanzasService.transferFunds(dto, usuarioId);
  }

  @Get('cajas/:id/transacciones')
  @UseGuards(ModulesGuard)
  @Modules('finanzas', 'operaciones')
  findCajaTransactions(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.finanzasService.findCajaTransactions(
      id,
      parseInt(page || '1'),
      parseInt(limit || '10'),
    );
  }

  @Post('transacciones/:id/secure-delete')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  async secureRemoveTransaction(
    @Req() req: any,
    @Param('id') id: string,
    @Body('password') password: string,
  ) {
    const isValid = await this.authService.verifyAdminPassword(
      password,
      req.user.id,
    );
    if (!isValid)
      throw new BadRequestException(
        'La contraseña de administrador es incorrecta.',
      );
    const usuarioId = req.user.id || 'system';
    return this.finanzasService.deleteTransaction(id, usuarioId);
  }

  @Post('cajas/ensure')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  ensureDefaultCaja() {
    return this.finanzasService.ensureDefaultCaja();
  }

  @Post('cajas/:id/block')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  async blockFunds(
    @Req() req: any,
    @Param('id') id: string,
    @Body('monto') monto: number,
    @Body('concepto') concepto: string,
  ) {
    const usuarioId = req.user.id || req.user.sub || 'system';
    return this.finanzasService.blockFunds(
      monto,
      concepto,
      'MANUAL',
      id,
      usuarioId,
      id,
    );
  }

  @Post('cajas/:id/release')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  async releaseFunds(
    @Req() req: any,
    @Param('id') id: string,
    @Body('monto') monto: number,
    @Body('concepto') concepto: string,
  ) {
    const usuarioId = req.user.id || req.user.sub || 'system';
    return this.finanzasService.releaseFunds(
      monto,
      concepto,
      'MANUAL',
      id,
      usuarioId,
      id,
    );
  }
}
