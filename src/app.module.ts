import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OperacionesModule } from './operaciones/operaciones.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';

@Module({
  imports: [AuthModule, ConfigModule, OperacionesModule, PrismaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
