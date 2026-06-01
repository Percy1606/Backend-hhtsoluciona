import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ConfigService } from './config.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('config/trabajadores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class WorkersController {
  constructor(private readonly configService: ConfigService) {}

  @Post()
  create(@Body() createWorkerDto: CreateWorkerDto) {
    return this.configService.createWorker(createWorkerDto);
  }

  @Get()
  findAll() {
    return this.configService.findAllWorkers();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.configService.findOneWorker(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateWorkerDto: UpdateWorkerDto) {
    return this.configService.updateWorker(id, updateWorkerDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.configService.removeWorker(id);
  }
}
