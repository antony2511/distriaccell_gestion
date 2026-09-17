# Guía de Administración - DistriAccell Gestión

## 1. Base de Datos en Producción

La aplicación trabaja **directamente sobre la base de datos real** (proyecto Firebase `distriaccell-gestion`). No existe entorno de pruebas ni emulador: cualquier dato que se escriba desde la app es dato de producción.

Las herramientas de "limpiar base de datos", "inicializar con datos de ejemplo" (`?initdb`) y "crear primer administrador" (`?setup`) que existían en versiones anteriores **fueron eliminadas** en septiembre de 2026: sobreescribían tiendas, empleados y usuarios reales con datos de ejemplo, y la pantalla `?setup` permitía a cualquiera con la URL crearse un usuario super-admin sin iniciar sesión.

Si algún día hace falta borrar o restaurar datos, hacerlo desde [Firebase Console](https://console.firebase.google.com/project/distriaccell-gestion/firestore) y **siempre con un respaldo previo** (ver sección de respaldos más abajo).

---

## 2. Usuario Administrador

Ya existe un usuario super-admin. Los demás usuarios (administradores de tienda, cajeros, técnicos) se crean desde la propia aplicación en el menú **Usuarios** (ver sección 3). No hay ninguna URL especial para crear administradores.

---

## 3. Gestión de Usuarios del Sistema

Una vez iniciado sesión como super-admin, puedes gestionar usuarios del sistema:

### Acceder al Panel de Usuarios

1. Inicia sesión en la aplicación
2. En el menú lateral izquierdo, verás la opción **"Usuarios"** (solo visible para super-admin)
3. Haz clic en **"Usuarios"**

### Crear Nuevo Usuario

1. En el panel de Usuarios, haz clic en **"+ Nuevo Usuario"**
2. Completa el formulario:
   - **Nombre completo**: Nombre del usuario
   - **Correo electrónico**: Email único para login
   - **Contraseña**: Mínimo 6 caracteres
   - **Rol**: Selecciona el rol apropiado:
     - **Super Admin**: Acceso total al sistema
     - **Administrador**: Gestión de operaciones y reportes
     - **Cajero**: Registro de ventas y operaciones diarias
     - **Técnico**: Registro de servicios técnicos
     - **Consulta**: Solo lectura
   - **Tienda**: Asigna al usuario a una tienda:
     - Almacén 1
     - Almacén 2
     - Ambos (solo para super-admin)

3. Haz clic en **"Crear Usuario"**

### Editar Usuario Existente

1. En la tabla de usuarios, haz clic en **"Editar"** junto al usuario
2. Modifica los campos necesarios:
   - Nombre
   - Rol
   - Tienda
   - Estado (Activo/Inactivo)
3. Haz clic en **"Actualizar"**

**Nota**: El correo electrónico no se puede modificar una vez creado el usuario.

### Activar/Desactivar Usuario

1. En la tabla de usuarios, haz clic en **"Desactivar"** o **"Activar"**
2. Los usuarios inactivos no podrán iniciar sesión

### Filtrar Usuarios

Utiliza los filtros disponibles:
- **Por Rol**: Filtra por tipo de usuario
- **Por Estado**: Muestra solo activos o inactivos

---

## 4. Roles y Permisos

### Matriz de Permisos

| Rol | Permisos |
|-----|----------|
| **Super Admin** | Acceso total al sistema, gestión de usuarios, configuración |
| **Administrador** | Gestión de operaciones, empleados, reportes, registro diario |
| **Cajero** | Registro diario, reportes básicos |
| **Técnico** | Ver sus propias comisiones |
| **Consulta** | Solo lectura de información |

### Funcionalidades por Rol

#### Super Admin
- ✅ Gestión de usuarios del sistema
- ✅ Gestión de empleados
- ✅ Configuración del sistema
- ✅ Todas las funcionalidades

#### Administrador
- ✅ Registro diario de operaciones
- ✅ Gestión de empleados
- ✅ Ver reportes y análisis
- ✅ Gestión de proveedores
- ❌ Gestión de usuarios del sistema
- ❌ Configuración del sistema

#### Cajero
- ✅ Registro diario de operaciones
- ✅ Reportes básicos
- ❌ Gestión de empleados
- ❌ Configuración

#### Técnico
- ✅ Ver sus comisiones
- ❌ Acceso limitado

#### Consulta
- ✅ Solo lectura
- ❌ No puede modificar datos

---

## 5. Mantenimiento y Seguridad

### Recomendaciones de Seguridad

1. **Contraseñas Seguras**:
   - Usa contraseñas de al menos 8 caracteres
   - Combina letras, números y símbolos
   - No uses la misma contraseña para múltiples usuarios

2. **Roles Apropiados**:
   - Asigna solo los permisos necesarios
   - No crees múltiples super-admins innecesariamente

3. **Revisión Periódica**:
   - Revisa regularmente la lista de usuarios activos
   - Desactiva usuarios que ya no necesiten acceso

4. **Auditoría**:
   - Revisa el campo "Último acceso" de cada usuario
   - Identifica cuentas inactivas

### Respaldo de Datos

**Importante**: Firestore **no** guarda copias automáticas salvo que se active la recuperación a un punto en el tiempo (PITR) en Google Cloud. Por eso:

1. En el servidor hay un script que descarga todas las colecciones a JSON: `node /root/backup_firestore.mjs` (deja una carpeta con fecha en `/root/backups/`). Usa la sesión ya autenticada de `firebase-tools`, no pide credenciales. Correrlo **antes de cualquier cambio masivo de datos** y, como mínimo, una vez al mes.
2. Guardar una copia de `/root/backups/` fuera del servidor de vez en cuando (descargarla o subirla a Drive).
3. Mantener documentación de usuarios y roles.

---

## 6. Comandos Útiles para el Servidor

La app es un sitio estático servido por **nginx** desde `/var/www/distriaccell`. (Existen un `docker-compose.yml` y contenedores `distriaccell-frontend`/`backend` con etiquetas de Traefik, pero **no reciben tráfico**: son de un montaje anterior que quedó huérfano. No los uses.)

### Publicar cambios del frontend
```bash
cd /root/distriaccell_gestion
npm run build
rsync -a --delete dist/ /var/www/distriaccell/
```
El `--delete` importa: si no, `/var/www/distriaccell` acumula los bundles de todas las versiones anteriores. No hace falta reiniciar nada; el navegador toma la versión nueva al recargar.

### Servidor de correos y análisis con IA
Es un proceso aparte (`server/server.js`) gestionado por PM2. Reiniciarlo **solo** si se cambió ese archivo:
```bash
pm2 restart distriaccell-email
pm2 logs distriaccell-email --lines 50   # ver qué está haciendo
```

### Verificar que todo responde
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://administracion.distriaccell.com/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3010/api/health
```

---

## 7. Solución de Problemas

### No puedo crear usuarios

**Problema**: Error al crear usuario

**Soluciones**:
1. Verifica que el correo no esté ya registrado
2. Asegúrate de que la contraseña tenga al menos 6 caracteres
3. Verifica la conexión a internet
4. Revisa los logs en la consola del navegador (F12)

### No veo el menú de Usuarios

**Problema**: El menú "Usuarios" no aparece

**Solución**: Solo el rol `super-admin` puede ver y acceder a la gestión de usuarios.

### Error de permisos

**Problema**: "Acceso Denegado"

**Solución**: Tu cuenta no tiene los permisos necesarios. Contacta al super-admin para que actualice tu rol.

---

## 8. URLs Importantes

- **Aplicación principal**: https://administracion.distriaccell.com
- **Firebase Console**: https://console.firebase.google.com/project/distriaccell-gestion

---

## 9. Fuentes e íconos

Desde septiembre de 2026 las fuentes (**Inter** y **Material Symbols**) se sirven desde el propio dominio, no desde Google. Antes venían de `fonts.googleapis.com` y, cuando esa red fallaba o estaba bloqueada, la regla que define los íconos no llegaba y cada ícono se veía como su nombre en texto: "dashboard", "storefront", "account_balance".

Los archivos están en `src/fonts/` y el build los versiona igual que el resto de los assets.

**La fuente de íconos viene recortada** a los que usa la app (96 kB en vez de ~4 MB del set completo). Por eso, **si agregás un ícono nuevo** en el código (`<span className="material-symbols-outlined">nombre_del_icono</span>`), hay que regenerarla o ese ícono saldrá invisible:

```bash
cd /root/distriaccell_gestion
node scripts/icon-font.mjs            # verifica que no falte ninguno
node scripts/icon-font.mjs --update   # la regenera con los íconos que usa la app
npm run build                          # y luego el deploy de siempre
```

El script lee los nombres directamente del código (texto del span, prop `icon=`, y los mapas `*_ICONS`), así que no hay que mantener ninguna lista a mano.

---

## 10. Cómo se calcula cada número

Desde septiembre de 2026 **todas las pantallas leen las mismas fórmulas** (`src/utils/periodSummary.ts` → `resumirRegistros()`), así que un mismo nombre significa siempre lo mismo. Si dos pantallas muestran valores distintos para el mismo nombre y el mismo rango, es un error: reportarlo.

### Diccionario de métricas

| Nombre en pantalla | Fórmula | Qué significa |
|---|---|---|
| **Ventas** | ventas del sistema POS + ventas del cuaderno + servicios técnicos | Todo lo vendido, sin importar cómo pagó el cliente (efectivo, QR, tarjeta o crédito). |
| **Banco** (QR / Transferencia / Tarjeta) | Σ pagos registrados en el bloque QR | Parte de las **Ventas** que entró a la cuenta bancaria en vez de al cajón. **Ya está incluido en Ventas**: nunca se suma encima. |
| **Crédito financiado** | Σ parte de las ventas a crédito que no llegó al cajón | Con abono en efectivo: precio de venta − abono. Con abono por transferencia: el precio de venta completo. También está dentro de **Ventas**. |
| **Efectivo recibido** | Ventas − Banco − Crédito financiado | Lo que entró físicamente al cajón antes de gastos. |
| **Gastos** | Σ gastos del registro diario | Gastos operativos pagados desde la caja. |
| **Ahorro apartado** | Σ ahorro diario | Plata que se sacó del cajón y se guardó aparte. **Sigue siendo del negocio**: no es un gasto. |
| **Utilidad** | **Ventas − Gastos** | Resultado del período. **El ahorro NO se resta** (decisión del dueño, sept 2026). |
| **Caja esperada** | Efectivo recibido − Gastos − Ahorro | Lo que debía quedar en el cajón al cerrar. Es el mismo número contra el que se hace el arqueo del cierre diario. |
| **Diferencia** (cierre) | Efectivo contado − Caja esperada | Positiva = sobró, negativa = faltó. |

### Períodos

Los botones **7 días / Mes / Año** son iguales en todas las pantallas (`src/utils/periods.ts`):

- **7 días** = los últimos 7 días calendario, hoy incluido (no la semana lunes–domingo). Se compara con los 7 días inmediatamente previos.
- **Mes** = mes calendario en curso. Se compara con el **mismo tramo del mes anterior** (del 1 al mismo día). Antes se comparaba contra el mes pasado completo, y a mitad de mes las ventas siempre parecían "bajar".
- **Año** = año calendario en curso. Se compara con el mismo tramo del año anterior (1 de enero a la misma fecha).
- **Reporte Ejecutivo** con rango personalizado: se compara con el mismo número de días inmediatamente anteriores.

Cada pantalla dice explícitamente contra qué tramo compara (p. ej. "vs mismo tramo del mes anterior (1 al 17 de agosto)").

**Todas las tiendas** siempre significa **solo las tiendas activas**. Si un registro tiene una tienda inactiva o mal escrita, no se cuenta y aparece un aviso en la consola del navegador (F12).

### Qué muestra cada pantalla

| Pantalla | Fuente | Qué usa |
|---|---|---|
| **Dashboard** | registros del período (7 días / mes / año) | Ventas, Banco, Gastos, Ahorro apartado, Utilidad, con tendencia vs. período anterior. |
| **Registro Diario** | un registro de un día y una tienda | El cierre calcula **Caja esperada** y la compara con el efectivo contado. |
| **Balance General → Caja General** | arqueos cerrados desde el último cierre mensual + retiros | Balance disponible = lo que quedó del cierre mensual + Σ efectivo contado en cierres diarios − retiros. Solo efectivo físico. |
| **Balance General → Gestión del Negocio** | registros del período | Ventas, Efectivo recibido, Banco, Gastos, Ahorro, Utilidad por tienda. Informativo, no toca la caja. |
| **Gastos y Ahorro** | registros del período | Gastos por categoría vs. presupuesto, Utilidad, ahorro acumulado y retiros de ahorro. |
| **Cierres Diarios** | rango de fechas elegido | Caja esperada por día y por tienda; detalle completo de cada registro (ventas, QR, gastos, arqueo). |
| **Reportes** | registros del período + 6 meses | Ventas, Gastos, Utilidad, evolución, distribución de ventas (Sistema POS + cuaderno + servicios = Ventas), análisis y tendencia de gastos. |
| **Reporte Ejecutivo** | rango elegido + mes en curso | Ventas por tienda y por día, Gastos, Ahorro, Retiros, Utilidad, proyección del mes, mejores/peores días, domingos accell, análisis con IA. |
| **Crédito Celulares** | ventas a crédito del rango / del mes | Cupo mensual consumido (sobre el **costo** del equipo), abonos, por cobrar a la financiera, ganancia (margen + 8 % de financiación). |

### Ventas a crédito (celulares / tablet)

- El cajero registra el **precio de venta completo** en ventas del sistema el día de la venta.
- Al precio se le suma un recargo del **10 %**: **8 %** queda para la tienda (comisión de financiación) y **2 %** lo retiene la financiera.
- Ganancia de la tienda = (precio de venta − precio de compra) + 8 % del precio de venta. No depende del abono.
- El abono **no** se registra además en el bloque QR: el apartado de crédito ya lo descuenta del cajón según cómo se pagó.

### Comisiones por ventas (empleados)

- Tasa base manual por empleado. Por cada bloque completo de $4.000.000 por encima de la meta de la tienda, **ese bloque** paga +0,1 % (progresivo por tramos; lo ya ganado no se recalcula).
- Metas: Distriaccell (almacen-1) $15.000.000 · accell.com (almacen-2) $33.000.000 · empleado con varias tiendas: base fija $45.000.000.
- Desde julio de 2026 los servicios técnicos no comisionan para el rol `vendedor` (sí para `administrador`).

### Verificación automática

Las fórmulas están cubiertas por tests (`npm test`). Antes de cambiar cualquier cálculo, correrlos; si un test falla después de un cambio, el cambio alteró un número que el negocio ya validó.

---

## 11. Soporte

Para soporte adicional:
- Revisa los logs de la aplicación
- Consulta la documentación de Firebase
- Contacta al desarrollador del sistema

---

**Última actualización**: 8 de Enero de 2026
