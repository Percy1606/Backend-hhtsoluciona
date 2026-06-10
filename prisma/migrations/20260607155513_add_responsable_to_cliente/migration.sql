-- AlterTable
ALTER TABLE `cliente` ADD COLUMN `responsableId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `CLIENTE` ADD CONSTRAINT `CLIENTE_responsableId_fkey` FOREIGN KEY (`responsableId`) REFERENCES `Responsable`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
