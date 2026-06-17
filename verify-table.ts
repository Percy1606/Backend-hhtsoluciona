import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result: any = await prisma.$queryRawUnsafe("SHOW TABLES LIKE '_prisma_migrations'");
  console.log('Verification of _prisma_migrations table:');
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
