import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    // We must provide the adapter to the PrismaClient constructor in Prisma 7
    // when using @prisma/adapter-mariadb.
    const databaseUrl = process.env.DATABASE_URL || "mysql://root:@localhost:3306/software_hh_db";
    const adapter = new PrismaMariaDb(databaseUrl);
    
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      console.error('Prisma connection error:', error);
    }
  }
}
