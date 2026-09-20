import { formatDateId } from './dates';

interface RegistroCierre {
  date: string; // 'YYYY-MM-DD'
  isClosed: boolean;
  closedAt?: Date;
}

/**
 * Registros diarios cuyo efectivo cuenta "después" del último cierre mensual.
 *
 * El cierre mensual guarda el INSTANTE en que se hizo (`closing.date`), no el final del día.
 * Si se hace antes del arqueo del día (lo normal: se cierra el mes y luego la caja del día),
 * el registro de ese mismo día todavía estaba abierto y su efectivo no entró en el saldo del
 * cierre. Filtrar solo por fecha (> día del cierre) lo dejaba fuera para siempre: ni en el
 * saldo del cierre ni en el efectivo recogido posterior.
 *
 * Reglas:
 *  - días posteriores al día del cierre: siempre cuentan;
 *  - el día del cierre: cuenta solo si su arqueo se hizo DESPUÉS del cierre (si el arqueo fue
 *    antes, ya estaba dentro del saldo del cierre y contarlo lo duplicaría);
 *  - días anteriores: nunca (una corrección tardía a un día viejo ya está en el saldo base).
 */
export const registrosDesdeCierre = <T extends RegistroCierre>(
  registros: T[],
  cierre: { date: Date } | null,
  inicioSinCierre: string
): T[] => {
  if (!cierre) return registros.filter((r) => r.date >= inicioSinCierre);
  const diaCierre = formatDateId(cierre.date);
  const instanteCierre = cierre.date.getTime();
  return registros.filter(
    (r) =>
      r.date > diaCierre ||
      (r.date === diaCierre && r.isClosed && !!r.closedAt && r.closedAt.getTime() > instanteCierre)
  );
};
