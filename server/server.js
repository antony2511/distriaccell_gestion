import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import crypto from 'node:crypto';

const app = express();
app.use(express.json({ limit: '2mb' }));
// La app se sirve desde el mismo dominio (nginx → /api/), no hace falta CORS abierto
app.use(cors({ origin: ['https://administracion.distriaccell.com', 'http://localhost:5173'] }));

// ── Autenticación: solo usuarios con sesión de Firebase en distriaccell-gestion ──
// Antes /api/send-email y /api/generate-executive-insights respondían a cualquiera
// en internet (correo desde la cuenta SMTP y gasto de OpenAI). Se verifica el ID
// token de Firebase (JWT RS256) con las llaves públicas de Google, sin dependencias.
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'distriaccell-gestion';
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certsCache = { certs: null, expiresAt: 0 };

const getGoogleCerts = async () => {
  if (certsCache.certs && Date.now() < certsCache.expiresAt) return certsCache.certs;
  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) throw new Error(`No se pudieron obtener las llaves de Google (${res.status})`);
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1] || 3600);
  certsCache = { certs: await res.json(), expiresAt: Date.now() + maxAge * 1000 };
  return certsCache.certs;
};

const b64urlJson = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

export const verifyFirebaseIdToken = async (token) => {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('token mal formado');
  const header = b64urlJson(parts[0]);
  const payload = b64urlJson(parts[1]);
  if (header.alg !== 'RS256') throw new Error('algoritmo inválido');
  const cert = (await getGoogleCerts())[header.kid];
  if (!cert) throw new Error('llave desconocida');
  const ok = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    crypto.createPublicKey(cert),
    Buffer.from(parts[2], 'base64url')
  );
  if (!ok) throw new Error('firma inválida');
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== FIREBASE_PROJECT_ID) throw new Error('audiencia inválida');
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) throw new Error('emisor inválido');
  if (!payload.sub) throw new Error('sin usuario');
  if (typeof payload.exp !== 'number' || payload.exp < now - 60) throw new Error('token vencido');
  if (typeof payload.iat !== 'number' || payload.iat > now + 300) throw new Error('token del futuro');
  return payload;
};

const requireAuth = async (req, res, next) => {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return res.status(401).json({ error: 'Inicia sesión para usar esta función' });
  try {
    req.user = await verifyFirebaseIdToken(m[1]);
    next();
  } catch (err) {
    console.warn(`Acceso rechazado a ${req.path}: ${err.message}`);
    res.status(401).json({ error: 'Sesión inválida o vencida. Vuelve a iniciar sesión.' });
  }
};

const {
  SMTP_HOST,
  SMTP_PORT = '587',
  SMTP_SECURE = 'false',
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  OPENAI_API_KEY,
  OPENAI_MODEL = 'gpt-4o-mini',
} = process.env;

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.error('ERROR: Faltan variables de entorno SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS)');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.warn('Advertencia: OPENAI_API_KEY no configurada — el análisis con IA del reporte ejecutivo no funcionará (el envío de emails no se ve afectado).');
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: parseInt(SMTP_PORT),
  secure: SMTP_SECURE === 'true',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error('Error al verificar conexión SMTP:', error.message);
  } else {
    console.log('Conexión SMTP verificada correctamente');
  }
});

app.post('/api/send-email', requireAuth, async (req, res) => {
  const { to, subject, html } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Faltan campos requeridos: to, subject, html' });
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM || `Distriaccell <${SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`Email enviado a: ${to} | Asunto: ${subject} | Por: ${req.user.email || req.user.sub}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error al enviar email:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── Análisis ejecutivo con IA ────────────────────────────────────────────────
// GPT solo redacta/interpreta los números que ya vienen calculados en el
// payload — nunca se le pide que calcule ni invente cifras.
const INSIGHTS_SCHEMA = {
  name: 'reporte_ejecutivo',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      resumenGeneral: { type: 'string' },
      analisisTendencias: { type: 'string' },
      proyecciones: { type: 'string' },
      diasDestacados: { type: 'string' },
      recomendaciones: { type: 'string' },
    },
    required: ['resumenGeneral', 'analisisTendencias', 'proyecciones', 'diasDestacados', 'recomendaciones'],
    additionalProperties: false,
  },
};

