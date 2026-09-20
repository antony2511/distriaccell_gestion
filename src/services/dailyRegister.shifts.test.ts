import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Firestore simulada en memoria: solo lo que usa dailyRegister.service ──
const store = new Map<string, any>();

vi.mock('firebase/firestore', () => {
  class Timestamp {
    constructor(public seconds: number, public nanoseconds = 0) {}
    static now() { return new Timestamp(Math.floor(Date.now() / 1000)); }
    static fromDate(d: Date) { return new Timestamp(Math.floor(d.getTime() / 1000)); }
    toDate() { return new Date(this.seconds * 1000); }
  }
  const isPlain = (v: any) => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Timestamp) && !(v instanceof Date);
  const clone = (v: any): any => (Array.isArray(v) ? v.map(clone) : isPlain(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v);
  const merge = (target: any, src: any) => {
    for (const [k, v] of Object.entries(src)) target[k] = isPlain(v) && isPlain(target[k]) ? merge(target[k], v) : clone(v);
    return target;
  };
  return {
    Timestamp,
    collection: (_db: any, name: string) => ({ name }),
    doc: (_db: any, col: any, id?: string) => ({ path: `${typeof col === 'string' ? col : col.name}/${id}` }),
    getDoc: async (ref: any) => ({ exists: () => store.has(ref.path), data: () => clone(store.get(ref.path)) }),
    setDoc: async (ref: any, data: any, opts?: any) => {
      store.set(ref.path, opts?.merge && store.has(ref.path) ? merge(clone(store.get(ref.path)), data) : clone(data));
    },
    updateDoc: async (ref: any, data: any) => {
      if (!store.has(ref.path)) throw new Error('no existe: ' + ref.path);
      for (const [k, v] of Object.entries(data)) if (v === undefined) throw new Error('Firestore rechaza undefined en ' + k);
      store.set(ref.path, { ...store.get(ref.path), ...clone(data) });
    },
    getDocs: vi.fn(), deleteDoc: vi.fn(), query: vi.fn(), where: vi.fn(), orderBy: vi.fn(),
  };
});
vi.mock('./firebase', () => ({ db: {} }));

// ── correo: se captura, no se envía nada ──
const sendReport = vi.fn(async () => ({ emailSent: true, secondaryEmailSent: false }));
vi.mock('./notification.service', () => ({ sendDailyReportNotifications: (...a: any[]) => (sendReport as any)(...a) }));
vi.mock('./settings.service', () => ({
  getNotificationSettings: async () => ({ enabled: true, managerEmail: 'dueno@example.com', managerName: 'Dueño' }),
}));

import {
  saveDailyRegister,
  getDailyRegister,
  readRegisterDoc,
  closeDailyRegister,
  reopenSundayRegister,
  sendDayReport,
} from './dailyRegister.service';

const DATE = '2026-09-20'; // domingo
const STORE = 'almacen-2'; // accell
const docPath = `dailyRegisters/${DATE}_${STORE}`;
const flush = () => new Promise((r) => setTimeout(r, 0));

const sale = (subtotal: number) => ({ id: 's' + subtotal, description: 'x', category: 'accesorios', quantity: 1, unitPrice: subtotal, subtotal, timestamp: new Date() });
const gasto = (amount: number) => ({ id: 'g' + amount, concept: 'x', category: 'otros', amount, timestamp: new Date() });
const base = () => ({ date: DATE, storeId: STORE, registeredBy: 'u1', registeredByName: 'Caja', createdAt: new Date(), updatedAt: new Date(), isClosed: false, actualCash: 0, expectedCash: 0, difference: 0 });

beforeEach(() => {
  store.clear();
  sendReport.mockClear();
});

