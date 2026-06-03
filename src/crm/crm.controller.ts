import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Res, HttpStatus } from '@nestjs/common';
import { CrmService } from './crm.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { CreateInteraccionDto } from './dto/create-interaccion.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModulesGuard } from '../auth/modules.guard';
import { Modules } from '../auth/modules.decorator';

@Controller('crm')
@UseGuards(JwtAuthGuard, ModulesGuard)
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('clientes')
  @Modules('crm')
  findAll() {
    return this.crmService.findAllClientes();
  }

  @Get('clientes/:id')
  @Modules('crm')
  findOne(@Param('id') id: string) {
    return this.crmService.findOneCliente(id);
  }

  @Post('clientes')
  @Modules('crm')
  create(@Body() createClienteDto: CreateClienteDto) {
    return this.crmService.createCliente(createClienteDto);
  }

  @Post('clientes/bulk')
  @Modules('crm')
  async createBulk(@Body() clients: CreateClienteDto[]) {
    const results = [];
    for (const client of clients) {
        try {
            const res = await this.crmService.createCliente(client);
            results.push(res);
        } catch (e) {
            console.error(`[CRM] Error in bulk creation for ${client.empresa}:`, e.message);
        }
    }
    return { count: results.length, data: results };
  }

  @Put('clientes/:id')
  @Modules('crm')
  update(@Param('id') id: string, @Body() updateClienteDto: UpdateClienteDto) {
    return this.crmService.updateCliente(id, updateClienteDto);
  }

  @Delete('clientes/:id')
  @Modules('crm')
  remove(@Param('id') id: string) {
    return this.crmService.removeCliente(id);
  }

  @Post('interacciones')
  @Modules('crm')
  createInteraccion(@Body() createInteraccionDto: CreateInteraccionDto) {
    return this.crmService.createInteraccion(createInteraccionDto);
  }
}
