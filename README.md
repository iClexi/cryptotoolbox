# CryptoToolbox

CryptoToolbox es una plataforma académica para verificar integridad de archivos, generar hashes, analizar checksums y practicar conceptos de certificados digitales en una experiencia web interactiva.

## Qué Ofrece

- Verificación de integridad para ejecutables como PuTTY, Plink y VirtualBox.
- Generación de MD5, SHA-1 y SHA-256.
- Hashing local de archivos desde el navegador.
- Decodificación asistida de hashes conocidos.
- Wiki de algoritmos con notas de uso y riesgos.
- Perfil de usuario, reputación, puntos y niveles.
- Chat global, mensajes privados y actividad en tiempo real.
- Panel de edición de perfil para usuarios normales.
- Panel admin ampliado con tráfico, navegador, IP, viewport, zona horaria y actividad técnica.
- Registro, login, recuperación de PIN, bloqueo temporal y rate limiting.

## Stack

- React
- Vite
- TypeScript
- Express
- Socket.IO
- PostgreSQL
- Tailwind CSS
- Lucide Icons
- Anime.js

## Seguridad y Transparencia

El código está publicado para revisión técnica. Las variables reales de producción, tokens, credenciales de PostgreSQL, PIN admin y claves externas no se versionan; `.env*` está ignorado y `.env.example` funciona solo como plantilla segura.
