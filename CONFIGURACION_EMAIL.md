# 📧 Configuración de Notificaciones por Email

Este documento explica cómo configurar el envío automático de reportes diarios por **correo electrónico** cuando se cierra el registro del día.

## 🎯 Funcionalidad

Cuando un administrador cierra el registro diario:
1. ✅ El sistema guarda el registro en Firebase
2. 📧 **Envía automáticamente un reporte completo por correo electrónico al gerente**

---

## 🔧 Configuración de EmailJS

### Paso 1: Crear cuenta en EmailJS

1. Ve a [https://www.emailjs.com/](https://www.emailjs.com/)
2. Crea una cuenta gratuita
   - ✅ **Plan gratuito:** 200 emails por mes
   - ✅ Sin tarjeta de crédito
3. Verifica tu correo electrónico

### Paso 2: Configurar el servicio de email

1. En el dashboard de EmailJS, ve a **"Email Services"**
2. Haz clic en **"Add New Service"**
3. Selecciona tu proveedor de email:
   - **Gmail** (recomendado)
   - Outlook
   - Yahoo
   - Otro proveedor SMTP
4. Sigue las instrucciones para conectar tu cuenta:
   - Para Gmail, autoriza el acceso
   - Para otros, proporciona credenciales SMTP
5. Una vez conectado, copia el **Service ID**
   - Ejemplo: `service_abc123`

### Paso 3: Crear plantilla de email

1. Ve a **"Email Templates"** en EmailJS
2. Haz clic en **"Create New Template"**
3. Configura la plantilla con los siguientes campos:

#### Subject (Asunto):
```
Reporte Diario - {{store_name}} - {{date}}
```

#### Body (Cuerpo - HTML):
```html
{{{html_content}}}
```

#### Settings (Configuración):
- **To Email:** `{{to_email}}`
- **To Name:** `{{to_name}}`
- **From Name:** `{{from_name}}`
- **From Email:** Tu email (ejemplo: `noreply@distriaccell.com`)
- **Reply To:** Tu email de soporte

4. Guarda la plantilla y copia el **Template ID**
   - Ejemplo: `template_xyz789`

### Paso 4: Obtener Public Key

1. Ve a **"Account" > "General"**
2. En la sección **"API Keys"**, copia tu **Public Key**
   - Ejemplo: `abc123XYZ`

### Paso 5: Actualizar credenciales en el código

1. Abre el archivo `src/services/notification.service.ts`
2. Actualiza las siguientes constantes con tus credenciales:

```typescript
// Configuración de EmailJS
const EMAILJS_SERVICE_ID = 'service_abc123'; // Tu Service ID
const EMAILJS_TEMPLATE_ID = 'template_xyz789'; // Tu Template ID
const EMAILJS_PUBLIC_KEY = 'abc123XYZ'; // Tu Public Key
```

3. Guarda el archivo

---

## 🎨 Configuración en la Interfaz

Una vez que hayas configurado EmailJS en el código:

1. Inicia sesión como **super-admin (gerente)**
2. Ve a **"Configuración"** en el sidebar (ícono de engranaje)
3. Completa los datos:
   - ✅ **Activar notificaciones automáticas** (switch principal)
   - 📧 **Nombre del gerente:** Ejemplo: "Juan Pérez"
   - 📧 **Correo electrónico:** Ejemplo: "gerente@distriaccell.com"
4. Haz clic en **"Guardar Configuración"**

---

## 📊 Formato del Reporte por Email

El email que recibirá el gerente incluye:

### Diseño HTML Profesional
- ✅ Encabezado con gradiente de color
- ✅ Secciones bien organizadas
- ✅ Colores diferenciados por tipo de dato
- ✅ Formato responsive (se ve bien en móvil)

### Contenido del Reporte

**1. Resumen Financiero**
- Ingresos Totales (en verde)
- Gastos Totales (en rojo)
- Ahorro del Día (en naranja)
- Balance Neto (color según resultado)

**2. Detalle de Ingresos**
- Ventas del Sistema POS
- Ventas del Cuaderno
- Servicios Técnicos
- Pagos por QR

**3. Servicios Técnicos Realizados**
- Lista completa de servicios
- Técnico responsable
- Modelo del dispositivo
- Monto de cada servicio

**4. Balance de Caja**
- Efectivo Esperado
- Efectivo Contado
- Diferencia
- Justificación (si hay diferencia)

**5. Información de Cierre**
- Registrado por
- Fecha y hora de cierre

---

## 🧪 Probar las Notificaciones

### Prueba Completa

1. Como **administrador** de un almacén (no gerente):
   - Ve a **"Registro Diario"**
   - Completa algunos datos de prueba:
     - Ventas del cuaderno
     - Servicios técnicos
     - Gastos
   - Ingresa el **ahorro del día**
   - Haz clic en **"Cerrar Día"**
   - Ingresa el **efectivo contado**
   - Confirma el cierre

2. Verifica tu bandeja de entrada:
   - ✅ Deberías recibir un email con el reporte completo
   - ✅ El asunto será: "Reporte Diario - [Nombre del Almacén] - [Fecha]"
   - ✅ El contenido mostrará todos los detalles del día

### Verificar en la Consola del Navegador

Abre las DevTools (F12) y ve a la consola:
- ✅ Deberías ver: `✅ Reporte enviado por email: { emailSent: true }`
- ❌ Si hay error: `⚠️ Error al enviar email (no crítico): [error]`

---

## ❓ Troubleshooting (Solución de Problemas)

### Email no llega

**1. Verifica las credenciales:**
- ✅ Service ID correcto
- ✅ Template ID correcto
- ✅ Public Key correcto

**2. Revisa la configuración en EmailJS:**
- ✅ El servicio de email está conectado
- ✅ La plantilla está guardada correctamente
- ✅ Los campos `{{to_email}}` y `{{{html_content}}}` están configurados

**3. Verifica el email del gerente:**
- ✅ El email está bien escrito
- ✅ No tiene espacios adicionales
- ✅ Es un email válido

**4. Revisa la cuota de EmailJS:**
- ✅ Verifica que no hayas superado los 200 emails/mes
- ✅ Ve a tu dashboard de EmailJS para ver el contador

**5. Chequea la consola del navegador:**
- ✅ Busca mensajes de error detallados
- ✅ Si dice "CORS error", verifica la configuración de EmailJS
- ✅ Si dice "Invalid credentials", revisa tus keys

### Email llega a spam

**Solución:**
1. En EmailJS, verifica que el "From Email" sea válido
2. Marca el email como "No es spam" en tu bandeja
3. Considera usar un dominio personalizado en EmailJS

### Error: "Failed to send email"

**Solución:**
1. Verifica tu conexión a internet
2. Abre EmailJS dashboard para ver si el servicio está activo
3. Revisa los logs de EmailJS para más detalles

### Notificaciones no se activan

**Solución:**
1. Verifica que hayas guardado la configuración en la interfaz
2. Asegúrate de que el switch "Activar notificaciones" esté encendido
3. Revisa que el email del gerente esté configurado
4. Ve a la colección `settings` en Firebase y verifica los datos

---

## 🔒 Seguridad

### ⚠️ Importante para Producción

Las credenciales de EmailJS están actualmente **hardcodeadas en el cliente**. Esto significa que cualquiera que inspeccione el código puede ver tus keys.

**Para mayor seguridad, se recomienda:**

1. **Usar Firebase Cloud Functions:**
   - Mover las credenciales al backend
   - Llamar a una Cloud Function desde el cliente
   - Las credenciales nunca se exponen

2. **Ejemplo de Cloud Function:**

```javascript
// functions/index.js
const functions = require('firebase-functions');
const emailjs = require('@emailjs/nodejs');

exports.sendDailyReport = functions.https.onCall(async (data, context) => {
  // Verificar autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Usuario no autenticado'
    );
  }

  const { register, recipientEmail, recipientName } = data;

  // Credenciales seguras en el servidor
  await emailjs.send(
    process.env.EMAILJS_SERVICE_ID,
    process.env.EMAILJS_TEMPLATE_ID,
    {
      to_email: recipientEmail,
      to_name: recipientName,
      html_content: generateReport(register)
    },
    {
      publicKey: process.env.EMAILJS_PUBLIC_KEY
    }
  );

  return { success: true };
});
```

3. **Llamar la Cloud Function desde el cliente:**

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const sendReport = httpsCallable(functions, 'sendDailyReport');

await sendReport({
  register: dailyRegister,
  recipientEmail: email,
  recipientName: name
});
```

---

## 📖 Recursos

- **EmailJS Documentation:** [https://www.emailjs.com/docs/](https://www.emailjs.com/docs/)
- **EmailJS Dashboard:** [https://dashboard.emailjs.com/](https://dashboard.emailjs.com/)
- **Firebase Functions Docs:** [https://firebase.google.com/docs/functions](https://firebase.google.com/docs/functions)

---

## 🎉 ¡Listo!

Una vez configurado correctamente:

1. ✅ Cada cierre de día envía un email automáticamente
2. ✅ El gerente recibe un reporte completo en HTML
3. ✅ Sin necesidad de intervención manual
4. ✅ 200 emails gratis al mes con EmailJS
5. ✅ Formato profesional y fácil de leer

**Ventajas de usar solo Email:**
- ✅ Configuración más simple (sin servidores adicionales)
- ✅ Completamente gratuito hasta 200 emails/mes
- ✅ Registro de todos los emails enviados en EmailJS
- ✅ Compatible con cualquier proveedor de email
- ✅ No requiere WhatsApp ni números telefónicos

¡Disfruta de tu sistema automatizado! 🚀
