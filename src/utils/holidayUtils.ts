import { format } from 'date-fns'; 

// Días festivos fijos en México (Formato: dd/MM)
const DIAS_FESTIVOS_FIJOS = [
  '01/01', // Año Nuevo
  '05/02', // Día de la Constitución
  '21/03', // Natalicio de Benito Juárez
  '01/05', // Día del Trabajo
  '16/09', // Día de la Independencia
  '02/11', // Día de Muertos
  '20/11', // Revolución Mexicana
  '25/12', // Navidad
];

// Fechas específicas sueltas (como Jueves/Viernes Santo 2025)
const VACACIONES_EMPRESA_PUNTUALES = [
  '17/04/2025', // Jueves Santo 2025
  '18/04/2025', // Viernes Santo 2025
];

export const esDiaNoLaborable = (fecha: Date): boolean => {
  const diaSemana = fecha.getDay();
  // 0 = Domingo, 6 = Sábado
  if (diaSemana === 0 || diaSemana === 6) return true;

  // Variables auxiliares para comparaciones
  const diaMes = format(fecha, 'dd/MM');
  const fechaCompleta = format(fecha, 'dd/MM/yyyy');
  const fechaISO = format(fecha, 'yyyy-MM-dd'); // Ideal para rangos de años específicos
  const mes = fecha.getMonth(); // 0 = Enero, 11 = Diciembre
  const dia = fecha.getDate();

  // 1. Revisar Días Festivos Fijos
  if (DIAS_FESTIVOS_FIJOS.includes(diaMes)) return true;

  // 2. Revisar Fechas Puntuales (Semana Santa 2025)
  if (VACACIONES_EMPRESA_PUNTUALES.includes(fechaCompleta)) return true;

  // 3. Revisar Vacaciones Decembrinas (Del 24 Dic al 6 Ene) - RECURRENTE
  // Si es Diciembre (11) y día >= 24  O  Si es Enero (0) y día <= 6
  if ((mes === 11 && dia >= 24) || (mes === 0 && dia <= 6)) {
    return true;
  }

  // 4. Revisar Semana Santa 2026 (Del 29 de Marzo al 5 de Abril)
  // Al usar formato ISO (yyyy-MM-dd), podemos comparar strings directamente
  if (fechaISO >= '2026-03-29' && fechaISO <= '2026-04-05') {
    return true;
  }

  return false;
};