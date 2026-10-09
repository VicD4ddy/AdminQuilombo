# 🇦🇷 El Quilombo • App de Control de Acceso y Escáner QR

Aplicación web progresiva (PWA) de alta velocidad para el personal y administradores de **El Quilombo** en la puerta de **Rock & Riff** (La Viña, Valencia). Permite escanear códigos QR de boletos digitales, buscar asistentes al instante, validar cobros en taquilla y dar acceso con prevención de reingreso duplicado.

---

## ⚡ Características Principales

1. **🔐 Acceso Seguro con PIN:**
   - Teclado numérico táctil optimizado para móviles con la clave oficial: `5401385` (o botón de *Acceso Rápido Staff*).
   - Recuerda la sesión en el dispositivo para no pedirla en cada bloqueo de pantalla.

2. **📷 Escáner QR en Tiempo Real:**
   - Motor local de alto rendimiento (`html5-qrcode`) sin dependencias externas pesadas.
   - Visor HUD con animación láser y esquinas de enfoque neón.
   - Selector de cámara frontal / trasera y botón de linterna/flash para entradas oscuras.
   - **Subida de capturas:** Opción de cargar foto o captura de pantalla si la pantalla del cliente está rota o tenue.

3. **🔍 Búsqueda Rápida Ultra-Veloz:**
   - Permite validar la entrada tecleando los últimos números del boleto (ej: `6260`), la Cédula/DNI (ej: `32027336`) o el Nombre del asistente.

4. **🎟️ Modal Inteligente de Validación de Acceso:**
   - 🟢 **Acceso Permitido:** Muestra cantidad de personas en grande (ej: **2 PERSONAS**) y botón `🚀 DAR ACCESO`.
   - 🟡 **Pago en Puerta / Efectivo:** Detecta si la persona apartó entrada para pagar en taquilla, muestra monto exacto en `$ USD` y `Bs.` y botón `💵 REGISTRAR PAGO Y DAR ACCESO`.
   - 🔴 **Ticket Ya Utilizado:** Detecta si la entrada ya fue escaneada previamente, mostrando la hora exacta de ingreso para evitar duplicados.
   - 🚫 **Ticket Cancelado:** Advierte si la entrada fue dada de baja.

5. **📊 Panel de Métricas en Vivo:**
   - Aforo en sala (Personas que han ingresado).
   - Total de boletos emitidos.
   - Personas restantes por ingresar.
   - Total recaudado en efectivo/puerta.
   - Historial de los últimos ingresos con opción de deshacer en caso de error.

6. **⚡ Taquilla Express:**
   - Permite emitir y dar acceso inmediato a personas que compren directamente en puerta sin reserva previa.

7. **🔊 Sintetizador de Sonidos & Vibración Háptica:**
   - Chimes de confirmación positiva, campanilla de cobro, tonos de advertencia y vibración en teléfonos.

8. **📡 Modo Offline & Sincronización:**
   - Guarda los 207+ boletos en memoria local (`localStorage`), funcionando sin interrupciones incluso si falla la señal telefónica dentro del local.
   - Se sincroniza automáticamente con Supabase cada 12 segundos y al pulsar 🔄.

---

## 🚀 Cómo Iniciar la App

### Opción 1: En tu computadora (Windows)
1. Haz doble clic en el archivo `iniciar.bat` (o ejecuta `node server.js` en terminal).
2. Se abrirá automáticamente en tu navegador en [http://localhost:3000/](http://localhost:3000/).

### Opción 2: Usar en teléfonos en la puerta del evento (Red Local)
1. Conecta la computadora y los teléfonos al mismo WiFi (o crea un punto de acceso/zona WiFi con tu teléfono).
2. En la computadora abre la terminal y escribe `ipconfig` para ver tu dirección IP local (ej: `192.168.1.50`).
3. En el navegador del teléfono ingresa a `http://TU_IP:3000/` (ej: `http://192.168.1.50:3000/`).
4. Selecciona **"Agregar a pantalla de inicio"** para usarla como App nativa en pantalla completa.

### Opción 3: Despliegue en la nube (Gratis en Netlify o Vercel)
Como esta aplicación consta de archivos estáticos (`index.html`, `app.css`, `app.js`, `html5-qrcode.min.js`), puedes arrastrar esta carpeta completa a **Netlify Drop** ([app.netlify.com/drop](https://app.netlify.com/drop)) o subirla a GitHub y desplegarla con 1 clic para tener un enlace web accesible desde cualquier lugar (ej: `https://acceso-quilombo.netlify.app`).

---

## 🔑 Credenciales Configuradas
- **PIN de Administrador:** `5401385`
- **Proyecto Supabase:** `nyfjehadnrpszidlebeg.supabase.co`
- **Tabla:** `reservations`