describe('domingo en accell: dos turnos independientes y un solo correo', () => {
  it('ciclo completo: mañana → cierre → tarde desde cero → cierre → un correo con la suma', async () => {
    // ── MAÑANA: POS 600.000, cuaderno 50.000, gasto 20.000, ahorro 30.000 → esperado 600.000
    await saveDailyRegister({
      ...base(), systemSales: 600_000, notebookSales: [sale(50_000)] as any, technicalServices: [], qrPayments: [], creditSales: [],
      expenses: [gasto(20_000)] as any, dailySavings: 30_000,
    });
    await closeDailyRegister(DATE, STORE, 595_000, 'faltó cambio', 'u1'); // cuenta 595.000
    await flush();
    let d = await readRegisterDoc(DATE, STORE);
    expect(d).toMatchObject({ isClosed: true, expectedCash: 600_000, actualCash: 595_000, difference: -5_000 });
    expect(sendReport).not.toHaveBeenCalled(); // el cierre de la mañana NO envía correo

    // ── CAMBIO DE TURNO
    await reopenSundayRegister(DATE, STORE, 'u1');
    const tarde0 = (await getDailyRegister(DATE, STORE))!;
    expect(tarde0.isClosed).toBe(false);
    // la pantalla ve la tarde EN CERO: nada de la mañana
    expect(tarde0.systemSales).toBe(0);
    expect(tarde0.dailySavings).toBe(0);
    for (const lista of [tarde0.notebookSales, tarde0.technicalServices, tarde0.qrPayments, tarde0.creditSales, tarde0.expenses]) expect(lista).toEqual([]);
    expect(tarde0.actualCash).toBe(0); // el conteo tampoco hereda el de la mañana
    // y los totales del día siguen siendo los de la mañana mientras la tarde está vacía
    expect((await readRegisterDoc(DATE, STORE))!.systemSales).toBe(600_000);

    // ── TARDE: POS 900.000, cuaderno 80.000, gasto 5.000 → esperado 975.000
    await saveDailyRegister({
      ...tarde0, systemSales: 900_000, notebookSales: [sale(70_000), sale(10_000)] as any, expenses: [gasto(5_000)] as any,
    });
    // durante el turno 2 el DÍA ya muestra mañana + tarde (Dashboard/reportes no pierden ventas)
    d = await readRegisterDoc(DATE, STORE);
    expect(d!.systemSales).toBe(1_500_000);
    expect(d!.notebookSales).toHaveLength(3);
    expect(d!.expenses).toHaveLength(2);
    expect(d!.dailySavings).toBe(30_000);
    expect(d!.isClosed).toBe(false);
    // recargar la página en el turno 2 vuelve a mostrar SOLO la tarde
    const recargada = (await getDailyRegister(DATE, STORE))!;
    expect(recargada.systemSales).toBe(900_000);
    expect(recargada.notebookSales).toHaveLength(2);
    // el arqueo de la mañana no se tocó al guardar la tarde
    expect(d).toMatchObject({ shift1ActualCash: 595_000, shift1ExpectedCash: 600_000 });

    // ── CIERRE DE LA TARDE: cuenta 980.000 (esperado 975.000)
    await closeDailyRegister(DATE, STORE, 980_000, undefined, 'u1');
    await flush();
    d = await readRegisterDoc(DATE, STORE);
    expect(d).toMatchObject({
      isClosed: true,
      // arqueo de la tarde, independiente
      shift2ExpectedCash: 975_000, shift2ActualCash: 980_000, shift2Difference: 5_000,
      // del día = suma de los dos turnos (lo que lee el Balance General)
      expectedCash: 600_000 + 975_000, actualCash: 595_000 + 980_000, difference: 0,
      systemSales: 1_500_000,
    });
    expect(d!.differenceJustification).toBe('Turno 1: faltó cambio');

    // ── UN SOLO correo, con la suma de los dos turnos
    expect(sendReport).toHaveBeenCalledTimes(1);
    const [reg, , label] = sendReport.mock.calls[0] as any[];
    expect(label).toContain('turnos mañana y tarde');
    expect(reg.shift1Data.systemSales).toBe(600_000);
    expect(reg.shift2Data.systemSales).toBe(900_000);
    expect(reg.systemSales).toBe(1_500_000);
    expect(d!.reportSentAt).toBeDefined();
    // ya cerrado: la pantalla muestra el día completo (mañana + tarde)
    expect((await getDailyRegister(DATE, STORE))!.systemSales).toBe(1_500_000);
  });

  it('domingo sin turno 2: el cierre de la mañana no envía; "enviar reporte" lo manda una sola vez', async () => {
    await saveDailyRegister({ ...base(), systemSales: 400_000, notebookSales: [], technicalServices: [], qrPayments: [], creditSales: [], expenses: [], dailySavings: 0 });
    await closeDailyRegister(DATE, STORE, 400_000, undefined, 'u1');
    await flush();
    expect(sendReport).not.toHaveBeenCalled();

    expect(await sendDayReport(DATE, STORE)).toBe(true);
    expect(sendReport).toHaveBeenCalledTimes(1);
    expect((sendReport.mock.calls[0] as any[])[2]).toBeUndefined(); // reporte normal, sin etiqueta de turnos
    expect((await readRegisterDoc(DATE, STORE))!.reportSentAt).toBeDefined();
  });

  it('un día normal (no domingo o no accell) sigue enviando el correo al cerrar, como siempre', async () => {
    const lunes = '2026-09-21';
    store.set(`dailyRegisters/${lunes}_${STORE}`, { ...base(), date: lunes, systemSales: 100_000, notebookSales: [], technicalServices: [], qrPayments: [], creditSales: [], expenses: [], dailySavings: 0 });
    await closeDailyRegister(lunes, STORE, 100_000, undefined, 'u1');
    await flush();
    expect(sendReport).toHaveBeenCalledTimes(1);

    // domingo pero en otra tienda: también envía
    const otra = 'almacen-1';
    store.set(`dailyRegisters/${DATE}_${otra}`, { ...base(), storeId: otra, systemSales: 0, notebookSales: [], technicalServices: [], qrPayments: [], creditSales: [], expenses: [], dailySavings: 0 });
    await closeDailyRegister(DATE, otra, 0, undefined, 'u1');
    await flush();
    expect(sendReport).toHaveBeenCalledTimes(2);
  });

  it('la reapertura solo se permite una vez y solo en domingos de accell', async () => {
    await saveDailyRegister({ ...base(), systemSales: 1, notebookSales: [], technicalServices: [], qrPayments: [], creditSales: [], expenses: [], dailySavings: 0 });
    await closeDailyRegister(DATE, STORE, 1, undefined, 'u1');
    await reopenSundayRegister(DATE, STORE, 'u1');
    await closeDailyRegister(DATE, STORE, 0, undefined, 'u1'); // cierra la tarde vacía
    await expect(reopenSundayRegister(DATE, STORE, 'u1')).rejects.toThrow('Ya se hizo el cambio de turno');
    await expect(reopenSundayRegister('2026-09-21', STORE, 'u1')).rejects.toThrow('solo aplica los domingos');
  });

  it('el documento nunca queda con undefined (Firestore lo rechaza) ni pierde el arqueo de la mañana', async () => {
    await saveDailyRegister({ ...base(), systemSales: 10, notebookSales: [{ ...sale(5), timestamp: undefined }] as any, technicalServices: [], qrPayments: [], creditSales: [], expenses: [], dailySavings: 0 });
    await closeDailyRegister(DATE, STORE, 15, undefined, 'u1');
    await reopenSundayRegister(DATE, STORE, 'u1');
    const t = (await getDailyRegister(DATE, STORE))!;
    await saveDailyRegister({ ...t, systemSales: 7 });
    await closeDailyRegister(DATE, STORE, 7, 'todo bien', 'u1');
    const d = await readRegisterDoc(DATE, STORE);
    expect(d).toMatchObject({ shift1ActualCash: 15, shift2ActualCash: 7, actualCash: 22, systemSales: 17 });
    expect(d!.differenceJustification).toBe('Turno 2: todo bien');
  });
});
