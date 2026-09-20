import { describe, it, expect } from 'vitest';
import { generateEmailReportHTML } from './notification.service';

const base: any = {
  date: '2026-09-20',
  storeId: 'almacen-2',
  registeredByName: 'Caja accell',
  systemSales: 1_300_000,
  notebookSales: [],
  technicalServices: [],
  qrPayments: [],
  creditSales: [],
  expenses: [],
  dailySavings: 0,
  isClosed: true,
  closedAt: new Date('2026-09-21T01:30:00Z'),
};

describe('reporte por correo — Balance de Caja', () => {
  it('domingo con dos turnos: arqueo de cada turno más el total del día, en un solo reporte', () => {
    const html = generateEmailReportHTML(
      {
        ...base,
        shift1ClosedAt: new Date('2026-09-20T18:00:00Z'),
        shift1ExpectedCash: 500_000, shift1ActualCash: 495_000, shift1Difference: -5_000, shift1Justification: 'faltó cambio',
        shift2ExpectedCash: 800_000, shift2ActualCash: 810_000, shift2Difference: 10_000,
        shift1Data: { systemSales: 600_000 }, shift2Data: { systemSales: 700_000 },
        expectedCash: 1_300_000, actualCash: 1_305_000, difference: 5_000,
      },
      'accell.com'
    );
    expect(html).toContain('Turno 1 — mañana');
    expect(html).toContain('Turno 2 — tarde');
    expect(html).toContain('Total del día');
    expect(html).toContain('faltó cambio');
    expect(html).toContain('Turno 1 cerrado');
    expect(html).toContain('Turno 2 cerrado');
    expect(html).toMatch(/Mañana[^<]*600[^<]*\+ Tarde[^<]*700/); // POS por turno; el total del día va arriba
    expect((html.match(/Efectivo Contado/g) || []).length).toBe(3); // turno 1, turno 2 y total
  });

  it('día normal: un solo arqueo, sin bloques de turno', () => {
    const html = generateEmailReportHTML(
      { ...base, storeId: 'almacen-1', expectedCash: 1_300_000, actualCash: 1_300_000, difference: 0 },
      'Distriaccell'
    );
    expect(html).not.toContain('Turno 1');
    expect((html.match(/Efectivo Contado/g) || []).length).toBe(1);
    expect(html).toContain('Cerrado:');
  });

  it('domingo con el modelo anterior (sin turno 2 independiente) se ve como antes', () => {
    const html = generateEmailReportHTML(
      { ...base, shift1ClosedAt: new Date('2026-09-13T18:00:00Z'), shift1ActualCash: 400_000, expectedCash: 900_000, actualCash: 900_000, difference: 0 },
      'accell.com'
    );
    expect(html).not.toContain('Turno 2 — tarde');
    expect((html.match(/Efectivo Contado/g) || []).length).toBe(1);
  });
});
