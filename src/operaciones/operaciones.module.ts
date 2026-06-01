import { Module } from '@nestjs/common';
import { OperacionesController } from './operaciones.controller';
import { OperacionesService } from './operaciones.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [OperacionesController],
  providers: [OperacionesService]
})
export class OperacionesModule {}
