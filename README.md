<div align="center">

# CryptoToolbox

### Plataforma web para hashing, verificación de integridad, certificados digitales, reputación técnica y actividad en tiempo real

CryptoToolbox es una herramienta académica y técnica diseñada para generar hashes, verificar archivos, comparar checksums, documentar algoritmos criptográficos, practicar conceptos de certificados digitales y administrar actividad de usuarios dentro de una plataforma web moderna.

</div>

<div align="center">

![React](https://img.shields.io/badge/React-0f172a?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-312e81?style=for-the-badge&logo=vite&logoColor=FFD62E)
![TypeScript](https://img.shields.io/badge/TypeScript-1e3a8a?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-164e63?style=for-the-badge&logo=tailwindcss&logoColor=38BDF8)
![Express](https://img.shields.io/badge/Express-111827?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-1d4ed8?style=for-the-badge&logo=postgresql&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-000000?style=for-the-badge&logo=socketdotio&logoColor=white)
![Helmet](https://img.shields.io/badge/Helmet-4c1d95?style=for-the-badge&logo=helmet&logoColor=white)
![CryptoJS](https://img.shields.io/badge/CryptoJS-b45309?style=for-the-badge&logo=javascript&logoColor=white)
![Gemini AI](https://img.shields.io/badge/Gemini_AI-1a73e8?style=for-the-badge&logo=googlegemini&logoColor=white)
![Security](https://img.shields.io/badge/Security_Hardened-065f46?style=for-the-badge&logo=securityscorecard&logoColor=white)
![Realtime](https://img.shields.io/badge/Realtime_Activity-991b1b?style=for-the-badge&logo=livechat&logoColor=white)

</div>

---

## Descripción

CryptoToolbox es una plataforma web enfocada en criptografía aplicada, verificación de integridad y documentación técnica.

El proyecto permite generar hashes MD5, SHA-1 y SHA-256, calcular firmas de archivos directamente desde el navegador, verificar checksums de ejecutables, consultar hashes conocidos, administrar perfiles de usuario, ganar puntos, subir de nivel, participar en un chat global y revisar actividad técnica desde un panel administrativo.

La aplicación fue creada como una práctica académica de certificados digitales, pero evolucionó hasta convertirse en una herramienta completa con frontend moderno, backend en Express, base de datos PostgreSQL, Socket.IO, autenticación con PIN, recuperación de acceso por correo, telemetría técnica y controles de seguridad.

---

## Objetivo del Proyecto

El objetivo de CryptoToolbox es demostrar de forma práctica cómo validar la integridad de archivos usando algoritmos de hashing y cómo publicar una herramienta web bajo HTTPS con una estructura segura.

El proyecto cubre:

- Generación de hashes criptográficos.
- Verificación de integridad de archivos.
- Comparación de checksums.
- Publicación web bajo HTTPS.
- Uso de certificado SSL.
- Gestión de usuarios.
- Sistema de reputación técnica.
- Chat y actividad en tiempo real.
- Panel administrativo para auditoría.
- Registro de eventos técnicos del navegador y solicitudes.
- Buenas prácticas básicas de seguridad web.

---

## Características Principales

- Generación de hashes MD5, SHA-1 y SHA-256.
- Hashing local de archivos desde el navegador.
- Verificación de ejecutables como PuTTY, Plink y VirtualBox.
- Decodificación asistida de hashes conocidos.
- Wiki técnica de algoritmos.
- Registro y login de usuarios.
- Autenticación mediante usuario y PIN.
- Recuperación de PIN por correo.
- Bloqueo temporal por intentos fallidos.
- Rate limiting para rutas sensibles.
- Sistema de puntos, niveles y rangos.
- Perfil de usuario editable.
- Chat global en tiempo real.
- Mensajes privados.
- Actividad técnica en vivo.
- Panel administrativo ampliado.
- Registro de tráfico, navegador, sistema operativo, IP, viewport, idioma y zona horaria.
- Gestión de apps y hashes desde backend.
- Soporte para Socket.IO.
- Integración opcional con Gemini AI para asistencia en decodificación.
- Seguridad con Helmet, CSP, HSTS, cookies HTTP-only y validación de origen.

---

## Stack Técnico

### Frontend

- React 19
- Vite 6
- TypeScript
- Tailwind CSS 4
- Motion
- Anime.js
- Lucide React
- Sonner
- CryptoJS
- Socket.IO Client

### Backend

- Node.js
- Express
- TypeScript
- TSX
- PostgreSQL
- pg
- Socket.IO
- Helmet
- Nodemailer
- Google Gemini API
- Crypto nativo de Node.js
- dotenv

### Seguridad

- Helmet
- Content Security Policy
- HSTS
- Cookies `HttpOnly`
- Cookies `Secure`
- `SameSite=Lax`
- Firma de sesión con HMAC SHA-256
- PIN hasheado con `scrypt`
- Rate limiting
- Bloqueo temporal de cuenta
- Validación de origen permitido
- Validación de entradas
- Sanitización de texto inseguro
- Restricción de URLs a HTTPS
- Variables sensibles fuera del repositorio

---

## Módulos Principales

### Hashing de Texto

Permite generar hashes a partir de texto usando:

| Algoritmo | Uso |
| --- | --- |
| MD5 | Comparaciones históricas y compatibilidad |
| SHA-1 | Prácticas académicas y comparación heredada |
| SHA-256 | Verificación moderna de integridad |

---

### Verificación de Archivos

La aplicación permite calcular hashes de archivos de forma local desde el navegador.

Características:

- El archivo no se envía al servidor.
- El cálculo se realiza en el navegador.
- Soporte para archivos grandes.
- Comparación contra hashes esperados.
- Útil para validar instaladores, binarios y ejecutables descargados.

---

### Ejecutables Analizados

El proyecto incluye referencias para verificar integridad de ejecutables usados en la práctica:

| Ejecutable | Descripción |
| --- | --- |
| `putty.exe` | Cliente SSH gráfico para Windows |
| `plink.exe` | Cliente SSH por línea de comandos |
| `VirtualBox-7.0.8-156879-Win.exe` | Instalador de Oracle VirtualBox |

---

### Wiki Técnica

CryptoToolbox incluye una wiki para documentar algoritmos criptográficos.

La wiki puede mostrar:

- Nombre del algoritmo.
- Nombre completo.
- Estado de seguridad.
- Color de estado.
- Descripción.
- Casos de uso.
- Vulnerabilidades conocidas.
- Riesgos técnicos.
- Recomendaciones de uso.

---

### Sistema de Usuarios

La plataforma incluye sistema de usuarios con perfil técnico.

Funciones disponibles:

- Registro de usuario.
- Login con PIN.
- Perfil editable.
- Avatar público.
- Correo electrónico.
- Nombre y apellido.
- Fecha de nacimiento.
- Género.
- Aceptación de términos.
- Puntos acumulados.
- Rango técnico.
- Nivel de usuario.
- Último login.
- Bloqueo por intentos fallidos.

---

### Sistema de Rangos

CryptoToolbox usa un sistema de reputación por puntos.

| Rango | Puntos mínimos |
| --- | ---: |
| Novice | 0 |
| Junior Operator | 200 |
| Security Analyst | 500 |
| Cipher Master | 1000 |
| Root Admin | 2000 |
| Elite Cipher | 5000 |
| System Administrator | Admin |

---

### Chat en Tiempo Real

El proyecto incluye comunicación en tiempo real mediante Socket.IO.

Funciones principales:

- Chat global.
- Usuarios conectados.
- Indicador de escritura.
- Edición de mensajes.
- Eliminación lógica de mensajes.
- Mensajes privados.
- Eventos enviados en vivo.
- Sincronización de actividad entre usuarios.

---

### Panel Administrativo

El panel administrativo permite observar y administrar la actividad técnica de la plataforma.

Incluye:

- Usuarios registrados.
- Puntos y rangos.
- Actividad reciente.
- Hashes guardados.
- Mensajes del chat.
- Tráfico técnico.
- Navegador detectado.
- Sistema operativo.
- Tipo de dispositivo.
- IP del cliente.
- Idioma del navegador.
- Viewport.
- Zona horaria.
- País, región y ciudad si Cloudflare lo proporciona.
- Eventos autenticados y anónimos.
- Limpieza de registros y hashes.
- Gestión de usuarios no administradores.

---

## Seguridad Implementada

CryptoToolbox fue desarrollado con varias medidas de seguridad para proteger sesiones, datos y rutas sensibles.

### Sesiones

- Cookie de sesión llamada `ct_session`.
- Sesión firmada con HMAC SHA-256.
- Expiración de sesión.
- Validación de firma con comparación segura.
- Limpieza de cookie al cerrar sesión.

### PIN y Autenticación

- PIN de 6 a 8 dígitos para usuarios nuevos.
- Compatibilidad con PIN heredado de 4 dígitos.
- Hash de PIN usando `scrypt`.
- Migración automática de PIN antiguo a hash seguro al iniciar sesión.
- Bloqueo temporal por intentos fallidos.
- Rate limiting en autenticación.
- Recuperación de PIN mediante token de un solo uso.

### Headers HTTP

- `X-Powered-By` desactivado.
- `Content-Security-Policy`.
- `frame-ancestors 'none'`.
- `object-src 'none'`.
- `form-action 'self'`.
- `base-uri 'self'`.
- `Referrer-Policy: no-referrer`.
- `X-Frame-Options: DENY`.
- `X-Content-Type-Options: nosniff`.
- HSTS cuando HTTPS está forzado.

### Validaciones

- Validación de username.
- Validación de email.
- Validación de edad.
- Validación de género.
- Validación de hashes MD5, SHA-1 y SHA-256.
- Validación de URLs HTTPS.
- Validación de color hexadecimal.
- Sanitización de campos de texto.
- Bloqueo de patrones inseguros como rutas locales, `javascript:`, `data:text`, traversal y consultas destructivas.

---

## Base de Datos

El backend usa PostgreSQL como base principal.

Tablas principales:

| Tabla | Uso |
| --- | --- |
| `users` | Usuarios, perfil, PIN, rol, puntos y rangos |
| `hash_cache` | Hashes conocidos y valores relacionados |
| `messages` | Chat global |
| `direct_messages` | Mensajes privados |
| `activities` | Actividad pública de hashing |
| `password_resets` | Tokens de recuperación de PIN |
| `wiki` | Documentación técnica de algoritmos |
| `apps` | Aplicaciones y ejecutables verificados |
| `visitor_events` | Telemetría técnica y eventos de tráfico |

---

## Variables de Entorno

Crea un archivo `.env` basado en `.env.example`.

```env
APP_ENV="production"
APP_URL="https://cryptotoolbox.iclexi.tech"
APP_ORIGIN="https://cryptotoolbox.iclexi.tech"
ALLOWED_ORIGINS="https://cryptotoolbox.iclexi.tech"
PORT="3000"

SESSION_SECRET="change-me-to-a-long-random-secret"
FORCE_HTTPS="true"
COOKIE_SECURE="true"

DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="cryptotoolbox"
DB_USER="postgres"
DB_PASSWORD="change-me"
DB_SSL="false"

ADMIN_USERNAME="admin"
ADMIN_EMAIL="admin@example.com"
ADMIN_PIN=""

SMTP_HOST=""
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_REQUIRE_TLS="true"
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM="CryptoToolbox <no-reply@cryptotoolbox.iclexi.tech>"

RESET_TOKEN_TTL_MINUTES="30"
AUTH_RATE_LIMIT="20"
PASSWORD_RESET_RATE_LIMIT="5"
ACCOUNT_LOCK_ATTEMPTS="5"
ACCOUNT_LOCK_MINUTES="15"
VISITOR_EVENT_RETENTION_DAYS="45"
```

---

## Instalación Local

Clona el repositorio:

```bash
git clone https://github.com/iClexi/cryptotoolbox.git
```

Entra al proyecto:

```bash
cd cryptotoolbox
```

Instala dependencias:

```bash
npm install
```

Copia el archivo de variables:

```bash
cp .env.example .env
```

Edita el archivo `.env`:

```bash
nano .env
```

---

## Configuración de PostgreSQL

Entra a PostgreSQL:

```bash
sudo -u postgres psql
```

Crea la base de datos:

```sql
CREATE DATABASE cryptotoolbox;
```

Crea un usuario dedicado:

```sql
CREATE USER cryptotoolbox_user WITH PASSWORD 'replace-with-db-password';
```

Otorga permisos:

```sql
GRANT ALL PRIVILEGES ON DATABASE cryptotoolbox TO cryptotoolbox_user;
```

Conéctate a la base:

```sql
\c cryptotoolbox
```

Otorga permisos sobre el esquema público:

```sql
GRANT ALL ON SCHEMA public TO cryptotoolbox_user;
```

Sal de PostgreSQL:

```sql
\q
```

Luego actualiza el `.env`:

```env
DB_NAME="cryptotoolbox"
DB_USER="cryptotoolbox_user"
DB_PASSWORD="replace-with-db-password"
```

El backend crea automáticamente las tablas necesarias al iniciar.

---

## Ejecución en Desarrollo

Ejecuta el servidor de desarrollo:

```bash
npm run dev
```

Por defecto, la aplicación usa el puerto:

```text
http://localhost:3000
```

---

## Compilación para Producción

Compila el frontend:

```bash
npm run build
```

Ejecuta el servidor:

```bash
npm start
```

---

## Scripts Disponibles

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Ejecuta el servidor con TSX |
| `npm start` | Ejecuta el servidor principal |
| `npm run build` | Compila la aplicación con Vite |
| `npm run preview` | Previsualiza el build de Vite |
| `npm run clean` | Elimina la carpeta `dist` |
| `npm run lint` | Valida TypeScript sin emitir archivos |

---

## Rutas Principales de API

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/health` | Valida servidor y conexión a PostgreSQL |
| `GET` | `/api/session` | Consulta la sesión actual |
| `POST` | `/api/auth/register` | Registra usuario |
| `POST` | `/api/auth/logout` | Cierra sesión |
| `POST` | `/api/auth/forgot-password` | Solicita recuperación de PIN |
| `POST` | `/api/auth/reset-password` | Restablece PIN con token |
| `GET` | `/api/wiki` | Lista la wiki técnica |
| `POST` | `/api/wiki` | Crea elemento de wiki como admin |
| `PUT` | `/api/wiki/:id` | Actualiza elemento de wiki como admin |
| `DELETE` | `/api/wiki/:id` | Elimina elemento de wiki como admin |
| `GET` | `/api/apps` | Lista apps verificables |
| `POST` | `/api/apps` | Crea app verificable como admin |
| `PUT` | `/api/apps/:id` | Actualiza app verificable como admin |
| `DELETE` | `/api/apps/:id` | Elimina app verificable como admin |
| `GET` | `/api/hashes` | Lista hashes guardados |
| `POST` | `/api/hashes` | Guarda hashes generados o verificados |
| `GET` | `/api/decode/online/:hash` | Consulta decodificación asistida |
| `GET` | `/api/users` | Lista usuarios autenticados |
| `PUT` | `/api/users/profile` | Actualiza perfil |
| `POST` | `/api/users/points` | Agrega puntos |
| `GET` | `/api/messages` | Lista mensajes del chat |
| `GET` | `/api/activities` | Lista actividad reciente |
| `GET` | `/api/direct-messages/:userId/:otherId` | Lista mensajes privados |
| `GET` | `/api/admin/traffic` | Lista tráfico técnico para admin |
| `DELETE` | `/api/admin/users/:id` | Elimina usuario como admin |
| `DELETE` | `/api/admin/hashes` | Limpia hashes, actividad y usuarios no admin |
| `DELETE` | `/api/admin/hashes/:hash` | Elimina hash específico |
| `DELETE` | `/api/admin/hash-values` | Elimina hashes por valor |
| `DELETE` | `/api/admin/activities/:id` | Elimina actividad específica |

---

## Health Check

Para verificar que el servidor y PostgreSQL responden:

```bash
curl http://localhost:3000/api/health
```

Respuesta esperada:

```json
{
  "ok": true,
  "database": "postgresql"
}
```

---

## Despliegue en Producción

Flujo recomendado:

```bash
git clone https://github.com/iClexi/cryptotoolbox.git
cd cryptotoolbox
npm install
cp .env.example .env
npm run build
npm start
```

---

## Ejemplo con systemd

Crea un servicio:

```bash
sudo nano /etc/systemd/system/cryptotoolbox.service
```

Contenido recomendado:

```ini
[Unit]
Description=CryptoToolbox
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/opt/cryptotoolbox
EnvironmentFile=/opt/cryptotoolbox/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

Activa el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable cryptotoolbox
sudo systemctl start cryptotoolbox
```

Ver estado:

```bash
systemctl status cryptotoolbox
```

Ver logs:

```bash
journalctl -u cryptotoolbox -f
```

---

## Reverse Proxy

En producción se recomienda ejecutar CryptoToolbox detrás de NGINX, Apache o Cloudflare Tunnel.

Flujo recomendado:

```text
Cliente
  -> HTTPS / Dominio público
  -> Cloudflare o Reverse Proxy
  -> Node.js Express en puerto 3000
  -> PostgreSQL
```

Ejemplo de origen interno:

```text
http://localhost:3000
```

Dominio sugerido:

```text
cryptotoolbox.iclexi.tech
```

---

## Cloudflare Tunnel

Ejemplo conceptual de entrada para Cloudflare Tunnel:

```yaml
ingress:
  - hostname: cryptotoolbox.iclexi.tech
    service: http://localhost:3000
  - service: http_status:404
```

Variables recomendadas:

```env
APP_URL="https://cryptotoolbox.iclexi.tech"
APP_ORIGIN="https://cryptotoolbox.iclexi.tech"
ALLOWED_ORIGINS="https://cryptotoolbox.iclexi.tech"
FORCE_HTTPS="true"
COOKIE_SECURE="true"
```

---

## Recomendaciones de Seguridad

Para producción:

- Usar `SESSION_SECRET` largo y aleatorio.
- Usar `COOKIE_SECURE=true`.
- Usar `FORCE_HTTPS=true`.
- Limitar `ALLOWED_ORIGINS`.
- No subir `.env` al repositorio.
- No exponer PostgreSQL a internet.
- Usar usuario PostgreSQL dedicado.
- Configurar SMTP real solo en el servidor.
- Mantener `ADMIN_PIN` fuera del repositorio.
- Usar PIN admin de 6 a 8 dígitos.
- Ejecutar la app con un usuario sin privilegios.
- Revisar logs de `visitor_events`.
- Proteger el panel administrativo.
- Mantener dependencias actualizadas.
- Publicar la app únicamente detrás de HTTPS.

---

## Estructura del Proyecto

```text
.
├── public/
├── src/
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── .env.example
├── .gitignore
├── README.md
├── check_db.js
├── check_db_all.js
├── index.html
├── metadata.json
├── package-lock.json
├── package.json
├── server.ts
├── test_points.js
├── test_register.js
├── tsconfig.json
└── vite.config.ts
```

---

## Práctica de Certificados Digitales

Este proyecto nace como una práctica donde se trabaja el ciclo completo de publicación segura:

1. Obtener hashes MD5, SHA-1 y SHA-256 de ejecutables.
2. Publicar una página web con la información.
3. Desplegar la aplicación en un servidor.
4. Configurar dominio público.
5. Activar HTTPS.
6. Validar certificado SSL.
7. Documentar la integridad de los archivos.

---

## Casos de Uso

CryptoToolbox puede utilizarse para:

- Validar integridad de archivos descargados.
- Comparar checksums publicados.
- Practicar hashing con MD5, SHA-1 y SHA-256.
- Enseñar conceptos de certificados digitales.
- Documentar algoritmos criptográficos.
- Practicar despliegue web seguro.
- Implementar login, sesiones y recuperación de acceso.
- Observar tráfico técnico desde un panel admin.
- Practicar WebSockets con Socket.IO.
- Integrar una aplicación React con backend Express y PostgreSQL.

---

## Comandos Útiles

Verificar TypeScript:

```bash
npm run lint
```

Compilar:

```bash
npm run build
```

Ejecutar:

```bash
npm start
```

Limpiar build:

```bash
npm run clean
```

Verificar puerto:

```bash
ss -tulpn | grep 3000
```

Probar API:

```bash
curl http://localhost:3000/api/health
```

Probar sesión:

```bash
curl -i http://localhost:3000/api/session
```

---

## Estado del Proyecto

CryptoToolbox está funcional y en evolución.

Actualmente incluye herramientas de hashing, verificación de archivos, autenticación, perfil de usuario, recuperación de PIN, reputación, chat, mensajes privados, actividad en tiempo real, panel administrativo, telemetría técnica, PostgreSQL y controles básicos de seguridad web.

---

## Autor

**Michael David Robles Fermin**  
**iClexi**

Proyecto desarrollado como parte de mi portafolio técnico y académico, combinando criptografía aplicada, desarrollo web, backend, bases de datos, seguridad, certificados digitales y despliegue real.

---

<div align="center">

CryptoToolbox  
Hashing, integridad, certificados digitales y seguridad web en una sola plataforma.

</div>
