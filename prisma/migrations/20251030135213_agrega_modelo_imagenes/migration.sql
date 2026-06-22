-- CreateTable
CREATE TABLE `ImagenTarea` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `url` VARCHAR(191) NOT NULL,
    `fechaSubida` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tareaId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ImagenTarea` ADD CONSTRAINT `ImagenTarea_tareaId_fkey` FOREIGN KEY (`tareaId`) REFERENCES `Tarea`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
