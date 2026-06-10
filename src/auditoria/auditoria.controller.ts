import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  @Roles('ADMIN')
  findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('modulo') modulo?: string,
    @Query('usuarioId') usuarioId?: string,
    @Query('search') search?: string,
  ) {
    return this.auditoriaService.findAll({
      page: parseInt(page),
      limit: parseInt(limit),
      modulo,
      usuarioId,
      search,
    });
  }
}
