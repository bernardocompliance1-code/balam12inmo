# BALAM12 Inmobiliaria · Agenda — Instrucciones de instalación

App web instalable (PC y Android) con datos en tiempo real. Todo es gratuito: Firebase (plan Spark, sin tarjeta) + un hosting gratuito.

Contenido de la carpeta: `index.html`, `app.js`, `style.css`, `sw.js`, `manifest.webmanifest`, `icons/`, `firebase-config.js` (lo editas), `firestore.rules` (lo editas), `firebase.json`.

---

## PARTE 1 · Crear la base de datos en tiempo real (Firebase)

1. Entra a https://console.firebase.google.com con tu cuenta de Google → **Crear un proyecto** → nombre `balam12` → continúa (puedes desactivar Google Analytics).
2. **Compilación → Authentication → Comenzar → Google → Habilitar**. Elige tu correo como correo de asistencia → **Guardar**.
3. **Compilación → Firestore Database → Crear base de datos** → elige una región cercana (ej. `nam5` o `us-central`) → **Modo de producción** → Crear.
4. En Firestore, pestaña **Reglas**: borra todo, pega el contenido de `firestore.rules`, y **cambia `tucorreo@gmail.com` por el correo del administrador** → **Publicar**.
5. **Configuración del proyecto (engrane) → General → Tus apps → icono web `</>`** → ponle un nombre → **Registrar app**. Copia el bloque `firebaseConfig` y pégalo en `firebase-config.js` (reemplaza los `PEGAR_AQUI`). En el mismo archivo, cambia `ADMIN_EMAILS` por el correo del administrador (igual que en las reglas).

## PARTE 2 · Subir a un hosting gratuito (elige uno)

### Opción A · Netlify (la más fácil, sin instalar nada)
1. Entra a https://app.netlify.com/drop e inicia sesión (gratis).
2. Arrastra la **carpeta completa** de la app. Te da una dirección como `https://nombre.netlify.app` (puedes cambiar el nombre en *Site configuration → Change site name*).
3. Para actualizar después: *Deploys → Drag and drop* con la carpeta nueva.

### Opción B · GitHub Pages
1. Crea una cuenta en https://github.com → **New repository** (público) → sube todos los archivos (*Add file → Upload files*).
2. **Settings → Pages → Branch: main / (root) → Save**. Tu dirección será `https://usuario.github.io/repositorio/`.

### Opción C · Firebase Hosting (mismo proyecto)
1. Instala Node.js (https://nodejs.org). En una terminal dentro de la carpeta: `npm install -g firebase-tools`, luego `firebase login`.
2. `firebase init hosting` → usa el proyecto existente → carpeta pública `.` → **No** a "single-page app" → **No** a sobrescribir `index.html`.
3. `firebase deploy`. Tu dirección será `https://tu-proyecto.web.app` (esta ya viene autorizada en el paso siguiente).

## PARTE 3 · Autorizar tu dirección (obligatorio)

En Firebase: **Authentication → Configuración → Dominios autorizados → Agregar dominio** y escribe tu dirección **sin** `https://` (ej. `nombre.netlify.app` o `usuario.github.io`). Sin esto el inicio de sesión con Google falla.

## PARTE 4 · Instalar la app

- **PC (Chrome o Edge):** abre la dirección → clic en el icono de instalar en la barra de direcciones (o el botón **Instalar app** dentro de la página, o menú ⋮ → *Instalar BALAM12*).
- **Android (Chrome):** abre la dirección → menú ⋮ → **Instalar aplicación** (o *Agregar a pantalla principal*). Aparecerá como app con su icono.

## PARTE 5 · Primer uso y autorización de usuarios

1. Entra con el **correo del administrador** (Iniciar sesión con Google): queda activo como Administrador automáticamente.
2. Cada persona del equipo instala/abre la app y entra con su cuenta de Google. Verá "Pendiente de autorización".
3. El administrador abre la pestaña **Usuarios** (aparece un número rojo con las solicitudes) y pulsa **Autorizar**. La pantalla del usuario se actualiza sola. Desde ahí también puede **Bloquear**, **Editar** (teléfono, rol) o **Eliminar**.
4. Cada usuario (incluido el admin) debe poner su WhatsApp en **Mi teléfono** para recibir sus recordatorios.

## Recordatorios de WhatsApp

- Cliente: 30 min antes, **solo si en la cita se marcó que lo autoriza**. Usuario: 1 hora antes.
- Al llegar la hora aparece el aviso en la pestaña **Recordatorios** (y una notificación si pulsas **Activar avisos**). Un toque en **Enviar por WhatsApp** abre el chat con el mensaje listo; solo falta enviarlo.
- Importante: WhatsApp no permite que una app envíe mensajes sin intervención sin usar su servicio de pago (WhatsApp Business API). Además, los avisos se generan con la app abierta o en segundo plano reciente; en Android el sistema puede suspenderla si pasa mucho tiempo cerrada.

## Límites del plan gratuito y seguridad

- Firestore Spark: 1 GiB de datos y cuota diaria de lecturas/escrituras, de sobra para una inmobiliaria pequeña.
- Los datos solo los leen usuarios autorizados (lo hacen cumplir las reglas de Firestore, no solo la pantalla).
- Funciona sin internet de forma limitada: guarda copia local y sincroniza al reconectar.
- Si en el celular el inicio de sesión con Google no abre, permite las ventanas emergentes para el sitio en Chrome o abre la dirección en Chrome (no dentro de otra app) y vuelve a intentar.
- Si cambias archivos y no ves los cambios, cierra y abre la app dos veces (se actualiza en segundo plano).
