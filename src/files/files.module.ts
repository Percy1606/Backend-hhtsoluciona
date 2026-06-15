import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [FilesController],
})
export class FilesModule {}