const INSIGHTS_SYSTEM_PROMPT = `Eres un analista financiero que redacta resúmenes ejecutivos para los socios de una cadena de tiendas de accesorios de celulares en Colombia.
Recibirás datos financieros YA CALCULADOS. Tu trabajo es EXPLICAR e INTERPRETAR esos números en español, con tono profesional, neutral y claro, para personas que no revisan el detalle operativo.

Reglas sobre las cifras:
- Usa SOLO cifras que aparezcan en los datos, en pesos colombianos (COP) y tal como vienen. No calcules sumas, restas, promedios ni porcentajes nuevos. Si un dato no está, no lo menciones ni lo supongas.
- Fechas: cuando hables de un día usa el campo "dia" que viene junto a la fecha (p. ej. "sáb 11 oct"). Nunca deduzcas tú el día de la semana.
- Los promedios diarios cuentan solo días cerrados y en que la tienda abre. "promedioUltimos7DiasDelPeriodo" es de los últimos 7 días DEL PERÍODO analizado, no de la semana actual.
- Respeta "notaHorarios": que una tienda que no abre los domingos no venda un domingo es normal, no lo presentes como una caída.

Tono:
- Sé equilibrado: menciona con la misma claridad lo que mejoró y lo que empeoró (tiendas con "variacionVentasPct" negativa, gastos que suben más que las ventas, "gastosSobreVentasPct" alto). No exageres ni uses adjetivos de celebración.
- "utilidadPeriodo" es ventas menos gastos del cierre diario; no incluye nómina, proveedores ni otros retiros de caja (vienen aparte en "otrasSalidas"). No la llames ganancia neta.

Secciones:
- resumenGeneral: ventas, gastos y utilidad del período y su variación frente a "comparacionPeriodoAnterior" (nombra el período anterior con "periodoAnterior").
- analisisTendencias: comportamiento por tienda usando "porTienda" (ventas, variación, gastos sobre ventas, promedio por día trabajado) y los promedios.
- proyecciones: si los datos incluyen "periodoCerrado": true, escribe únicamente "Período cerrado — no aplican proyecciones." y en las demás secciones habla en pasado. Si no, presenta "proyeccionCierreMes" y "proyeccionPorTienda" como estimaciones: menciona el rango entre "rangoConservador" y "rangoOptimista" y, si la "confianza" es "media" o "baja", advierte que la cifra puede moverse bastante. Nunca la presentes como un resultado seguro.
- diasDestacados: mejores y peores días con su "dia" y qué tiendas vendieron (campo "porTienda"). Si hay "ventasDomingosAccell", resume los domingos de accell.com: distingue la venta de la tarde MEDIDA ("tardeMedida": true, "ventasTarde") de la ESTIMADA ("aporteTardeEstimado") y aclara cuál es cuál; menciona el "acumuladoDesdeElCambio". Si algún domingo vendió poco, dilo.
- recomendaciones: 2 a 4 acciones concretas que se desprendan directamente de los datos (uso interno).`;

app.post('/api/generate-executive-insights', requireAuth, async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY no configurada en el servidor' });
  }

  const data = req.body;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'Datos del reporte inválidos' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: INSIGHTS_SYSTEM_PROMPT },
          { role: 'user', content: `Datos del reporte ejecutivo:\n${JSON.stringify(data, null, 2)}\n\nGenera las 5 secciones del análisis.` },
        ],
        response_format: { type: 'json_schema', json_schema: INSIGHTS_SCHEMA },
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Error de OpenAI:', response.status, errText);
      return res.status(502).json({ error: 'Error al generar el análisis con IA' });
    }

    const completion = await response.json();
    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(502).json({ error: 'Respuesta vacía de OpenAI' });
    }

    const insights = JSON.parse(content);
    res.json(insights);
  } catch (error) {
    console.error('Error al generar insights ejecutivos:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor de email corriendo en puerto ${PORT}`));
