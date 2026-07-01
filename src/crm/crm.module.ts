import { Module } from '@nestjs/common';
import { CrmService } from './crm.service';
import { CrmCronService } from './crm-cron.service';
import { CrmController } from './crm.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [PrismaModule, AuthModule, NotificacionesModule, AuditoriaModule],
  controllers: [CrmController],
  providers: [CrmService, CrmCronService],
  exports: [CrmService],
})
export class CrmModule {}
