# Portafolio: publicación de medios y SEO

## Estado de esta rama

Los buckets `portfolio-drafts` y `portfolio-published` y sus ocho políticas ya
están instalados en el proyecto Supabase. El Super Admin incluye un adaptador
de Storage (`portfolioStorageRepository.ts`), pero **solo se activa en builds
locales** con `PORTFOLIO_STORAGE_ENABLED=true`. En cualquier despliegue de
Vercel (Production o Preview) `isPortfolioStorageEnabled` devuelve `false` y el
adaptador se elimina del bundle aunque la variable esté definida: activarlo en
Vercel exige cambiar ese código en un cambio aparte y aprobado. Sin indicador,
el panel funciona en modo demostración (memoria).
Publicar no solicita regeneración del HTML; el endpoint
`/api/redeploy-portfolio` existe pero el panel todavía no lo llama (ver
«Pendiente bloqueante»).

## Almacenamiento y publicación

1. Auth existente valida la sesión y `admin_users`; RLS vuelve a validar cada
   operación de Storage mediante `public.is_admin()`.
2. Subidas y borradores viven en `portfolio-drafts`, privado.
3. La publicación crea medios inmutables en
   `portfolio-published/projects/<slug>/versions/<version>/`.
4. Se escribe un manifiesto histórico `manifest.json` y se actualiza
   `projects/<slug>/current.json` únicamente después de verificar todos los
   objetos. La copia pública no incluye borradores.
5. El cliente Production/main puede leer `current.json` y refrescar las
   imágenes sin redeploy. La lectura no permite listar objetos.

Los manifiestos siguen schema version 1 y solo incluyen slug, versión, fecha,
portada, galería, ALT, orden, dimensiones y rutas relativas. El lector valida
el slug, las rutas y el límite de ocho elementos antes de renderizar.

## HTML estático y regeneración SEO

La lectura dinámica actualiza imágenes para visitantes con JavaScript. El HTML
prerenderizado, Open Graph y JSON-LD se actualizan con un build de Production
en `main` que lee `current.json`; canonical y sitemap no cambian porque las
rutas son fijas. Los crawlers que no ejecutan JavaScript pueden ver el snapshot
anterior hasta que termine ese build. Los cachés de redes sociales también
pueden tardar en refrescarse.

La lectura de manifiestos (cliente y prerender) **solo se activa** en Production/main
con `PORTFOLIO_PUBLIC_MEDIA_ENABLED=true`. Sin esa variable fusionar la rama no
cambia nada: no se pide ningún manifiesto y las fichas conservan el marcador.

### Estrategia del prerender ante errores de lectura

`readPortfolioManifest` devuelve tres resultados distintos:

| Resultado | Cuándo | Efecto en el build |
|---|---|---|
| `ok` | JSON válido que cumple el esquema | Usa las imágenes |
| `absent` | Storage dice explícitamente que el objeto no existe (404, o 400 con cuerpo JSON `not_found`) | Marcador «captura pendiente»: aún no hay versión |
| `error` | Red, HTTP distinto de lo anterior (incluido 404 sin JSON o «Bucket not found»), JSON inválido o manifiesto que no cumple el esquema | Se reintenta (3 intentos); si persiste, **el build termina con código 1** |

Ante un `error` persistente el prerender no escribe ningún archivo (el snapshot se
carga antes de la primera escritura) y el build falla, así que Vercel no promueve
el despliegue y Production conserva la versión anterior. El mensaje lista todos los
proyectos afectados. Solo `PortfolioSnapshotError` detiene el build; el resto de
errores del prerender (p. ej. artículos del blog) conserva su comportamiento
tolerante.

Compromiso: mientras la lectura esté activada, una caída de Storage también
bloquea los redeploys de producción del blog. Se prefiere eso a publicar fichas
regresadas al marcador. `PORTFOLIO_PRERENDER_RETRY_DELAY_MS` ajusta la espera
entre reintentos (por defecto 1000 ms; las pruebas usan 0).

