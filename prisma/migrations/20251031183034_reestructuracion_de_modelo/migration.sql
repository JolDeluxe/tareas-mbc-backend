/*
  Warnings:

  - Added the required column `tipo` to the `Departamento` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `historialfecha` DROP FOREIGN KEY `HistorialFecha_modificadoPorId_fkey`;

-- DropIndex
DROP INDEX `HistorialFecha_modificadoPorId_fkey` ON `historialfecha`;

-- AlterTable
ALTER TABLE `departamento` ADD COLUMN `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `fechaEdicion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `tipo` ENUM('ADMINISTRATIVO', 'OPERATIVO') NOT NULL;

-- AlterTable
ALTER TABLE `usuario` ADD COLUMN `fechaEdicion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `rol` ENUM('ADMIN', 'ENCARGADO', 'USUARIO', 'INVITADO') NOT NULL DEFAULT 'USUARIO',
    MODIFY `departamentoId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `HistorialFecha` ADD CONSTRAINT `HistorialFecha_modificadoPorId_fkey` FOREIGN KEY (`modificadoPorId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
