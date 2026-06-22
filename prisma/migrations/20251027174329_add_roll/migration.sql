/*
  Warnings:

  - You are about to drop the column `FechaCreacion` on the `usuario` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Usuario` DROP COLUMN `FechaCreacion`,
    ADD COLUMN `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `rol` ENUM('ADMIN', 'USUARIO') NOT NULL DEFAULT 'USUARIO';
