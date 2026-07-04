# Guía de Administración - DistriAccell Gestión

## 1. Limpiar la Base de Datos

Para limpiar completamente la base de datos y empezar de cero, tienes dos opciones:

### Opción A: Desde Firebase Console (Recomendado)

1. Accede a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona el proyecto: **distriaccell-gestion**
3. Ve a **Firestore Database**
4. Elimina manualmente las colecciones que desees limpiar:
   - `users` - Usuarios del sistema
   - `employees` - Empleados
   - `employeePayments` - Pagos de empleados
   - `dailyRegisters` - Registros diarios
   - `suppliers` - Proveedores
   - `supplierTransactions` - Transacciones de proveedores
   - `savingsWithdrawals` - Retiros de ahorros
   - `settings` - Configuración

### Opción B: Usando Script Programático

Puedes usar el script de limpieza incluido en el proyecto. Para ejecutarlo:

1. Accede a la consola del navegador (F12)
2. En la aplicación, importa y ejecuta:

```javascript
import { clearDatabase } from './utils/clearDatabase';
await clearDatabase();
```

**ADVERTENCIA**: Esta operación es irreversible. Asegúrate de hacer un respaldo antes de proceder.

---

## 2. Crear el Primer Usuario Administrador

Después de limpiar la base de datos, necesitas crear el primer usuario super-admin:

### Pasos:

1. Accede a la URL de configuración inicial:
   ```
   https://administracion.distriaccell.com/?setup
   ```

2. Completa el formulario con los datos del administrador:
   - **Nombre completo**: Nombre del administrador
   - **Correo electrónico**: Email que se usará para login
   - **Contraseña**: Mínimo 6 caracteres

3. Haz clic en **"Crear Administrador"**

4. El sistema creará:
   - Usuario en Firebase Authentication
   - Documento en Firestore con rol `super-admin`

5. Serás redirigido automáticamente al Dashboard

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

**Importante**: Firebase Firestore tiene respaldo automático, pero recomendamos:

1. Exportar datos periódicamente desde Firebase Console
2. Descargar reportes importantes
3. Mantener documentación de usuarios y roles

---

## 6. Comandos Útiles para el Servidor

### Ver logs de la aplicación:
```bash
cd /root/distriaccell_gestion
docker logs distriaccell-frontend -f
```

### Reiniciar la aplicación:
```bash
docker compose restart
```

### Actualizar la aplicación:
```bash
docker compose up -d --build
```

### Detener la aplicación:
```bash
docker compose down
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
- **Modo setup (crear primer admin)**: https://administracion.distriaccell.com/?setup
- **Firebase Console**: https://console.firebase.google.com/project/distriaccell-gestion

---

## Soporte

Para soporte adicional:
- Revisa los logs de la aplicación
- Consulta la documentación de Firebase
- Contacta al desarrollador del sistema

---

**Última actualización**: 8 de Enero de 2026
