export const BUSINESS_RULES = {
  // Departamentos donde la jerarquía permite asignaciones "hacia arriba" y laterales.
  // Ej: ADMIN -> ADMIN, ENCARGADO -> ADMIN, ENCARGADO -> ENCARGADO
  departamentosAsignacionJerarquiaLibre: [
    "Pieles",
    // "Calidad"
    // "Otro Departamento", <-- Si el día de mañana necesitas otro, solo lo agregas aquí
  ]
};