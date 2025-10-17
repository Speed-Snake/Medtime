// src/utils/helpers.ts
/**
 * Utilidades compartidas para evitar duplicación de código
 */

/**
 * Oscurece o aclara un color hexadecimal
 * @param hex Color en formato hexadecimal (#RRGGBB)
 * @param percent Porcentaje de cambio (-100 a 100)
 * @returns Color modificado en formato hexadecimal
 */
export function shade(hex: string, percent: number): string {
  const p = Math.max(-100, Math.min(100, percent)) / 100;
  const n = (v: number) => {
    const out = Math.round(p < 0 ? v * (1 + p) : v + (255 - v) * p);
    return Math.max(0, Math.min(255, out));
  };
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  const rr = n(r).toString(16).padStart(2, "0");
  const gg = n(g).toString(16).padStart(2, "0");
  const bb = n(b).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`;
}

/**
 * Formatea una fecha ISO a formato de hora (HH:MM)
 * @param iso Fecha en formato ISO string
 * @returns Hora formateada (HH:MM)
 */
export function fmtHour(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Dada una hora del día (Date usado solo por su hora/minuto),
 * devuelve la próxima ocurrencia absoluta:
 * - Si aún no pasó hoy -> hoy a esa hora
 * - Si ya pasó -> mañana a esa hora
 * @param timeOnly Fecha con solo hora/minuto
 * @returns Próxima ocurrencia de la hora
 */
export function combineNextOccurrence(timeOnly: Date): Date {
  const now = new Date();
  const scheduled = new Date();
  scheduled.setHours(timeOnly.getHours(), timeOnly.getMinutes(), 0, 0);
  if (scheduled.getTime() <= now.getTime()) {
    const nextDay = new Date(scheduled);
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay;
  }
  return scheduled;
}

/**
 * Valida si una fecha es válida
 * @param date Fecha a validar
 * @returns true si la fecha es válida
 */
export function isValidDate(date: Date): boolean {
  return !isNaN(date.getTime());
}

/**
 * Formatea una fecha a string legible en español
 * @param date Fecha a formatear
 * @returns Fecha formateada en español
 */
export function formatDateSpanish(date: Date): string {
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