**Verificado contra Supabase real (2026-10-29, proyecto `rvvqhpbtqgjpzflopflv`,
sonda de solo lectura):** para un `current.json` inexistente, Storage responde
**HTTP 400** (no 404) con `application/json` y el cuerpo
`{"statusCode":"404","error":"not_found","message":"Object not found","code":"NoSuchKey"}`.
Los cuatro proyectos se clasificaron `absent`. Esto confirma que reconocer solo el
HTTP 404 habría fallado: el build habría tratado cada manifiesto ausente como un
error. Si Supabase cambiara esa forma, el build fallaría (comportamiento seguro) y
`npm run probe:portfolio-manifests` lo mostraría con el código, el tipo y el cuerpo
reales. Repetir la sonda antes de activar la lectura.

La regeneración usa `POST /api/redeploy-portfolio`, separado del endpoint del
blog. Deniega por defecto y solo sigue si `VERCEL_ENV=production` y
`VERCEL_GIT_COMMIT_REF=main`, el usuario presenta una sesión admin válida y
existe `PORTFOLIO_DEPLOY_HOOK_URL`. Ese hook debe configurarse aparte y apuntar
explícitamente al branch de producción `main`. En Preview, desarrollo y ramas
distintas de `main`, la función responde 503 antes de autenticar o hacer fetch.
El panel simulado de esta rama no llama a la función.

La futura integración debe informar si el snapshot público se publicó pero la
regeneración falló: las imágenes dinámicas podrían estar actualizadas mientras
HTML y metadata siguen con el snapshot anterior. No reusar
`BLOG_DEPLOY_HOOK_URL`.

## Pendiente: regeneración SEO (parcialmente resuelto)

**Los riesgos 2 y 3 siguen abiertos; resolverlos antes de publicar imágenes de
forma definitiva.** Hoy, publicar una
versión deja el sitio en un estado inconsistente hasta el siguiente build de
producción:

| Superficie | Se actualiza al publicar |
|---|---|
| Imágenes para visitantes con JavaScript (tarjetas y fichas) | Sí (lee `current.json`) |
| HTML prerenderizado de home y fichas (`<img>`, ALT) | No |
| `og:image`, `twitter:image` y su ALT/dimensiones | No |
| JSON-LD (`image`) de las fichas | No |
| Sitemap y canonical | No cambian (rutas fijas) |

Consecuencias: crawlers sin JavaScript y vistas previas sociales (WhatsApp,
Facebook, X) siguen viendo el marcador «Captura auténtica autorizada pendiente»
y la imagen de marca hasta que se regenere.

Estado de los riesgos:

1. **Reversión silenciosa — RESUELTO** (ver «Estrategia del prerender»). Un error
   de lectura ya no se confunde con un manifiesto inexistente: se reintenta y, si
   persiste, el build falla sin escribir nada. Cubierto por pruebas unitarias y
   por 17 pruebas que ejecutan el prerender real contra un servidor HTTP local.
   Residual: un visitante cuyo navegador falle al leer el manifiesto ve el
   marcador en esa visita, porque React reemplaza el HTML prerenderizado.
   Mejora posible: incrustar los manifiestos en el HTML como estado inicial.
2. **Disparo no conectado — ABIERTO A PROPÓSITO.** El panel no llama a
   `/api/redeploy-portfolio` y una prueba lo garantiza. Falta, cuando se apruebe
   ese flujo, llamarlo después de publicar, informar al admin si publicar tuvo
   éxito pero la regeneración falló, y configurar `PORTFOLIO_DEPLOY_HOOK_URL`
   (solo Production, destino `main`; hoy no está configurado).
3. **Condición de carrera con la caché — ABIERTO.** `current.json` se sirve con
   `cache-control: 60`. Un build iniciado justo tras publicar podría leer el
   puntero anterior. Los reintentos no lo resuelven (la lectura anterior es
   válida). Verificar que el manifiesto leído coincida con la versión recién
   publicada, o esperar tras publicar, cuando se conecte el disparo.
4. **Builds repetidos.** Cada publicación dispara un build de producción.
   Considerar agrupar publicaciones (debounce) o limitar la frecuencia.
