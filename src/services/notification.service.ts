import emailjs from '@emailjs/browser';
import { DailyRegister } from '../types';
import { calculateGrossIncome, calculateExpensesTotal } from '../utils/calculations';
import { formatCurrency } from '../utils/currency';
import { STORES, EXPENSE_CATEGORIES } from '../constants/categories';

// Configuración de EmailJS
const EMAILJS_SERVICE_ID = 'service_kyyi8bf';
const EMAILJS_TEMPLATE_ID = 'template_scupydc';
const EMAILJS_PUBLIC_KEY = 'qoen1dlJfM5Mf1KUR';

/**
 * Genera el contenido del reporte diario en formato HTML para email
 */
const generateEmailReportHTML = (register: DailyRegister): string => {
  console.log('📧 Generando email para storeId:', register.storeId);
  const storeName = STORES.find(s => s.id === register.storeId)?.label || register.storeId;
  console.log('📧 Store name encontrado:', storeName);
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
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Fecha: ${new Date(register.date).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
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
              <span class="metric-value">${formatCurrency(register.qrPayments || 0)}</span>
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
              Cerrado: ${register.closedAt ? new Date(register.closedAt).toLocaleString('es-CO') : 'N/A'}
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
 * Envía el reporte diario por correo electrónico usando EmailJS
 */
export const sendDailyReportEmail = async (
  register: DailyRegister,
  recipientEmail: string,
  recipientName: string = 'Gerente'
): Promise<void> => {
  try {
    const storeName = STORES.find(s => s.id === register.storeId)?.label || register.storeId;
    const htmlContent = generateEmailReportHTML(register);

    const templateParams = {
      to_email: recipientEmail,
      to_name: recipientName,
      subject: `Reporte Diario - ${storeName} - ${new Date(register.date).toLocaleDateString('es-CO')}`,
      store_name: storeName,
      date: new Date(register.date).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      html_content: htmlContent,
      from_name: 'Sistema de Gestión'
    };

    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    console.log('✅ Reporte enviado por correo a:', recipientEmail);
  } catch (error) {
    console.error('❌ Error al enviar correo:', error);
    throw new Error('No se pudo enviar el reporte por correo electrónico');
  }
};


/**
 * Envía el reporte diario por correo electrónico
 */
export const sendDailyReportNotifications = async (
  register: DailyRegister,
  config: {
    email?: { address: string; name?: string };
  }
): Promise<{ emailSent: boolean }> => {
  const results = {
    emailSent: false
  };

  // Enviar por correo si está configurado
  if (config.email?.address) {
    try {
      await sendDailyReportEmail(register, config.email.address, config.email.name);
      results.emailSent = true;
    } catch (error) {
      console.error('Error al enviar correo:', error);
    }
  }

  return results;
};
