-- AlterTable
ALTER TABLE `tarea` ADD COLUMN `comentarioEntrega` TEXT NULL,
    ADD COLUMN `fechaEntrega` DATETIME(3) NULL,
    ADD COLUMN `fechaRevision` DATETIME(3) NULL,
    ADD COLUMN `feedbackRevision` TEXT NULL,
    MODIFY `estatus` ENUM('PENDIENTE', 'EN_REVISION', 'CONCLUIDA', 'CANCELADA') NOT NULL;
