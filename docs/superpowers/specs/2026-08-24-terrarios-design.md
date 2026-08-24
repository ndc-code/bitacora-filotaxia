# Terrarios como entidad — diseño

## Contexto

Hoy `user_collection` es una lista plana: cada fila es un ítem de catálogo
que el usuario sumó (toggle Agregar/Eliminar, sin agrupar). Las categorías
de catálogo "Terrarios Abiertos" y "Terrarios Cerrados" en Index eran en
realidad listas de especies de plantas, no terrarios del usuario (ya
reorganizadas en un cambio previo: ver commit "Reorganizar categorías de
catálogo").

El flujo real que se quiere modelar: el usuario crea terrarios propios
(ej. "TR-01", tipo abierto o cerrado), y cada ítem que agrega desde el
catálogo de Index queda asociado a uno de esos terrarios. Colección pasa a
mostrar los terrarios del usuario agrupados por tipo, con sus ítems debajo.

La colección de Supabase está vacía (datos de prueba), así que no hace
falta migrar filas existentes.

## Modelo de datos

Migración nueva `supabase/migrations/0005_terrarios.sql`:

- Tabla `terrarios`:
  - `id uuid primary key default gen_random_uuid()`
  - `user_id uuid not null references auth.users (id) on delete cascade`
  - `nombre text not null`
  - `tipo text not null check (tipo in ('abierto', 'cerrado'))`
  - `created_at timestamptz not null default now()`
  - RLS: policy `terrarios_owner_all` (`for all`, `using`/`with check` por
    `user_id = (select auth.uid())`), igual al patrón de `plantas_owner_all`
    en `0001_init.sql`.
  - Índice por `(user_id, tipo)` para el listado agrupado.
- `user_collection`:
  - `alter table ... add column terrario_id uuid not null references public.terrarios (id) on delete cascade;`
  - Índice por `terrario_id` para el join de Colección.
- No se toca la policy existente de `user_collection` (no está en las
  migraciones trackeadas — se creó fuera de git — así que no se reescribe a
  ciegas). La integridad de que `terrario_id` pertenezca al mismo usuario
  queda garantizada en la práctica porque el cliente sólo puede leer/elegir
  terrarios propios (RLS de `terrarios`) y siempre inserta con su propio
  `user_id` en ambas tablas.
- Se permite repetir el mismo ítem de catálogo cualquier cantidad de veces,
  en el mismo o distinto terrario — no hay campo de cantidad ni constraint
  de unicidad por `planta_id`.

## Capa de servicios

Nuevo `js/services/terrarios.js` (mismo estilo que `coleccion.js`, sin cache
local — son pocas filas y cambian poco):

- `listarTerrarios()` → todos los terrarios del usuario, ordenados por
  `tipo, nombre`.
- `crearTerrario({ nombre, tipo })` → inserta y devuelve `{ ok, terrario }`
  o `{ ok: false, reason }`.
- `eliminarTerrario(id)` → borra (cascada a `user_collection` y de ahí a
  `coleccion_cuidados`/`coleccion_fotos`, ya cascadean). Devuelve
  `{ ok, reason? }`.

`js/services/coleccion.js`:

- `agregarAColeccion(planta, terrarioId)` — nuevo parámetro obligatorio,
  se agrega `terrario_id` al insert.
- `listarColeccion()` — el select suma el join
  `.select('*, terrario:terrarios(id, nombre, tipo)')` para que Colección
  pueda agrupar sin queries extra.
- `quitarDeColeccion(id)` — se simplifica: `id` es siempre el `id` propio
  de la fila (uuid). Se borra `delete from user_collection where id = :id
  and user_id = :uid`, sin el matching dual por `planta_id` que tenía antes
  (ese matching existía sólo para soportar el toggle de Index, que
  desaparece — ver más abajo). Esto corrige un bug latente: con ítems
  repetidos, borrar por `planta_id` habría borrado todas las filas de esa
  especie en todos los terrarios a la vez.
- `estaEnColeccion(id)` se elimina (dead code tras sacar el toggle).

`js/utils/coleccion-card.js`:

- `idDeColeccion(planta)` pasa a devolver siempre `planta.id` (antes
  priorizaba `planta.planta_id`). Es el id que usa el botón Eliminar de
  Colección.

## Flujo "Agregar" en Index

Cambio de comportamiento: el botón deja de ser un toggle add/remove.
Siempre agrega (nunca pasa a mostrar "Eliminar"), porque el mismo ítem
puede estar en varios terrarios a la vez y ya no hay un único estado
"agregado" que representar.

- `index.js`: se elimina toda la lógica de estado (`marcarAgregado`,
  `marcarDisponible`, `syncFilaColeccion`, `syncBotones`,
  `onGallery3DSeleccion` deja de togglear clases `is-added`). El click en
  "Agregar" abre el modal de selección/creación de terrario; al confirmar,
  llama `agregarAColeccion(planta, terrarioId)` y listo (sin re-render de
  estado del botón).
- Nuevo modal `<dialog id="dialog-terrario">` en `index.html` (mismo patrón
  que `dialog-auth`): lista los terrarios del usuario agrupados en
  "Abiertos"/"Cerrados" como filas clickeables, más una sección
  "+ Nuevo terrario" con input de nombre y radio abierto/cerrado. Un solo
  submit: si hay un terrario elegido usa ese id, si se completó el form de
  nuevo terrario lo crea primero y usa el id devuelto.
- Nuevo `js/utils/terrario-modal.js` (paralelo a `auth-modal.js`) que
  wirea ese dialog y expone `open({ planta, onAdded })`.
- Si el usuario no tiene sesión, se abre primero el modal de login
  (comportamiento actual sin cambios) y al loguearse se abre el modal de
  terrario.
- Si el usuario no tiene ningún terrario todavía, el modal arranca
  directamente en el formulario de "Nuevo terrario" (sin mostrar una lista
  vacía).

## Página Colección

Reestructura de `coleccion.js` + `coleccion.html`:

- Dos secciones fijas: "Terrarios Abiertos" y "Terrarios Cerrados".
- Dentro de cada una, un bloque por terrario del usuario de ese tipo:
  encabezado con nombre + cantidad de ítems + botón "Eliminar terrario", y
  debajo las filas de sus ítems reusando `entryMarkup` (mismo formato de
  fila que hoy, link a bitácora + botón Eliminar por fila).
- Terrario sin ítems: el bloque igual se muestra (nombre + "(0)"), para que
  el usuario vea que existe y pueda agregarle cosas desde Index.
- Ningún terrario de un tipo todavía: mensaje corto dentro de esa sección
  ("Todavía no creaste ningún terrario abierto.").
- Botón "+ Nuevo terrario" en la página (reusa el mismo modal/lógica de
  creación que Index, sin la parte de elegir planta — acá sólo crea el
  terrario vacío).
- "Eliminar terrario": confirm nativo (`confirm()`, consistente con no
  haber otro patrón de confirmación en la app hoy) mencionando cuántos
  ítems se van a borrar con él, después llama `eliminarTerrario(id)` y
  re-renderiza.

## Fuera de alcance

- Renombrar un terrario o cambiar su tipo después de creado: no pedido,
  no se implementa.
- Cantidad por ítem: descartado explícitamente por el usuario a favor de
  filas repetidas.
- Restringir qué categorías de catálogo pueden ir en terrarios abiertos vs
  cerrados: no pedido; cualquier ítem puede ir a cualquier terrario.
- `riegos.html`: sigue listando todos los próximos riegos de la colección
  entera sin agrupar por terrario (no pedido, no rompe con este cambio).

## Testing

- Tests unitarios existentes de `catalog-categorias`, `coleccion-card`,
  `riego-frecuencia`, etc. no deberían romperse (no tocan terrarios
  directamente), salvo `coleccion-card.test.js`, que hay que actualizar
  para el nuevo comportamiento de `idDeColeccion` (siempre `id`, ya no
  prioriza `planta_id`).
- Verificación manual en el navegador local: crear un terrario desde
  Index al agregar un ítem, agregar un segundo ítem repetido al mismo
  terrario, crear un segundo terrario desde Colección, eliminar un ítem
  puntual y confirmar que no afecta a las otras filas repetidas, eliminar
  un terrario completo y confirmar que desaparecen sus ítems.
