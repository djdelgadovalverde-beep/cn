# CN · Desempeño comercial

Plataforma web (visitas, tareas, SOS/SOE, justificaciones, metas, plan diario y alcance) que reemplaza los Apps Script.
**Sitio estático sin compilación** (`web/`: HTML + JavaScript puro) + **Supabase** (Postgres con RLS, Auth, Storage y una Edge Function).
Costo: plan gratuito de Supabase + hosting estático gratuito.

## Desarrollo local (VS Code)

Requisitos: Node 20+ y Git.

```bash
git clone <tu-repositorio>.git && cd <tu-repositorio>
npm install
npx playwright install chromium     # solo para correr las pruebas
npm run dev                         # http://localhost:5173
```

En VS Code: **Terminal → Ejecutar tarea → «Servidor local»** (o `F5` para abrir Chrome). Cada cambio se ve al recargar; no hay
paso de compilación. La app habla con el Supabase real definido en `web/config.js` (la clave `anon` es pública por diseño:
la seguridad la dan las políticas RLS de la base).

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor local en el puerto 5173 |
| `npm run check` | Revisa la sintaxis de todos los `.js` |
| `npm test` | Pruebas rápidas: filtros duplicados, recorrido de todas las pantallas por rol, módulo de justificación |
| `npm run test:todo` | Además: pestañas de Visitas/Tareas con exportaciones (Excel, PDF, PowerPoint) y Plan/Alcance |

Las pruebas usan un **Supabase simulado en memoria** (`tests/fake.js`): no tocan tus datos reales. Los resultados y capturas
quedan en `tests/out/`. Auditorías extra: `node tests/aud.js 1800` (accesibilidad, contraste, etiquetas) y `node tests/lay.js 1800`.

## Estructura

```
web/                 sitio (se publica tal cual)
  index.html         orden de carga de los scripts
  config.js          URL y clave pública de Supabase
  app.js             sesión, menú lateral, permisos (veMod / CN.tabOk / CN.puede)
  viz.js export.js   gráficos, tablas con paginación, selección múltiple, Excel/PNG/PDF
  carga.js           carga de bases (detección del archivo, modos actualizar/reemplazar/todo)
  an_vt.js an_vt2.js Visitas y Tareas (dashboard, informe de motivos, justificaciones, calidad, PowerPoint…)
  an_aud.js bitacora.js  Auditoría e historial legible
  an_share*.js       SOS/SOE (resumen semanal, análisis, detalle editable)
  an_metas.js plan.js plan_ui.js   metas, motor del plan diario y alcance por ECM y día
  registro.js        asignar motivos (reincidencia, WhatsApp, fotos, enlaces)
  admin2.js config2.js  usuarios, tipos de usuario y permisos, motivos, pesos y configuración
supabase/            funciones de datos y notas (ver supabase/NOTAS.md)
tests/               servidor local y pruebas con Playwright
```

## Modelo de seguridad

- **Alcance de datos** (RLS): `my_role()` devuelve el rol base del tipo de usuario (admin, gerencia, supervisor, asesor).
  Supervisor sin nombre asignado ve todos los equipos; las regiones por usuario limitan Visitas, Tareas y SOS/SOE.
- **Permisos por tipo de usuario** (tabla `roles`): `ver` (pantallas y `pantalla:pestaña`) y `editar` (`carga`, `ecm`, `catalogo`,
  `metas`, `justificar`, `revisar`, `sos_editar`, `ganancias`). `tiene_permiso('...')` los aplica en la base.
  **Cargar bases es exclusivo del administrador.**
- Fotos: bucket privado `evidencias` (JPG/PNG/WebP, 2 MB), con enlaces temporales.
- Alta/baja de usuarios: Edge Function `admin-users` (solo administrador).

## Publicar (GitHub Pages, gratis)

Sitio: **https://djdelgadovalverde-beep.github.io/cn/**

El flujo `.github/workflows/pages.yml` publica la carpeta `web/` en cada `git push` a `main` que la modifique.
Activación (una sola vez):
1. Repositorio **público**: Settings → General → Danger Zone → *Change visibility → Public*
   (en cuentas gratuitas GitHub Pages solo funciona con repositorios públicos; los datos siguen protegidos por la base de datos,
   y en el código solo hay la clave `anon` pública de Supabase).
2. Settings → Pages → *Build and deployment → Source: GitHub Actions*.
3. Pestaña Actions → «Publicar en GitHub Pages» → *Run workflow* (o haz cualquier push que cambie `web/`).

Alternativas opcionales: Cloudflare Pages (`https://cn-desempeno.pages.dev`, publicación manual con `npm run deploy` o con el flujo
manual `cloudflare-pages.yml`) y Netlify (sin uso; `netlify.toml` evita compilaciones automáticas).

## Flujo de trabajo recomendado

```bash
git checkout -b mejora/nombre-corto
# editar en VS Code, probar con npm run dev y npm test
git add -A && git commit -m "Descripción del cambio"
git push -u origin mejora/nombre-corto      # abre un Pull Request en GitHub
```

Los cambios en la base van como migraciones (`supabase migration new …` y `supabase db push`), nunca editando a mano en producción.

## Pendientes conocidos

Resúmenes diarios por correo · importar el avance del plan por Excel · lámina de Proyección en el PowerPoint ·
«arrastre» de PDV sin visita en el resumen semanal · fotos en Google Drive (opcional) · activar en Supabase la protección
contra contraseñas filtradas (Authentication → Policies).
