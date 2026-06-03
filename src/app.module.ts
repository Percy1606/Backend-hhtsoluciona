import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OperacionesModule } from './operaciones/operaciones.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { CrmModule } from './crm/crm.module';
import { CotizacionesModule } from './cotizaciones/cotizaciones.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    AuthModule, 
    ConfigModule, 
    OperacionesModule, 
    PrismaModule,
    CrmModule,
    CotizacionesModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
