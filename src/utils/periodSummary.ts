import { DailyRegister } from '../types';
import {
  calculateCreditNotInCashTotal,
  calculateExpensesTotal,
  calculateNotebookTotal,
  calculateQRBreakdown,
  calculateQRTotal,
  calculateServicesTotal,
} from './calculations';

/**
 * Definición ÚNICA de las métricas de un período. Todas las vistas (Dashboard,
 * Reportes, Balance General, Reporte Ejecutivo, Gastos) deben leer de aquí para
 * que un mismo nombre signifique siempre lo mismo:
 *
 *   ventas        = sistema + cuaderno + servicios (todas las formas de pago)
 *   banco         = QR / transferencia / tarjeta — YA está dentro de ventas
 *   creditoNoCaja = parte de las ventas a crédito que no entró al cajón
 *   efectivo      = ventas − banco − creditoNoCaja (lo que entró físicamente)
 *   utilidad      = ventas − gastos  (el ahorro NO resta: es plata apartada, no un gasto)
 *   cajaEsperada  = efectivo − gastos − ahorro (lo que debía quedar en el cajón)
 */
export interface ResumenPeriodo {
  dias: number;
  ventas: number;
  ventasSistema: number;
  ventasCuaderno: number;
  servicios: number;
  banco: number;
  bancoDesglose: { qr: number; transferencia: number; tarjeta: number; otros: number };
  creditoNoCaja: number;
  efectivo: number;
  gastos: number;
  ahorro: number;
  utilidad: number;
  cajaEsperada: number;
}

export const resumirRegistros = (registros: Partial<DailyRegister>[]): ResumenPeriodo => {
  const acc = {
    ventasSistema: 0,
    ventasCuaderno: 0,
    servicios: 0,
    banco: 0,
    creditoNoCaja: 0,
    gastos: 0,
    ahorro: 0,
  };
  const bancoDesglose = { qr: 0, transferencia: 0, tarjeta: 0, otros: 0 };

  for (const r of registros) {
    acc.ventasSistema += r.systemSales || 0;
    acc.ventasCuaderno += calculateNotebookTotal(r.notebookSales || []);
    acc.servicios += calculateServicesTotal(r.technicalServices || []);
    acc.banco += calculateQRTotal(r.qrPayments || []);
    acc.creditoNoCaja += calculateCreditNotInCashTotal(r.creditSales || []);
    acc.gastos += calculateExpensesTotal(r.expenses || []);
    acc.ahorro += r.dailySavings || 0;
    const d = calculateQRBreakdown(r.qrPayments || []);
    bancoDesglose.qr += d.qr;
    bancoDesglose.transferencia += d.transferencia;
    bancoDesglose.tarjeta += d.tarjeta;
    bancoDesglose.otros += d.otros;
  }

  const ventas = acc.ventasSistema + acc.ventasCuaderno + acc.servicios;
  const efectivo = ventas - acc.banco - acc.creditoNoCaja;

  return {
    dias: registros.length,
    ventas,
    ventasSistema: acc.ventasSistema,
    ventasCuaderno: acc.ventasCuaderno,
    servicios: acc.servicios,
    banco: acc.banco,
    bancoDesglose,
    creditoNoCaja: acc.creditoNoCaja,
    efectivo,
    gastos: acc.gastos,
    ahorro: acc.ahorro,
    utilidad: ventas - acc.gastos,
    cajaEsperada: efectivo - acc.gastos - acc.ahorro,
  };
};

export const resumirRegistro = (registro: Partial<DailyRegister>): ResumenPeriodo =>
  resumirRegistros([registro]);