5. **Dominio de las imágenes.** El HTML y `og:image` apuntarán a
   `<proyecto>.supabase.co/storage/...`, no al dominio del sitio. Confirmar que
   los scrapers sociales las aceptan y que cada versión usa una URL nueva
   (así es: las rutas llevan el número de versión) para no heredar cachés.
6. **Sitemap sin `lastmod`.** Las fichas no informan fecha de modificación;
   evaluar usar `publishedAt` del manifiesto.

Criterio de cierre: tras publicar una versión de prueba, el HTML servido por
Production de las cuatro fichas y la home contiene la imagen y el ALT nuevos y
`og:image` apunta a la versión publicada. El criterio «un build con Storage
inaccesible falla en lugar de volver al marcador» ya está cubierto por pruebas.

## Auditoría real de permisos (manual, local)

`npm run audit:portfolio-storage` comprueba con tres roles (anónimo, autenticado
sin rol admin y administrador) que las políticas instaladas hacen lo esperado.

- Alcance impuesto en código: solo `upload`, `download`, `remove` y `list`, solo
  en los dos buckets del portafolio y solo bajo `_audit/<runId>/`. Cualquier
  otra ruta aborta la auditoría. Todo objeto que se intente escribir se limpia
  al final, aunque Storage lo haya aceptado por error.
- No crea, modifica ni elimina usuarios, administradores, tablas, políticas ni
  buckets. Solo lee la propia fila de `admin_users` de cada cuenta.
- Iniciar sesión sí registra una sesión y actualiza `last_sign_in_at` de cada
  cuenta en Auth, como cualquier inicio de sesión. Al terminar cierra solo esa
  sesión (`scope: local`), no las demás de la cuenta.

Pasos (en una terminal propia, no en el chat ni en un agente):

1. Estar en la rama `feat/portafolio-proyectos-v2` con el árbol limpio.
2. Ensayo sin red ni cuentas, para ver qué se ejecutará:
   `npm run audit:portfolio-storage -- --dry-run`. Debe listar 28 comprobaciones
   y 0 rutas fuera de `_audit/`. No valida Supabase.
3. Tener `.env.local` (ignorado por git) con `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY` del proyecto `rvvqhpbtqgjpzflopflv`. La anon key es
   pública; no uses la service role.
4. Tener dos cuentas que ya existan: una administradora (con fila en
   `admin_users`) y otra autenticada sin esa fila. No se crean cuentas aquí.
5. Ejecutar `PORTFOLIO_AUDIT_CONFIRM=WRITE_AUDIT_OBJECTS npm run audit:portfolio-storage`.
6. Escribir correo y contraseña de cada cuenta cuando se pidan. La contraseña
   se escribe con entrada oculta; no pasa por variables de entorno, archivos,
   argumentos ni historial del shell.
7. Resultado esperado: 28/28 PASS, incluida «limpieza de objetos de prueba».
   Cualquier FAIL se reporta con el nombre de la comprobación (no con
   credenciales). Si la limpieza falla, el mensaje lista los objetos
   `_audit/` a borrar manualmente.

El ejecutable se niega a correr sin la confirmación, en CI o Vercel, sin
terminal interactiva, con una URL que no sea `rvvqhpbtqgjpzflopflv.supabase.co`
o con la misma cuenta en ambos roles.

### Piloto parcial: administradora + sesión anónima

Charlie es la única administradora y no se creará otra cuenta solo para auditar.
`npm run audit:portfolio-storage -- --piloto` ejecuta una versión reducida con
la cuenta administradora existente y una sesión anónima (sin iniciar sesión).
**Es un resultado parcial: no equivale a la auditoría completa de 28
comprobaciones** y el programa lo imprime así (`PILOTO PARCIAL`, con la línea
`PENDIENTE`). Queda **pendiente** la prueba con un usuario autenticado sin rol
administrador; mientras no se haga, no puede afirmarse que Storage rechace a un
usuario con sesión que no sea administrador.

Qué comprueba (25 comprobaciones), todo bajo `_audit/<runId>/`:

