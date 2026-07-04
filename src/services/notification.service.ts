import { DailyRegister } from '../types';
import { calculateGrossIncome, calculateExpensesTotal, calculateQRTotal } from '../utils/calculations';
import { formatCurrency } from '../utils/currency';
import { EXPENSE_CATEGORIES } from '../constants/categories';
import { getAllStores } from './store.service';

let storeNameCache: Record<string, string> = {};

const getStoreName = async (storeId: string): Promise<string> => {
  if (storeNameCache[storeId]) return storeNameCache[storeId];
  try {
    const stores = await getAllStores();
    stores.forEach(s => { storeNameCache[s.id] = s.name; });
    return storeNameCache[storeId] || storeId;
  } catch {
    return storeId;
  }
};

const TZ = 'America/Bogota';

const formatDateColombia = (date: Date, options: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat('es-CO', { ...options, timeZone: TZ }).format(date);

/**
 * Genera el contenido del reporte diario en formato HTML para email
 */
const generateEmailReportHTML = (register: DailyRegister, storeName: string): string => {
  const income = calculateGrossIncome(register);
  const expenses = calculateExpensesTotal(register.expenses || []);
  const balance = income - expenses - (register.dailySavings || 0);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 20px; }
        .section { background: white; margin: 15px 0; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea; }
        .metric { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px; background: #f3f4f6; border-radius: 5px; }
        .metric-label { font-weight: bold; color: #4b5563; }
        .metric-value { font-weight: bold; }
        .positive { color: #10b981; }
        .negative { color: #ef4444; }
        .footer { background: #1f2937; color: white; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
        h2 { margin: 0 0 10px 0; color: #1f2937; }
        h3 { margin: 10px 0; color: #4b5563; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">📊 Reporte Diario - ${storeName}</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Fecha: ${formatDateColombia(new Date(register.date + 'T12:00:00'), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <div class="content">
          <!-- Resumen General -->
          <div class="section">
            <h2>💰 Resumen Financiero</h2>
            <div class="metric">
              <span class="metric-label">Ingresos Totales:</span>
              <span class="metric-value positive">${formatCurrency(income)}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Gastos Totales:</span>
              <span class="metric-value negative">${formatCurrency(expenses)}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Ahorro del Día:</span>
              <span class="metric-value" style="color: #f59e0b;">${formatCurrency(register.dailySavings || 0)}</span>
            </div>
            <div class="metric" style="border-top: 2px solid #e5e7eb; margin-top: 10px; padding-top: 10px;">
              <span class="metric-label">Balance Neto:</span>
              <span class="metric-value ${balance >= 0 ? 'positive' : 'negative'}">${formatCurrency(balance)}</span>
            </div>
          </div>

          <!-- Detalle de Ingresos -->
          <div class="section">
            <h2>📈 Detalle de Ingresos</h2>
            <div class="metric">
              <span class="metric-label">Ventas del Sistema POS:</span>
              <span class="metric-value">${formatCurrency(register.systemSales || 0)}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Ventas del Cuaderno:</span>
              <span class="metric-value">${formatCurrency((register.notebookSales || []).reduce((sum, s) => sum + s.subtotal, 0))}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Servicios Técnicos:</span>
              <span class="metric-value">${formatCurrency((register.technicalServices || []).reduce((sum, s) => sum + s.amount, 0))}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Pagos QR:</span>
              <span class="metric-value">${formatCurrency(calculateQRTotal(register.qrPayments || []))}</span>
            </div>
          </div>

          <!-- Servicios Técnicos Realizados -->
          ${register.technicalServices && register.technicalServices.length > 0 ? `
          <div class="section">
            <h2>🔧 Servicios Técnicos (${register.technicalServices.length})</h2>
            ${register.technicalServices.map(service => `
              <div style="padding: 8px; margin: 5px 0; background: #f9fafb; border-radius: 5px;">
                <strong>${service.serviceType}</strong> - ${service.deviceModel}<br>
                <span style="font-size: 12px; color: #6b7280;">Técnico: ${service.technicianName} | ${formatCurrency(service.amount)}</span>
              </div>
            `).join('')}
          </div>
          ` : ''}

          <!-- Gastos Operativos Detallados -->
          ${register.expenses && register.expenses.length > 0 ? `
          <div class="section">
            <h2>💸 Gastos Operativos (${register.expenses.length})</h2>
            ${register.expenses.map(expense => {
              const category = EXPENSE_CATEGORIES.find(c => c.id === expense.category);
              return `
              <div style="padding: 8px; margin: 5px 0; background: #fef2f2; border-radius: 5px;">
                <strong>${category?.icon || '📌'} ${category?.label || expense.category}</strong> - ${expense.concept}<br>
                <span style="font-size: 12px; color: #6b7280;">
                  ${expense.responsiblePerson ? `Responsable: ${expense.responsiblePerson} | ` : ''}${formatCurrency(expense.amount)}
                </span>
              </div>
            `}).join('')}
          </div>
          ` : ''}

          <!-- Balance de Caja -->
          <div class="section">
            <h2>💵 Balance de Caja</h2>
            <div class="metric">
              <span class="metric-label">Efectivo Esperado:</span>
              <span class="metric-value">${formatCurrency(register.expectedCash || 0)}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Efectivo Contado:</span>
              <span class="metric-value">${formatCurrency(register.actualCash || 0)}</span>
            </div>
            <div class="metric" style="border-top: 2px solid #e5e7eb; margin-top: 10px; padding-top: 10px;">
              <span class="metric-label">Diferencia:</span>
              <span class="metric-value ${(register.difference || 0) >= 0 ? 'positive' : 'negative'}">${formatCurrency(register.difference || 0)}</span>
            </div>
            ${register.differenceJustification ? `
              <div style="margin-top: 10px; padding: 10px; background: #fef3c7; border-radius: 5px;">
                <strong>Justificación:</strong><br>
                <span style="font-size: 13px;">${register.differenceJustification}</span>
              </div>
            ` : ''}
          </div>

          <!-- Información de Cierre -->
          <div class="section">
            <h3>ℹ️ Información de Cierre</h3>
            <p style="margin: 5px 0; font-size: 13px; color: #6b7280;">
              Registrado por: <strong>${register.registeredByName}</strong><br>
              Cerrado: ${register.closedAt ? formatDateColombia(new Date(register.closedAt), { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
            </p>
          </div>
        </div>

        <div class="footer">
          <p style="margin: 0;">🤖 Reporte generado automáticamente por el sistema de gestión</p>
          <p style="margin: 5px 0 0 0; opacity: 0.7;">Distriaccell & accell.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
};


/**
 * Envía un email a través del servidor backend con Nodemailer
 */
const sendViaNodemailer = async (
  to: string,
  subject: string,
  html: string
): Promise<void> => {
  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err?.error || `Error ${res.status}`);
  }
};

/**
 * Envía el reporte diario por correo electrónico usando Nodemailer
 */
export const sendDailyReportEmail = async (
  register: DailyRegister,
  recipientEmail: string,
): Promise<void> => {
  const storeName = await getStoreName(register.storeId);
  const html = generateEmailReportHTML(register, storeName);
  const subject = `Reporte Diario - ${storeName} - ${formatDateColombia(new Date(register.date + 'T12:00:00'), { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

  try {
    await sendViaNodemailer(recipientEmail, subject, html);
    console.log('Reporte enviado a:', recipientEmail);
  } catch (error: any) {
    console.error('Error al enviar correo:', error.message);
    throw new Error(`No se pudo enviar el reporte: ${error.message}`);
  }
};


/**
 * Envía un correo de prueba para verificar que la configuración SMTP funciona
 */
export const sendTestEmail = async (recipientEmail: string, _recipientName?: string): Promise<void> => {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:30px;">
      <h2 style="color:#1f2937;">Prueba de notificaciones</h2>
      <p>Este correo confirma que la configuración de Nodemailer está funcionando correctamente.</p>
      <p style="color:#6b7280;font-size:13px;">Enviado el ${new Date().toLocaleString('es-CO')}</p>
    </div>`;

  await sendViaNodemailer(recipientEmail, 'Prueba de conexión - Distriaccell', html);
};

/**
 * Envía el reporte diario por correo electrónico
 */
export const sendDailyReportNotifications = async (
  register: DailyRegister,
  config: {
    email?: { address: string; name?: string };
    secondaryEmail?: { address: string; name?: string };
  }
): Promise<{ emailSent: boolean; secondaryEmailSent: boolean }> => {
  const results = {
    emailSent: false,
    secondaryEmailSent: false
  };

  // Enviar al correo principal si está configurado
  if (config.email?.address) {
    try {
      await sendDailyReportEmail(register, config.email.address);
      results.emailSent = true;
    } catch (error) {
      console.error('Error al enviar correo principal:', error);
    }
  }

  // Enviar al correo secundario si está configurado
  if (config.secondaryEmail?.address) {
    try {
      await sendDailyReportEmail(register, config.secondaryEmail.address);
      results.secondaryEmailSent = true;
    } catch (error) {
      console.error('Error al enviar correo secundario:', error);
    }
  }

  return results;
};
