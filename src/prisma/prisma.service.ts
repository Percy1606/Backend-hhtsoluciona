import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno explícitamente
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    console.log('[PrismaService] DATABASE_URL detectada:', databaseUrl ? '***PRESENTE***' : '---AUSENTE---');
    if (!databaseUrl) {
      console.log('[PrismaService] Env keys disponibles:', Object.keys(process.env).filter(k => k.includes('URL') || k.includes('DB') || k.includes('DATABASE')));
      throw new Error('DATABASE_URL is not defined in environment variables');
    }
    const adapter = new PrismaMariaDb(databaseUrl);
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Conexión exitosa a la base de datos MySQL/MariaDB.');
    } catch (error) {
      this.logger.error('❌ Error al conectar a la base de datos:', error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
