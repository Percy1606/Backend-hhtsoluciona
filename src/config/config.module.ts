import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { UsersController } from './users.controller';
import { WorkersController } from './workers.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UsersController, WorkersController],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
