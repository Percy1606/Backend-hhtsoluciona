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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { CrmService } from './crm.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { CreateInteraccionDto } from './dto/create-interaccion.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModulesGuard } from '../auth/modules.guard';
import { Modules } from '../auth/modules.decorator';
import { AuthService } from '../auth/auth.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

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
    @Query('etapaComercial') etapaComercial?: string,
    @Query('tipoCliente') tipoCliente?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
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
        etapaComercial,
        tipoCliente,
        startDate,
        endDate,
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
  @Get('agenda')
  getAgenda(@Query('tipo') tipo?: string) {
    return this.crmService.findAllAgenda(tipo);
  }

  @Get('agenda/general')
  getAgendaGeneral() {
    return this.crmService.findAgendaGeneral();
  }

  @Get('agenda/empresas')
  getAgendaEmpresas(@Query('tipo') tipo?: string) {
    return this.crmService.findAgendaAgrupadaPorEmpresa(tipo);
  }

  @Post('agenda')
  saveAgenda(@Body() tareas: any[], @Query('tipo') tipo?: string) {
    return this.crmService.replaceAgenda(tareas, tipo);
  }

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
    return this.crmService.removeCliente(id, req.user);
  }

  @Post('interacciones')
  @UseGuards(ModulesGuard)
  @Modules('crm')
  createInteraccion(@Body() createInteraccionDto: CreateInteraccionDto) {
    return this.crmService.createInteraccion(createInteraccionDto);
  }

  @Put('interacciones/:id')
  @UseGuards(ModulesGuard)
  @Modules('crm')
  updateInteraccion(@Param('id') id: string, @Body() dto: any) {
    return this.crmService.updateInteraccion(id, dto);
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

  @Post('upload')
  @UseGuards(ModulesGuard)
  @Modules('crm')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/crm',
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
    if (!file) throw new BadRequestException('Archivo no válido.');
    return {
      url: `/uploads/crm/${file.filename}`,
      nombre: file.originalname,
      tipo: file.mimetype,
      tamano: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
    };
  }

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
