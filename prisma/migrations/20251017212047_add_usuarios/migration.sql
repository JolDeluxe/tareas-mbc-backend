-- CreateTable
CREATE TABLE `Tarea` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tarea` VARCHAR(191) NOT NULL,
    `asignador` VARCHAR(191) NOT NULL,
    `responsable` VARCHAR(191) NOT NULL,
    `fechaRegistro` DATETIME(3) NOT NULL,
    `fechaLimite` DATETIME(3) NOT NULL,
    `fechaConclusion` DATETIME(3) NULL,
    `estatus` ENUM('PENDIENTE', 'CONCLUIDA', 'CANCELADA') NOT NULL,
    `urgencia` ENUM('BAJA', 'MEDIA', 'ALTA') NOT NULL,
    `observaciones` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HistorialFecha` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fechaAnterior` DATETIME(3) NOT NULL,
    `nuevaFecha` DATETIME(3) NOT NULL,
    `modificadoPor` VARCHAR(191) NOT NULL,
    `motivo` VARCHAR(191) NULL,
    `fechaCambio` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tareaId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Usuario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `FechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Usuario_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `HistorialFecha` ADD CONSTRAINT `HistorialFecha_tareaId_fkey` FOREIGN KEY (`tareaId`) REFERENCES `Tarea`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
