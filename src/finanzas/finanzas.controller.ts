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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import { FinanzasService } from './finanzas.service';
import { CashFlowService } from './cash-flow.service';
import { AuthService } from '../auth/auth.service';
import { CreateFacturaDto } from './dto/create-factura.dto';
import { CreatePagoDto } from './dto/create-pago.dto';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { CreateRendicionDto } from './dto/create-rendicion.dto';
import { UpdateGastoDto } from './dto/update-gasto.dto';
import { UpdateFacturaDto } from './dto/update-factura.dto';
import { CreateConfigAprobacionDto } from './dto/create-config-aprobacion.dto';
import { SubmitAprobacionDto } from './dto/submit-aprobacion.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModulesGuard } from '../auth/modules.guard';
import { Modules } from '../auth/modules.decorator';

@Controller('finanzas')
@UseGuards(JwtAuthGuard)
export class FinanzasController {
  constructor(
    private readonly finanzasService: FinanzasService,
    private readonly cashFlowService: CashFlowService,
    private readonly authService: AuthService,
  ) {}

  @Get('forecast')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  getForecast() {
    return this.cashFlowService.getForecast();
  }

  @Get('aging')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  getAging() {
    return this.cashFlowService.getAgingReport();
  }

  // ============================================
  // APROBACIONES
  // ============================================

  @Get('aprobaciones/pendientes')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  findPendingApprovals(@Req() req: any) {
    const usuarioId = req.user.id || 'system';
    return this.finanzasService.findPendingApprovals(usuarioId);
  }

  @Post('gastos/:id/aprobar-config')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  submitApproval(
    @Param('id') id: string,
    @Body() dto: SubmitAprobacionDto,
    @Req() req: any,
  ) {
    const usuarioId = req.user.id || 'system';
    return this.finanzasService.submitAprobacionGasto(id, usuarioId, dto);
  }

  @Post('configuraciones/aprobacion')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  createConfigAprobacion(@Body() dto: CreateConfigAprobacionDto) {
    return this.finanzasService.createConfigAprobacion(dto);
  }

  @Get('configuraciones/aprobacion')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  findAllConfigsAprobacion() {
    return this.finanzasService.findAllConfigsAprobacion();
  }

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
  @Modules('finanzas', 'operaciones')
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
  @Modules('finanzas', 'operaciones')
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

  @Post('gastos/:id/aprobar')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  approveGasto(@Req() req: any, @Param('id') id: string) {
    const usuarioId = req.user.id || req.user.sub || 'system';
    return this.finanzasService.approveGasto(id, usuarioId);
  }

  // ============================================
  // RENDICIONES
  // ============================================

  @Get('gastos/:id/rendiciones')
  @UseGuards(ModulesGuard)
  @Modules('finanzas', 'operaciones', 'logistica')
  findRendicionesByGasto(@Param('id') id: string) {
    return this.finanzasService.findRendicionesByGasto(id);
  }

  @Post('rendiciones')
  @UseGuards(ModulesGuard)
  @Modules('finanzas', 'operaciones', 'logistica')
  createRendicion(@Req() req: any, @Body() dto: CreateRendicionDto) {
    const usuarioId = req.user.id || req.user.sub || 'system';
    return this.finanzasService.createRendicion(dto, usuarioId);
  }

  @Post('rendiciones/:id/secure-delete')
  @UseGuards(ModulesGuard)
  @Modules('finanzas', 'operaciones')
  async secureRemoveRendicion(
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
    return this.finanzasService.secureDeleteRendicion(id);
  }

