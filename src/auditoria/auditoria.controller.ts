import { Controller, Get, Delete, Query, UseGuards } from '@nestjs/common';
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
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
  ) {
    return this.auditoriaService.findAll({
      page: parseInt(page),
      limit: parseInt(limit),
      modulo,
      usuarioId,
      search,
      fechaDesde,
      fechaHasta,
    });
  }

  /**
   * Purga manual: elimina logs de más de 90 días excepto ELIMINAR_*.
   * Solo accesible por ADMIN.
   */
  @Delete('purgar')
  @Roles('ADMIN')
  purgarManual() {
    return this.auditoriaService.purgarManual();
  }
}
