import { describe, it, expect } from 'vitest';
import { registrosDesdeCierre } from './closingWindow';

const reg = (date: string, isClosed: boolean, closedAt?: string) => ({
  date,
  isClosed,
  closedAt: closedAt ? new Date(closedAt) : undefined,
});

// Cierre mensual hecho el 19-sep a las 15:00 hora Bogotá (20:00 UTC)
const cierre = { date: new Date('2026-09-19T20:00:00Z') };

describe('registrosDesdeCierre', () => {
  it('sin cierre previo cuenta todo desde el inicio', () => {
    const rs = [reg('2019-12-31', true), reg('2020-01-01', true), reg('2026-09-01', true)];
    expect(registrosDesdeCierre(rs, null, '2020-01-01').map((r) => r.date)).toEqual(['2020-01-01', '2026-09-01']);
  });

  it('el día del cierre cuenta si el arqueo fue DESPUÉS del cierre (caso reportado)', () => {
    // arqueo del 19-sep a las 19:00 Bogotá (00:00 UTC del 20) — el cierre mensual fue a las 15:00
    const r19 = reg('2026-09-19', true, '2026-09-20T00:00:00Z');
    expect(registrosDesdeCierre([r19], cierre, '2020-01-01')).toEqual([r19]);
  });

  it('el día del cierre NO cuenta si el arqueo fue antes del cierre (ya está en el saldo)', () => {
    const r19 = reg('2026-09-19', true, '2026-09-19T18:00:00Z');
    expect(registrosDesdeCierre([r19], cierre, '2020-01-01')).toEqual([]);
  });

  it('el día del cierre sin arqueo todavía no cuenta', () => {
    expect(registrosDesdeCierre([reg('2026-09-19', false)], cierre, '2020-01-01')).toEqual([]);
  });

  it('días anteriores nunca cuentan, aunque se hayan re-cerrado después', () => {
    const r18 = reg('2026-09-18', true, '2026-09-20T00:00:00Z');
    expect(registrosDesdeCierre([r18], cierre, '2020-01-01')).toEqual([]);
  });

  it('días posteriores siempre cuentan (el filtro por isClosed lo hace calcCashCollected)', () => {
    const rs = [reg('2026-09-20', false), reg('2026-09-21', true, '2026-09-22T00:00:00Z')];
    expect(registrosDesdeCierre(rs, cierre, '2020-01-01')).toEqual(rs);
  });

  it('usa el día calendario de Bogotá: cierre a las 21:00 Bogotá (02:00 UTC del día siguiente)', () => {
    const tarde = { date: new Date('2026-09-20T02:00:00Z') }; // 19-sep 21:00 en Bogotá
    const r19 = reg('2026-09-19', true, '2026-09-20T03:00:00Z');
    const r20 = reg('2026-09-20', true, '2026-09-21T03:00:00Z');
    expect(registrosDesdeCierre([r19, r20], tarde, '2020-01-01')).toEqual([r19, r20]);
  });
});