  @Post('pagos/:id/secure-delete')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  async secureRemovePago(
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
    return this.finanzasService.secureDeletePago(id);
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

  // ============================================
  // BANDEJA FINANZAS (Fase 3)
  // ============================================

  @Get('bandeja-proyectos')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  getProyectosPendientesFinanzas() {
    return this.finanzasService.getProyectosPendientesFinanzas();
  }

  @Patch('bandeja-proyectos/:id')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  updateEstadoFinanciero(
    @Param('id') id: string,
    @Body('estadoFinanciero') estadoFinanciero: string,
    @Body('autorizaCompras') autorizaCompras: boolean,
  ) {
    return this.finanzasService.updateEstadoFinanciero(
      id,
      estadoFinanciero,
      autorizaCompras ?? false,
    );
  }

  @Get('bandeja-proyectos/:id/detalle')
  @UseGuards(ModulesGuard)
  @Modules('finanzas', 'operaciones')
  getProyectoFinanzasDetalle(@Param('id') id: string) {
    return this.finanzasService.getProyectoFinanzasDetalle(id);
  }

  @Post('bandeja-proyectos/:id/facturar')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  crearFacturaDesdeBandeja(
    @Param('id') id: string,
    @Body() dto: { hitoId?: string; monto: number; descripcion: string; fechaVencimiento: string },
    @Req() req: any,
  ) {
    const usuarioId = req.user?.id || 'SISTEMA';
    return this.finanzasService.crearFacturaDesdeBandeja(id, dto, usuarioId);
  }

  @Post('bandeja-proyectos/:id/pagar')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  registrarPagoBandeja(
    @Param('id') id: string,
    @Body() dto: { facturaId: string; cajaId: string; monto: number; referencia: string; comprobanteUrl?: string },
    @Req() req: any,
  ) {
    const usuarioId = req.user?.id || 'SISTEMA';
    return this.finanzasService.registrarPagoBandeja(id, dto, usuarioId);
  }

  @Post('bandeja-proyectos/:id/documentos')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/finanzas',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname);
          cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  async uploadDocumentoBandeja(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body('tipo') tipo: string,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('No se adjuntó ningún archivo.');
    const usuarioId = req.user?.id || 'SISTEMA';
    const subidoPor = req.user?.nombre || 'Finanzas';
    const url = `/uploads/finanzas/${file.filename}`;
    
    return this.finanzasService.adjuntarDocumentoBandeja(id, {
      nombre: file.originalname,
      url,
      tipo: tipo || 'Voucher',
      tamano: `${(file.size / 1024).toFixed(2)} KB`,
      subidoPor,
    });
  }

  @Delete('bandeja-proyectos/:id/documentos/:documentoId')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  async eliminarDocumentoBandeja(
    @Param('id') id: string,
    @Param('documentoId') documentoId: string,
  ) {
    return this.finanzasService.eliminarDocumentoBandeja(id, documentoId);
  }

  @Post('bandeja-proyectos/:id/hitos')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  crearHitoBandeja(
    @Param('id') id: string,
    @Body() dto: { monto: number; descripcion: string },
  ) {
    return this.finanzasService.crearHitoBandeja(id, dto);
  }

  @Patch('bandeja-proyectos/:id/hitos/:hitoId')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  actualizarHitoBandeja(
    @Param('id') id: string,
    @Param('hitoId') hitoId: string,
    @Body() dto: { monto: number; descripcion: string },
  ) {
    return this.finanzasService.actualizarHitoBandeja(id, hitoId, dto);
  }

  @Delete('bandeja-proyectos/:id/hitos/:hitoId')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  eliminarHitoBandeja(
    @Param('id') id: string,
    @Param('hitoId') hitoId: string,
  ) {
    return this.finanzasService.eliminarHitoBandeja(id, hitoId);
  }

  @Patch('bandeja-proyectos/:id/venta-contratada')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  actualizarVentaContratada(
    @Param('id') id: string,
    @Body('monto') monto: number,
  ) {
    return this.finanzasService.actualizarVentaContratada(id, monto);
  }

  @Patch('bandeja-proyectos/:id/costo-presupuestado')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  actualizarCostoPresupuestado(
    @Param('id') id: string,
    @Body('monto') monto: number,
  ) {
    return this.finanzasService.actualizarCostoPresupuestado(id, monto);
  }

  @Post('bandeja-proyectos/:id/inyeccion-presupuesto')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  inyectarPresupuestoMateriales(
    @Param('id') id: string,
    @Body('monto') monto: number,
    @Body('motivo') motivo: string,
    @Req() req: any,
  ) {
    const usuario = req.user?.nombre || req.user?.email || 'Sistema';
    return this.finanzasService.inyectarPresupuestoMateriales(id, monto, motivo, usuario);
  }

  @Get('bandeja-proyectos/:id/inyecciones-presupuesto')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  getHistorialPresupuesto(
    @Param('id') id: string,
  ) {
    return this.finanzasService.getHistorialPresupuesto(id);
  }

  @Delete('bandeja-proyectos/:id/inyecciones-presupuesto/:inyeccionId')
  @UseGuards(ModulesGuard)
  @Modules('finanzas')
  eliminarInyeccionPresupuesto(
    @Param('id') id: string,
    @Param('inyeccionId') inyeccionId: string,
  ) {
    return this.finanzasService.eliminarInyeccionPresupuesto(id, inyeccionId);
  }
}
