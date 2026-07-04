import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cors());

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

app.post('/api/send-email', async (req, res) => {
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
    console.log(`Email enviado a: ${to} | Asunto: ${subject}`);
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

const INSIGHTS_SYSTEM_PROMPT = `Eres un analista financiero que redacta resúmenes ejecutivos para socios e inversionistas de una cadena de tiendas de accesorios de celulares en Colombia.
Recibirás datos financieros YA CALCULADOS. No debes hacer ningún cálculo propio ni inventar cifras que no se te den — tu trabajo es EXPLICAR e INTERPRETAR esos números en español, con un tono profesional y claro, orientado a personas que no revisan el detalle operativo día a día.
Usa formato de moneda colombiana (COP) al mencionar cifras, tal como vienen en los datos. Si algún dato no está presente, no lo menciones ni lo asumas.
Si los datos incluyen "periodoCerrado": true, el período analizado ya terminó: NO hagas proyecciones ni estimaciones futuras en ninguna sección. En el campo "proyecciones" escribe únicamente: "Período cerrado — no aplican proyecciones." y en las demás secciones habla solo en pasado sobre los resultados del período.
Si los datos incluyen "ventasDomingosAccell", los domingos son un día clave para la tienda accell.com (opera con doble turno y cierre de caja al medio día): dedica en "diasDestacados" un comentario específico al desempeño de los domingos de accell.com, comparándolo con el promedio de los demás días según las cifras dadas.`;

app.post('/api/generate-executive-insights', async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY no configurada en el servidor' });
  }

  const data = req.body;
  if (!data || typeof data !== 'object') {
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
