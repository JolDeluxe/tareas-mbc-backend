-- AlterTable
ALTER TABLE `tarea` MODIFY `fechaRegistro` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `estatus` ENUM('PENDIENTE', 'EN_REVISION', 'CONCLUIDA', 'CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
    MODIFY `urgencia` ENUM('BAJA', 'MEDIA', 'ALTA') NOT NULL DEFAULT 'BAJA';

-- CreateIndex
CREATE INDEX `ResponsablesEnTarea_usuarioId_idx` ON `ResponsablesEnTarea`(`usuarioId`);

-- CreateIndex
CREATE INDEX `Tarea_estatus_idx` ON `Tarea`(`estatus`);

-- CreateIndex
CREATE INDEX `Tarea_fechaLimite_idx` ON `Tarea`(`fechaLimite`);

-- CreateIndex
CREATE INDEX `Tarea_fechaRegistro_idx` ON `Tarea`(`fechaRegistro`);

-- CreateIndex
CREATE INDEX `Tarea_urgencia_idx` ON `Tarea`(`urgencia`);

-- CreateIndex
CREATE INDEX `Usuario_estatus_idx` ON `Usuario`(`estatus`);

-- RenameIndex
ALTER TABLE `responsablesentarea` RENAME INDEX `ResponsablesEnTarea_tareaId_fkey` TO `ResponsablesEnTarea_tareaId_idx`;

-- RenameIndex
ALTER TABLE `tarea` RENAME INDEX `Tarea_asignadorId_fkey` TO `Tarea_asignadorId_idx`;

-- RenameIndex
ALTER TABLE `tarea` RENAME INDEX `Tarea_departamentoId_fkey` TO `Tarea_departamentoId_idx`;

-- RenameIndex
ALTER TABLE `usuario` RENAME INDEX `Usuario_departamentoId_fkey` TO `Usuario_departamentoId_idx`;
