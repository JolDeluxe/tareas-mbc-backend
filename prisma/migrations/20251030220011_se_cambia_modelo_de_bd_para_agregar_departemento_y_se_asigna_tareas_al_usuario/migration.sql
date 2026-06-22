/*
  Warnings:

  - You are about to drop the column `modificadoPor` on the `historialfecha` table. All the data in the column will be lost.
  - You are about to drop the column `asignador` on the `tarea` table. All the data in the column will be lost.
  - You are about to drop the column `responsable` on the `tarea` table. All the data in the column will be lost.
  - Added the required column `modificadoPorId` to the `HistorialFecha` table without a default value. This is not possible if the table is not empty.
  - Added the required column `asignadorId` to the `Tarea` table without a default value. This is not possible if the table is not empty.
  - Added the required column `departamentoId` to the `Tarea` table without a default value. This is not possible if the table is not empty.
  - Added the required column `departamentoId` to the `Usuario` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `historialfecha` DROP COLUMN `modificadoPor`,
    ADD COLUMN `modificadoPorId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `tarea` DROP COLUMN `asignador`,
    DROP COLUMN `responsable`,
    ADD COLUMN `asignadorId` INTEGER NOT NULL,
    ADD COLUMN `departamentoId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `usuario` ADD COLUMN `departamentoId` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `Departamento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Departamento_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResponsablesEnTarea` (
    `usuarioId` INTEGER NOT NULL,
    `tareaId` INTEGER NOT NULL,

    PRIMARY KEY (`usuarioId`, `tareaId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_departamentoId_fkey` FOREIGN KEY (`departamentoId`) REFERENCES `Departamento`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tarea` ADD CONSTRAINT `Tarea_departamentoId_fkey` FOREIGN KEY (`departamentoId`) REFERENCES `Departamento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tarea` ADD CONSTRAINT `Tarea_asignadorId_fkey` FOREIGN KEY (`asignadorId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResponsablesEnTarea` ADD CONSTRAINT `ResponsablesEnTarea_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResponsablesEnTarea` ADD CONSTRAINT `ResponsablesEnTarea_tareaId_fkey` FOREIGN KEY (`tareaId`) REFERENCES `Tarea`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HistorialFecha` ADD CONSTRAINT `HistorialFecha_modificadoPorId_fkey` FOREIGN KEY (`modificadoPorId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
