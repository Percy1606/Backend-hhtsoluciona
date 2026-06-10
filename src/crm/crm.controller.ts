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
  Query,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { CrmService } from './crm.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { CreateInteraccionDto } from './dto/create-interaccion.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModulesGuard } from '../auth/modules.guard';
import { Modules } from '../auth/modules.decorator';
import { AuthService } from '../auth/auth.service';

@Controller('crm')
@UseGuards(JwtAuthGuard)
export class CrmController {
  constructor(
    private readonly crmService: CrmService,
    private readonly authService: AuthService,
  ) {}

  @Get('clientes')
  findAll(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
    @Query('tarifa') tarifa?: string,
    @Query('zona') zona?: string,
    @Query('asignadoA') asignadoA?: string,
    @Query('clasificacion') clasificacion?: string,
    @Query('estado') estado?: string,
  ) {
    return this.crmService.findAllClientes(
      +page,
      +limit,
      {
        search,
        tarifa,
        zona,
        asignadoA,
        clasificacion,
        estado,
      },
      req.user,
    );
  }

  @Get('zonas')
  findZones() {
    return this.crmService.findDistinctZones();
  }

  @Get('clientes/:id')
  findOne(@Param('id') id: string) {
    return this.crmService.findOneCliente(id);
  }

  // RUTAS ESPECÍFICAS PRIMERO
  @Post('clientes/bulk')
  @UseGuards(ModulesGuard)
  @Modules('crm')
  async createBulk(@Req() req: any, @Body() clients: CreateClienteDto[]) {
    const results = [];
    for (const client of clients) {
      try {
        const res = await this.crmService.createCliente(client, req.user);
        results.push(res);
      } catch (e) {
        console.error(
          `[CRM] Error in bulk creation for ${client.empresa}:`,
          e.message,
        );
      }
    }
    return { count: results.length, data: results };
  }

  @Post('clientes/:id/secure-delete')
  @UseGuards(ModulesGuard)
  @Modules('crm')
  async secureRemove(
    @Req() req: any,
    @Param('id') id: string,
    @Body('password') password: string,
  ) {
    console.log(`[CRM] Intento de eliminación segura para cliente: ${id}`);
    const isValid = await this.authService.verifyAdminPassword(password, req.user.id);
    if (!isValid) {
      throw new BadRequestException(
        'La contraseña de administrador es incorrecta.',
      );
    }
    return this.crmService.removeCliente(id, req.user);
  }

  @Post('clientes')
  @UseGuards(ModulesGuard)
  @Modules('crm')
  create(@Req() req: any, @Body() createClienteDto: CreateClienteDto) {
    return this.crmService.createCliente(createClienteDto, req.user);
  }

  @Put('clientes/:id')
  @UseGuards(ModulesGuard)
  @Modules('crm')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateClienteDto: UpdateClienteDto,
  ) {
    return this.crmService.updateCliente(id, updateClienteDto, req.user);
  }

  @Delete('clientes/:id')
  @UseGuards(ModulesGuard)
  @Modules('crm')
  remove(@Req() req: any, @Param('id') id: string) {
    // DESHABILITADO: Se requiere usar /secure-delete con contraseña
    throw new BadRequestException(
      'La eliminación directa está deshabilitada por seguridad. Use el borrado seguro con contraseña.',
    );
  }

  @Post('interacciones')
  @UseGuards(ModulesGuard)
  @Modules('crm')
  createInteraccion(@Body() createInteraccionDto: CreateInteraccionDto) {
    return this.crmService.createInteraccion(createInteraccionDto);
  }

  // ============================================
  // ACTIVIDADES COMERCIALES
  // ============================================

  @Post('actividades')
  @UseGuards(ModulesGuard)
  @Modules('crm')
  createActividad(@Body() dto: any) {
    return this.crmService.createActividadComercial(dto);
  }

  @Get('actividades')
  findAllActividades(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('clienteId') clienteId?: string,
  ) {
    const filters = clienteId ? { clienteId } : {};
    return this.crmService.findAllActividades(+page, +limit, filters, req.user);
  }

  @Put('actividades/:id')
  @UseGuards(ModulesGuard)
  @Modules('crm')
  updateActividad(@Param('id') id: string, @Body() dto: any) {
    return this.crmService.updateActividad(id, dto);
  }

  // ============================================
  // DOCUMENTOS DEL CLIENTE
  // ============================================

  @Post('documentos')
  @UseGuards(ModulesGuard)
  @Modules('crm')
  createDocumento(@Body() dto: any) {
    return this.crmService.createDocumento(dto);
  }

  @Delete('documentos/:id')
  @UseGuards(ModulesGuard)
  @Modules('crm')
  removeDocumento(@Param('id') id: string) {
    return this.crmService.removeDocumento(id);
  }
}
