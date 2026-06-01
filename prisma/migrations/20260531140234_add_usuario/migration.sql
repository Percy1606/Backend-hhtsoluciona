/*
  Warnings:

  - The values [Steven,Diego,Guillermo,Mario] on the enum `IndicadorAvance_area` will be removed. If these variants are still used in the database, this will fail.
  - The values [Steven,Diego,Guillermo,Mario] on the enum `IndicadorAvance_area` will be removed. If these variants are still used in the database, this will fail.
  - The values [Steven,Diego,Guillermo,Mario] on the enum `IndicadorAvance_area` will be removed. If these variants are still used in the database, this will fail.
  - The values [Steven,Diego,Guillermo,Mario] on the enum `IndicadorAvance_area` will be removed. If these variants are still used in the database, this will fail.
  - The values [Steven,Diego,Guillermo,Mario] on the enum `IndicadorAvance_area` will be removed. If these variants are still used in the database, this will fail.
  - The values [Steven,Diego,Guillermo,Mario] on the enum `IndicadorAvance_area` will be removed. If these variants are still used in the database, this will fail.
  - The values [Steven,Diego,Guillermo,Mario] on the enum `IndicadorAvance_area` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `comentario` MODIFY `usuarioArea` ENUM('LogisticaYRecursos', 'IngenieriaYSupervision', 'GestionDocumentaria', 'OperacionesDeCampo') NOT NULL;

-- AlterTable
ALTER TABLE `historialcambio` MODIFY `area` ENUM('LogisticaYRecursos', 'IngenieriaYSupervision', 'GestionDocumentaria', 'OperacionesDeCampo') NOT NULL;

-- AlterTable
ALTER TABLE `indicadoravance` MODIFY `area` ENUM('LogisticaYRecursos', 'IngenieriaYSupervision', 'GestionDocumentaria', 'OperacionesDeCampo') NOT NULL;

-- AlterTable
ALTER TABLE `proyecto` MODIFY `area` ENUM('LogisticaYRecursos', 'IngenieriaYSupervision', 'GestionDocumentaria', 'OperacionesDeCampo') NOT NULL;

-- AlterTable
ALTER TABLE `reportediario` MODIFY `usuarioArea` ENUM('LogisticaYRecursos', 'IngenieriaYSupervision', 'GestionDocumentaria', 'OperacionesDeCampo') NOT NULL;

-- AlterTable
ALTER TABLE `responsable` MODIFY `area` ENUM('LogisticaYRecursos', 'IngenieriaYSupervision', 'GestionDocumentaria', 'OperacionesDeCampo') NOT NULL;

-- AlterTable
ALTER TABLE `validacionrequerida` MODIFY `area` ENUM('LogisticaYRecursos', 'IngenieriaYSupervision', 'GestionDocumentaria', 'OperacionesDeCampo') NOT NULL;

-- CreateTable
CREATE TABLE `Usuario` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `rol` VARCHAR(191) NOT NULL DEFAULT 'USER',
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `responsableId` VARCHAR(191) NULL,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Usuario_username_key`(`username`),
    UNIQUE INDEX `Usuario_responsableId_key`(`responsableId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_responsableId_fkey` FOREIGN KEY (`responsableId`) REFERENCES `Responsable`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
