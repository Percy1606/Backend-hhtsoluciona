import { Module } from '@nestjs/common';
import { OperacionesController } from './operaciones.controller';
import { OperacionesService } from './operaciones.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuthModule, PrismaModule, NotificacionesModule, AuditoriaModule],
  controllers: [OperacionesController],
  providers: [OperacionesService],
})
export class OperacionesModule {}
