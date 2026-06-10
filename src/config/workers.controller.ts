import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from './config.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('config/trabajadores')
@UseGuards(JwtAuthGuard) // Solo JWT a nivel de clase para permitir acceso base a todos los autenticados
export class WorkersController {
  constructor(private readonly configService: ConfigService) {}

  @Get('me')
  async findMe(@Req() req: any) {
    const user = req.user;
    
    // Buscar el usuario en la DB para obtener el responsableId actualizado
    const dbUser = await this.configService.findOneUser(user.id);
    
    // -- DEBUGGING --
    console.log('DEBUG: User profile fetched from DB in findMe:', JSON.stringify(dbUser, null, 2));
    // -- END DEBUGGING --

    if (!dbUser.responsableId) {
      throw new ForbiddenException('Su usuario no tiene un perfil de trabajador vinculado');
    }
    return this.configService.findOneWorker(dbUser.responsableId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  create(@Body() createWorkerDto: CreateWorkerDto) {
    return this.configService.createWorker(createWorkerDto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  findAll() {
    return this.configService.findAllWorkers();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.configService.findOneWorker(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateWorkerDto: UpdateWorkerDto, @Req() req: any) {
    const user = req.user;
    
    // Si no es admin, solo puede editar su propio perfil
    if (user.rol !== 'ADMIN') {
      const dbUser = await this.configService.findOneUser(user.id);
      if (dbUser.responsableId !== id) {
        throw new ForbiddenException('No tiene permiso para editar este perfil');
      }
    }
    
    return this.configService.updateWorker(id, updateWorkerDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.configService.removeWorker(id);
  }
}