- Admin: sube un WebP de prueba (1x1 px) a borradores, lo lee con bytes
  idénticos, lo lista, lo publica junto con un `current.json` de prueba, y las
  URL públicas devuelven 200, `image/webp`/JSON y los mismos bytes. Los
  borradores no son públicos.
- Anónimo: no sube, no reemplaza (upsert) imagen, manifiesto ni borrador, no
  lee borradores, no lista y no borra.
- Persistencia: tras los intentos anónimos, todo sigue intacto, también por URL
  pública.
- Eliminación por la administradora y limpieza final de todo objeto tocado
  (aunque Storage haya aceptado alguno por error).

No modifica usuarios, Auth, buckets ni políticas; solo lee su propia fila de
`admin_users`. Misma guarda de alcance, confirmación y terminal propia que la
auditoría completa; solo pide una cuenta (con contraseña oculta).

1. Ensayo sin red: `npm run audit:portfolio-storage -- --piloto --dry-run`.
2. Real: `PORTFOLIO_AUDIT_CONFIRM=WRITE_AUDIT_OBJECTS npm run audit:portfolio-storage -- --piloto`.

## Habilitación del gestor real

1. Piloto parcial de permisos (arriba) en PASS. La auditoría completa de 28
   comprobaciones sigue pendiente hasta probar un usuario autenticado sin rol
   administrador; hasta entonces el resultado se informa como parcial.
2. Prueba piloto del Super Admin en local, previa autorización expresa. Primera
   fase: **solo guardar una portada como borrador** en
   `planeaslp-celebra-tu-evento`; sin publicar y sin tocar `current.json`.
   - Comando (en una terminal propia, con `.env.local` ignorado por git que
     contenga `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del proyecto
     `rvvqhpbtqgjpzflopflv`):
     `PORTFOLIO_STORAGE_ENABLED=true PORTFOLIO_PILOT_PROJECT=planeaslp-celebra-tu-evento npm run dev`
   - Barreras en código, aplicadas en el repositorio antes de cualquier llamada a
     Storage: `PORTFOLIO_PILOT_PROJECT` limita el panel y el repositorio a ese
     proyecto (otro slug se rechaza sin tocar Storage), y publicar queda
     **bloqueado** salvo que se defina además `PORTFOLIO_PUBLISH_ENABLED=true`
     (no se define en esta fase). El botón aparece como «Publicación desactivada».
     Ninguno de los dos indicadores existe en Vercel.
   - Escribe solo `drafts/planeaslp-celebra-tu-evento/draft.json` y
     `drafts/planeaslp-celebra-tu-evento/assets/<id>-{web,thumb}.webp` en el bucket
     privado. No escribe en `portfolio-published`.
   - Pasos: entrar como la administradora en `/admin` → Portafolio → subir una
     portada → Guardar borrador → recargar la página y comprobar que la portada
     persiste (se lee de Storage, no de memoria).
   - Después, `npm run probe:portfolio-manifests` debe seguir mostrando los cuatro
     proyectos como `ausente`: prueba de que no se publicó nada.
   - Segunda fase (autorización aparte): publicar. Entonces sí se escribe
     `projects/<slug>/versions/<n>/` y `projects/<slug>/current.json`. Si esa
     imagen de prueba queda publicada y luego se activa la lectura pública,
     aparecería en la web: sustituirla o borrar solo esas rutas antes de activar.
   - Verificado sin red: con `PORTFOLIO_STORAGE_ENABLED` el bundle incluye el
     adaptador real; sin él no contiene referencias a los buckets.
3. Antes de activar la lectura de manifiestos: `npm run probe:portfolio-manifests`
   (GET público, solo lectura) debe clasificar los cuatro proyectos como ok o
   ausente. Si alguno sale como error, no activar.
4. Resolver lo que sigue abierto en «Pendiente: regeneración SEO» (riesgos 2 y 3).
5. Solo después, y con autorización aparte: `PORTFOLIO_PUBLIC_MEDIA_ENABLED=true`
   en el scope Production de Vercel, un cambio de código que permita el gestor
   real en Production y `PORTFOLIO_DEPLOY_HOOK_URL` (solo Production, destino
   `main`). Nunca en Preview.