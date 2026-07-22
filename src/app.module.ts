import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OperacionesModule } from './operaciones/operaciones.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { CrmModule } from './crm/crm.module';
import { CotizacionesModule } from './cotizaciones/cotizaciones.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { LogisticaModule } from './logistica/logistica.module';
import { FinanzasModule } from './finanzas/finanzas.module';
import { FilesModule } from './files/files.module';
import { LibraryModule } from './library/library.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100, // Aumentado para no bloquear dashboards que hacen múltiples peticiones
      },
    ]),
    AuthModule,
    ConfigModule,
    OperacionesModule,
    PrismaModule,
    CrmModule,
    CotizacionesModule,
    NotificacionesModule,
    AuditoriaModule,
    LogisticaModule,
    FinanzasModule,
    FilesModule,
    LibraryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
