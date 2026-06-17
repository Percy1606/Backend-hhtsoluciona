import { Module } from '@nestjs/common';
import { FinanzasService } from './finanzas.service';
import { CashFlowService } from './cash-flow.service';
import { FinanzasController } from './finanzas.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FinanzasController],
  providers: [FinanzasService, CashFlowService],
  exports: [FinanzasService, CashFlowService],
})
export class FinanzasModule {}
