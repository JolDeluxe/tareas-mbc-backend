type Rol = "SUPER_ADMIN" | "ADMIN" | "ENCARGADO" | "USUARIO" | "INVITADO";

interface UsuarioPermisos {
  id: number;
  rol: Rol;
  departamentoId: number | null;
}

interface TareaPermisos {
  asignadorId: number;
  departamentoId: number;
  asignador?: {
    departamentoId: number | null;
    rol?: Rol | string | null;
  } | null;
  responsables?: Array<{
    usuarioId: number;
  }>;
}

export const puedeRevisarOAutorizarTarea = (
  tarea: TareaPermisos,
  user: UsuarioPermisos
): boolean => {
  if (user.rol === "SUPER_ADMIN") return true;
  if (tarea.responsables?.some((responsable) => responsable.usuarioId === user.id)) return false;
  if (tarea.asignadorId === user.id) return true;

  const departamentoOrigenId = tarea.asignador?.departamentoId ?? null;
  if (!departamentoOrigenId || user.departamentoId !== departamentoOrigenId) return false;

  const esTareaExterna = tarea.departamentoId !== departamentoOrigenId;
  if (esTareaExterna) {
    return user.rol === "ADMIN" || user.rol === "ENCARGADO";
  }

  return user.rol === "ADMIN";
};

export const puedeEditarTarea = (
  tarea: TareaPermisos,
  user: UsuarioPermisos
): boolean => {
  if (user.rol === "SUPER_ADMIN") return true;
  if (tarea.responsables?.some((responsable) => responsable.usuarioId === user.id)) return false;

  const departamentoOrigenId = tarea.asignador?.departamentoId ?? null;
  const esAsignadorOriginal = tarea.asignadorId === user.id;

  // Si es el asignador original, puede editar (siempre que sea ADMIN o ENCARGADO)
  if (esAsignadorOriginal && (user.rol === "ADMIN" || user.rol === "ENCARGADO")) return true;

  // Si no es el asignador original, debe pertenecer al departamento de origen
  if (!departamentoOrigenId || user.departamentoId !== departamentoOrigenId) return false;

  // Si pertenece al departamento de origen y no es el asignador original:
  const rolCreador = tarea.asignador?.rol;
  const creadorEsAdmin = rolCreador === "ADMIN" || rolCreador === "SUPER_ADMIN";

  if (user.rol === "ADMIN") {
    return true;
  }
  if (user.rol === "ENCARGADO") {
    // Un encargado de área no puede editar tareas creadas por un Administrador de su área
    return !creadorEsAdmin;
  }

  return false;
};
