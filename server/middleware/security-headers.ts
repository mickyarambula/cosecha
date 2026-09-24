/**
 * Encabezados de seguridad en cada respuesta del sitio publicado (24 Sep 2026).
 * Auto-registrado como middleware global de Nitro (`serverDir: "./server"`),
 * igual que `grok-pwa.ts`. En `npm run dev` no corre: solo en el despliegue.
 *
 *  - Ninguna página ajena puede meter Cosecha en un marco (clickjacking: un
 *    sitio falso que pone la app debajo de botones trampa).
 *  - El navegador no adivina tipos de archivo (un PDF o una imagen no se
 *    ejecutan como script).
 *  - Las ligas públicas llevan su clave en la URL: al salir hacia otro sitio
 *    el navegador solo manda el dominio, nunca la ruta con la clave.
 *  - Sin cámara, micrófono, ubicación ni pagos desde la página.
 *
 * No se fija una política de scripts completa: la app carga su propio código
 * y el de inicio de sesión, y una política mal ajustada la deja en blanco.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "x-frame-options": "DENY",
  "content-security-policy": "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

interface SecurityHeadersEvent {
  res?: { headers?: Headers };
}

export default async function securityHeadersMiddleware(
  event: SecurityHeadersEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  // Respuestas que no son `Response` (h3 las arma después): van en los
  // encabezados preparados del evento.
  const prepared = event.res?.headers;
  if (prepared) for (const [name, value] of Object.entries(SECURITY_HEADERS)) prepared.set(name, value);
  const result = await next();
  if (!(result instanceof Response)) return result;
  const headers = new Headers(result.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(result.body, {
    status: result.status,
    statusText: result.statusText,
    headers,
  });
}
