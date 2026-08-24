# Terrarios como entidad — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introducir terrarios como entidades propias del usuario: se crean con nombre y tipo (abierto/cerrado), cada ítem agregado desde el catálogo de Index queda asociado a uno, y Colección los muestra agrupados en dos bloques ("Terrarios Abiertos"/"Terrarios Cerrados") con sus ítems debajo de cada uno.

**Architecture:** Tabla nueva `terrarios` (Supabase/Postgres) + columna `terrario_id` (FK not null) en `user_collection`. Capa de servicios nueva (`js/services/terrarios.js`) + ajustes en `js/services/coleccion.js`. En Index, el botón "Agregar" deja de ser un toggle y siempre abre un modal nuevo (`js/utils/terrario-modal.js`) para elegir o crear el terrario destino. En Colección, `render()` se reescribe para agrupar por tipo → terrario → ítems, reusando el markup de fila existente (`entryMarkup`).

**Tech Stack:** HTML/CSS/JS vanilla (ES modules, sin bundler), Supabase (Postgres + supabase-js v2 via CDN), `node --test` para los tests unitarios de utilidades puras (sin jsdom — sólo se testean funciones que devuelven strings/valores, no las que tocan el DOM directamente).

**Spec:** [docs/superpowers/specs/2026-08-24-terrarios-design.md](../specs/2026-08-24-terrarios-design.md)

## Global Constraints

- No hay campo de cantidad: el mismo ítem de catálogo se puede agregar repetidas veces al mismo o distinto terrario, cada vez como una fila nueva.
- `tipo` de terrario es sólo `'abierto' | 'cerrado'`, fijado al crear el terrario, sin edición posterior (no pedido, fuera de alcance).
- Cualquier ítem de catálogo puede ir a cualquier tipo de terrario (sin restricción por categoría).
- La colección en Supabase está vacía (confirmado por el usuario): la migración agrega `terrario_id` como `not null` directamente, sin backfill.
- El botón "Agregar" en Index deja de ser un toggle add/remove: siempre agrega (abre el modal de terrario), nunca muestra estado "ya agregado".
- Este repo sólo tiene tests unitarios `node --test` para funciones puras (sin DOM real, sin red). El código que llama a Supabase o manipula el DOM directamente (servicios, modales, páginas) se verifica manualmente en el navegador local — así está el resto del proyecto (`auth.js`, `coleccion.js`, `auth-modal.js` no tienen test files), así que este plan sigue ese mismo patrón en vez de introducir infraestructura de test nueva.

---

## Task 1: Migración SQL — tabla `terrarios` y columna `terrario_id`

**Files:**
- Create: `supabase/migrations/0005_terrarios.sql`

**Interfaces:**
- Produces: tabla `public.terrarios(id, user_id, nombre, tipo, created_at)`; columna `public.user_collection.terrario_id` (uuid, not null, FK a `terrarios.id` con `on delete cascade`). Todas las tareas de servicios (Task 2, Task 4) dependen de que estas dos cosas existan en la base real.

- [ ] **Step 1: Escribir la migración**

```sql
create table public.terrarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('abierto', 'cerrado')),
  created_at timestamptz not null default now()
);

create index terrarios_user_tipo_idx on public.terrarios (user_id, tipo, nombre);

alter table public.terrarios enable row level security;

create policy "terrarios_owner_all" on public.terrarios
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.user_collection
  add column terrario_id uuid not null references public.terrarios (id) on delete cascade;

create index user_collection_terrario_idx on public.user_collection (terrario_id);
```

- [ ] **Step 2: Aplicar la migración en el proyecto Supabase real**

Este paso no se puede automatizar desde acá (no hay acceso a la base real del
proyecto). Copiá el contenido del archivo y ejecutalo en el **SQL Editor**
del dashboard de Supabase del proyecto que usa `js/config.js`
(`https://miujzsovfubbzzvnfavy.supabase.co`), o con `supabase db push` si
tenés la CLI vinculada a ese proyecto.

- [ ] **Step 3: Verificar que se aplicó bien**

Corré esto en el mismo SQL Editor y confirmá que no da error y devuelve 0
filas (tabla nueva, vacía):

```sql
select * from public.terrarios limit 1;
```

Y esto para confirmar que la columna quedó en `user_collection`:

```sql
select column_name, is_nullable
from information_schema.columns
where table_name = 'user_collection' and column_name = 'terrario_id';
```

Debe devolver una fila con `is_nullable = 'NO'`.

- [ ] **Step 4: Chequear que no quede un constraint viejo que bloquee ítems repetidos**

`user_collection` se creó fuera de las migraciones trackeadas (no están en
este repo), así que no se sabe con certeza si tiene un `unique` sobre
`planta_id`/`user_id` de una época anterior en la que el catálogo era un
toggle add/remove. Este feature necesita poder agregar el mismo ítem varias
veces, así que hay que confirmar que no exista. Correr en el SQL Editor:

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.user_collection'::regclass and contype = 'u';
```

Si devuelve alguna fila, anotar el `conname` — va a hacer falta más
adelante (Task 11, Step 4) si al agregar un ítem repetido falla con un
error de duplicado. En ese caso, correr (reemplazando `NOMBRE_DEL_CONSTRAINT`):

```sql
alter table public.user_collection drop constraint NOMBRE_DEL_CONSTRAINT;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_terrarios.sql
git commit -m "Agregar tabla terrarios y FK terrario_id en user_collection"
```

---

## Task 2: Servicio `js/services/terrarios.js`

**Files:**
- Create: `js/services/terrarios.js`

**Interfaces:**
- Consumes: `supabase` desde `js/config.js`; `getSession` desde `js/services/auth.js`.
- Produces:
  - `listarTerrarios(): Promise<Array<{id, user_id, nombre, tipo, created_at}>>` — ordenado por `tipo, nombre`; `[]` si no hay sesión o falla la query.
  - `crearTerrario({ nombre, tipo }): Promise<{ ok: true, terrario } | { ok: false, reason: 'not_authenticated' | 'invalid' | 'error' }>`.
  - `eliminarTerrario(id): Promise<{ ok: true } | { ok: false, reason: 'not_authenticated' | 'missing' | 'error' }>`.
  - Usados por Task 6 (`terrario-modal.js`) y Task 9 (`coleccion.js` — botón "Eliminar terrario").

- [ ] **Step 1: Implementar el servicio**

```javascript
import { supabase } from '../config.js';
import { getSession } from './auth.js';

export async function listarTerrarios() {
  const session = await getSession();
  if (!session?.user?.id) return [];

  const { data, error } = await supabase
    .from('terrarios')
    .select('*')
    .eq('user_id', session.user.id)
    .order('tipo', { ascending: true })
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error listando terrarios:', error);
    return [];
  }

  return data || [];
}

export async function crearTerrario({ nombre, tipo }) {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, reason: 'not_authenticated' };
  }

  if (!nombre || !nombre.trim() || (tipo !== 'abierto' && tipo !== 'cerrado')) {
    return { ok: false, reason: 'invalid' };
  }

  try {
    const { data, error } = await supabase
      .from('terrarios')
      .insert([{ user_id: session.user.id, nombre: nombre.trim(), tipo }])
      .select()
      .single();

    if (error) throw error;

    return { ok: true, terrario: data };
  } catch (error) {
    console.error('Error creando terrario:', error);
    return { ok: false, reason: 'error' };
  }
}

export async function eliminarTerrario(id) {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, reason: 'not_authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('terrarios')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select('id');

    if (error) throw error;

    if (!data || data.length === 0) {
      return { ok: false, reason: 'missing' };
    }

    return { ok: true };
  } catch (error) {
    console.error('Error eliminando terrario:', error);
    return { ok: false, reason: 'error' };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/services/terrarios.js
git commit -m "Agregar servicio de terrarios (listar, crear, eliminar)"
```

---

## Task 3: `idDeColeccion` siempre usa el uuid de fila (TDD)

Corrige el bug latente: con ítems repetidos, borrar por `planta_id` borraría
todas las filas de esa especie en todos los terrarios a la vez.

**Files:**
- Modify: `js/utils/coleccion-card.js:14-16`
- Test: `js/utils/coleccion-card.test.js`

**Interfaces:**
- Produces: `idDeColeccion(planta): string` — ahora siempre `planta.id || ''`. Usado por Task 9 (`coleccion.js`, botón Eliminar por fila) y por `entryMarkup` en el mismo archivo.

- [ ] **Step 1: Reescribir el test que asume el comportamiento viejo**

En `js/utils/coleccion-card.test.js`, reemplazar el test `'Eliminar sigue
usando planta_id y no el uuid de Bitácora'` por uno que exprese el
comportamiento nuevo:

```javascript
test('Eliminar usa el uuid de la fila, no planta_id (permite ítems repetidos)', () => {
  const html = entryMarkup(
    plantaCard({
      id: '11111111-1111-4111-8111-111111111111',
      planta_id: 'aglaonema::aglaonema commutatum::sombra',
    })
  );
  assert.match(html, /data-id="11111111-1111-4111-8111-111111111111"/);
  assert.doesNotMatch(html, /data-id="aglaonema/);
});
```

- [ ] **Step 2: Correr los tests y confirmar que este falla**

Run: `npm test`
Expected: FAIL en el test nuevo (`data-id` todavía sale con `planta_id`
porque `idDeColeccion` no cambió).

- [ ] **Step 3: Cambiar la implementación**

En `js/utils/coleccion-card.js`, reemplazar:

```javascript
export function idDeColeccion(planta) {
  return planta.planta_id || planta.id || '';
}
```

por:

```javascript
export function idDeColeccion(planta) {
  return planta.id || '';
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan todos**

Run: `npm test`
Expected: PASS (36 tests, ninguno roto — el resto de `coleccion-card.test.js`
no depende de `planta_id`).

- [ ] **Step 5: Commit**

```bash
git add js/utils/coleccion-card.js js/utils/coleccion-card.test.js
git commit -m "Usar siempre el uuid de fila para Eliminar en Colección"
```

---

## Task 4: Ajustar `js/services/coleccion.js` para terrarios

**Files:**
- Modify: `js/services/coleccion.js`

**Interfaces:**
- Consumes: nada nuevo (mismo `supabase`/`getSession`).
- Produces:
  - `agregarAColeccion(planta, terrarioId): Promise<{ok, reason?}>` — `terrarioId` es un parámetro nuevo y obligatorio.
  - `listarColeccion(): Promise<Array<item>>` — cada `item` ahora incluye `terrario_id` (columna cruda, ya viene con `select('*')', no requiere cambios de query). Usado por Task 9.
  - `quitarDeColeccion(id): Promise<{ok, reason?}>` — `id` es siempre el uuid propio de la fila (ya no acepta `planta_id`).
  - `estaEnColeccion` se elimina (ya no se usa en ningún lado tras Task 7).

- [ ] **Step 1: Agregar `terrarioId` a `agregarAColeccion`**

En `js/services/coleccion.js`, cambiar la firma y el objeto insertado:

```javascript
export async function agregarAColeccion(planta, terrarioId) {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, reason: 'not_authenticated' };
  }

  if (!terrarioId) {
    return { ok: false, reason: 'invalid' };
  }

  const riegos =
    planta.riegos && typeof planta.riegos === 'object'
      ? planta.riegos
      : {
          verano: planta.riego,
          invierno: planta.riego,
          primavera: planta.riego,
          otoño: planta.riego,
        };

  const nuevoItem = {
    user_id: session.user.id,
    terrario_id: terrarioId,
    planta_id: planta.id,
    nombre: planta.nombre,
    especie: planta.especie,
    riego: planta.riego,
    riegos,
    luz: planta.luz,
    ubicacion: planta.ubicacion,
    suelo: planta.suelo,
    cuidado: planta.cuidado,
    estado: planta.estado || 'Sin registrar',
    ultimoriego: planta.ultimoRiego,
    imagen: planta.imagen || null,
    galeria: Array.isArray(planta.galeria) ? planta.galeria : [],
  };

  try {
    const { error } = await supabase
      .from('user_collection')
      .insert([nuevoItem]);

    if (error) throw error;

    coleccionCache = null;

    return { ok: true };
  } catch (error) {
    console.error('Error agregando a colección:', error);
    return { ok: false, reason: 'error' };
  }
}
```

(Se saca el manejo especial de `error.code === '23505'` como `duplicate`:
ya no hay constraint de unicidad que lo dispare — ítems repetidos son
válidos ahora.)

- [ ] **Step 2: Simplificar `quitarDeColeccion` para borrar por uuid de fila**

Reemplazar toda la función por:

```javascript
export async function quitarDeColeccion(id) {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, reason: 'not_authenticated' };
  }

  try {
    const { data: borradas, error } = await supabase
      .from('user_collection')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select('id');

    if (error) throw error;

    if (!borradas || borradas.length === 0) {
      return { ok: false, reason: 'missing' };
    }

    coleccionCache = null;

    return { ok: true };
  } catch (error) {
    console.error('Error quitando de colección:', error);
    return { ok: false, reason: 'error' };
  }
}
```

- [ ] **Step 3: Borrar `estaEnColeccion`**

Eliminar la función completa (ya no la va a llamar nadie después de
Task 7):

```javascript
export async function estaEnColeccion(id) {
  const items = await leer();
  return items.some((p) => p.planta_id === id || p.id === id);
}
```

- [ ] **Step 4: Correr los tests para confirmar que nada se rompió**

Run: `npm test`
Expected: PASS (esta capa no tiene tests propios, pero confirma que no
quedó ningún `import` roto en archivos que sí se testean).

- [ ] **Step 5: Commit**

```bash
git add js/services/coleccion.js
git commit -m "Agregar terrarioId a agregarAColeccion y simplificar quitarDeColeccion"
```

---

## Task 5: Modal `<dialog id="dialog-terrario">` en Index y Colección

**Files:**
- Modify: `index.html:3653` (justo después de cerrar `</dialog>` de `dialog-auth`)
- Modify: `coleccion.html:94` (justo después de cerrar `</dialog>` de `dialog-auth`)

**Interfaces:**
- Produces: markup con los ids que consume Task 6 (`js/utils/terrario-modal.js`):
  `#dialog-terrario`, `#error-terrario`, `#titulo-terrario`,
  `#terrario-lista-wrap`, `#terrario-lista`, `#btn-mostrar-nuevo-terrario`,
  `#form-nuevo-terrario`, `#terrario-nombre`, `#terrario-tipo`,
  `#btn-crear-terrario`, y un `.modal-close` dentro del dialog.

- [ ] **Step 1: Agregar el dialog en `index.html`**

Insertar esto inmediatamente después de la línea `</dialog>` que cierra
`dialog-auth` (línea 3653), antes del bloque de `<script>`:

```html
<dialog id="dialog-terrario" class="modal">
  <button type="button" class="modal-close" aria-label="Cerrar">&times;</button>
  <p class="field-error" id="error-terrario" hidden></p>
  <h2 id="titulo-terrario">Elegí un terrario</h2>

  <div id="terrario-lista-wrap">
    <div class="terrario-lista" id="terrario-lista"></div>
  </div>

  <button type="button" class="btn-secondary btn" id="btn-mostrar-nuevo-terrario">+ Nuevo terrario</button>

  <form id="form-nuevo-terrario" hidden>
    <div class="field">
      <label for="terrario-nombre">Nombre</label>
      <input class="input" type="text" id="terrario-nombre" placeholder="TR-01" required />
    </div>
    <div class="field">
      <label for="terrario-tipo">Tipo</label>
      <select class="input" id="terrario-tipo">
        <option value="abierto">Abierto</option>
        <option value="cerrado">Cerrado</option>
      </select>
    </div>
    <button class="btn btn-primary" type="submit" id="btn-crear-terrario">Crear terrario</button>
  </form>
</dialog>
```

- [ ] **Step 2: Agregar el mismo dialog en `coleccion.html`**

Insertar el mismo bloque HTML del Step 1 en `coleccion.html`, inmediatamente
después de la línea `</dialog>` que cierra `dialog-auth` (línea 94), antes
del bloque de `<script>`.

- [ ] **Step 3: Commit**

```bash
git add index.html coleccion.html
git commit -m "Agregar markup del modal de terrario a Index y Colección"
```

---

## Task 6: `js/utils/terrario-modal.js`

**Files:**
- Create: `js/utils/terrario-modal.js`

**Interfaces:**
- Consumes: `listarTerrarios`, `crearTerrario` de `js/services/terrarios.js` (Task 2); markup de Task 5; `qs`, `escapeHtml`, `showError`, `clearError` de `js/utils/dom.js`.
- Produces: `wireTerrarioModal(): { open({ modo?: 'elegir' | 'crear', onDone?: (terrarioId: string) => void|Promise<void> }): Promise<void> }`. Usado por Task 7 (`index.js`) y Task 9 (`coleccion.js`).
  - `modo: 'elegir'` (default): si el usuario ya tiene terrarios, muestra la
    lista agrupada por tipo + opción de crear uno nuevo; si no tiene
    ninguno, salta directo al formulario de creación.
  - `modo: 'crear'`: siempre va directo al formulario de creación (sin
    mostrar la lista), usado desde el botón "+ Nuevo terrario" de Colección.
  - Elegir un terrario existente de la lista, o crear uno nuevo, llama
    `onDone(terrarioId)` y cierra el diálogo. Cerrar con la X/Escape/backdrop
    no llama `onDone`.

- [ ] **Step 1: Implementar el módulo**

```javascript
import { qs, escapeHtml, showError, clearError } from './dom.js';
import { listarTerrarios, crearTerrario } from '../services/terrarios.js';

const TIPO_LABEL = { abierto: 'Abiertos', cerrado: 'Cerrados' };

function terrarioOpcionMarkup(terrario) {
  return `
    <label class="terrario-opcion">
      <input type="radio" name="terrario-elegido" value="${escapeHtml(terrario.id)}" />
      ${escapeHtml(terrario.nombre)}
    </label>
  `;
}

function renderLista(container, terrarios) {
  const grupos = { abierto: [], cerrado: [] };
  for (const terrario of terrarios) {
    grupos[terrario.tipo]?.push(terrario);
  }

  container.innerHTML = ['abierto', 'cerrado']
    .filter((tipo) => grupos[tipo].length > 0)
    .map(
      (tipo) => `
        <p class="terrario-lista-tipo">${TIPO_LABEL[tipo]}</p>
        ${grupos[tipo].map(terrarioOpcionMarkup).join('')}
      `
    )
    .join('');
}

/**
 * Modal reusado en Index (elegir/crear terrario al agregar un ítem) y
 * Colección (crear un terrario vacío). Mismo patrón que auth-modal.js: un
 * único <dialog> en el HTML de cada página, wireado una vez, reabierto con
 * distinto `modo` según quién lo llame.
 */
export function wireTerrarioModal() {
  const dialog = qs('#dialog-terrario');
  if (!dialog) return { open: async () => {} };

  const errorEl = qs('#error-terrario', dialog);
  const titulo = qs('#titulo-terrario', dialog);
  const listaWrap = qs('#terrario-lista-wrap', dialog);
  const lista = qs('#terrario-lista', dialog);
  const nuevoToggle = qs('#btn-mostrar-nuevo-terrario', dialog);
  const form = qs('#form-nuevo-terrario', dialog);
  const nombreInput = qs('#terrario-nombre', dialog);
  const tipoInput = qs('#terrario-tipo', dialog);
  const submitBtn = qs('#btn-crear-terrario', dialog);
  const closeBtn = qs('.modal-close', dialog);

  let onDone = null;
  let succeeded = false;

  function mostrarFormulario() {
    nuevoToggle.hidden = true;
    form.hidden = false;
  }

  function resetDialog() {
    clearError(errorEl);
    form.reset();
    form.hidden = true;
    nuevoToggle.hidden = false;
    listaWrap.hidden = false;
    lista.innerHTML = '';
  }

  closeBtn?.addEventListener('click', () => dialog.close());
  nuevoToggle.addEventListener('click', mostrarFormulario);

  dialog.addEventListener('close', () => {
    succeeded = false;
    resetDialog();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError(errorEl);

    const nombre = nombreInput.value.trim();
    if (!nombre) {
      showError(errorEl, 'Ponele un nombre al terrario.');
      return;
    }

    submitBtn.disabled = true;
    const result = await crearTerrario({ nombre, tipo: tipoInput.value });
    submitBtn.disabled = false;

    if (!result.ok) {
      showError(errorEl, 'No pudimos crear el terrario. Probá otra vez.');
      return;
    }

    const callback = onDone;
    succeeded = true;
    dialog.close();
    if (callback) await callback(result.terrario.id);
  });

  lista.addEventListener('change', async (event) => {
    const input = event.target.closest('input[name="terrario-elegido"]');
    if (!input) return;

    const callback = onDone;
    succeeded = true;
    dialog.close();
    if (callback) await callback(input.value);
  });

  return {
    async open({ modo = 'elegir', onDone: onDoneCallback } = {}) {
      onDone = onDoneCallback ?? null;
      resetDialog();

      if (modo === 'crear') {
        titulo.textContent = 'Nuevo terrario';
        listaWrap.hidden = true;
        mostrarFormulario();
        dialog.showModal();
        return;
      }

      const terrarios = await listarTerrarios();

      if (terrarios.length === 0) {
        titulo.textContent = 'Creá tu primer terrario';
        listaWrap.hidden = true;
        mostrarFormulario();
        dialog.showModal();
        return;
      }

      titulo.textContent = 'Elegí un terrario';
      renderLista(lista, terrarios);
      dialog.showModal();
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add js/utils/terrario-modal.js
git commit -m "Agregar modal de elegir/crear terrario"
```

---

## Task 7: `js/pages/index.js` — sacar el toggle, usar el modal de terrario

**Files:**
- Modify: `js/pages/index.js`

**Interfaces:**
- Consumes: `wireTerrarioModal` (Task 6), `agregarAColeccion(planta, terrarioId)` (Task 4).
- Produces: nada nuevo hacia afuera — es la página final que conecta todo lo anterior con la UI de Index.

- [ ] **Step 1: Sacar las funciones de estado del toggle**

En `js/pages/index.js`, eliminar por completo estas funciones (ya no las
usa nadie):

- `etiquetaDisponible`
- `etiquetaAgregado`
- `marcarDisponible`
- `marcarAgregado`
- `syncFilaColeccion`
- `syncBotones`
- `toggleColeccion`
- `onGallery3DSeleccion`

Y sacar estos imports que quedan sin uso:

```javascript
import {
  agregarAColeccion,
  estaEnColeccion,
  idDesdePlanta,
  quitarDeColeccion,
} from '../services/coleccion.js';
```

- [ ] **Step 2: Agregar el import del modal de terrario y la función de agregar**

Cambiar el bloque de imports de servicios por:

```javascript
import { agregarAColeccion, idDesdePlanta } from '../services/coleccion.js';
```

Y agregar el import del modal junto a los demás `utils`:

```javascript
import { wireTerrarioModal } from '../utils/terrario-modal.js';
```

Agregar esta función nueva (reemplaza lo que hacía `toggleColeccion`):

```javascript
async function agregarDesdeBoton(btn, terrarioModal) {
  const planta = plantaDesdeBoton(btn);
  if (!planta.id) {
    planta.id = idDesdePlanta(planta);
  }

  terrarioModal.open({
    modo: 'elegir',
    onDone: async (terrarioId) => {
      await agregarAColeccion(planta, terrarioId);
      await syncColeccionNavCount();
    },
  });
}
```

- [ ] **Step 3: Actualizar `wireAdd` y `wireEntryClickToAdd`**

Reemplazar `wireAdd` por:

```javascript
function wireAdd(root, authModal, terrarioModal) {
  if (!root) return;

  root.addEventListener('click', (event) => {
    const btn = event.target.closest('.catalog-add');
    if (!btn || !root.contains(btn)) return;

    event.preventDefault();
    event.stopPropagation();

    getSession().then((session) => {
      if (session) {
        agregarDesdeBoton(btn, terrarioModal);
        return;
      }
      authModal.open({ onSuccess: () => agregarDesdeBoton(btn, terrarioModal) });
    });
  });
}
```

Y `wireEntryClickToAdd` (mismo cuerpo, cambia sólo qué le pasa al handler):

```javascript
function wireEntryClickToAdd(root, authModal, terrarioModal) {
  if (!root) return;

  root.addEventListener('click', (event) => {
    if (event.target.closest('.catalog-add')) return;
    if (!esDesktopConHover()) return;

    const view = qs('.catalog-page')?.dataset.view;
    if (view === '2' || view === '3') return;

    const entry = event.target.closest('.catalog-entry');
    if (!entry || !root.contains(entry)) return;

    const btn = entry.querySelector('.catalog-add[data-id]');
    if (!btn) return;

    getSession().then((session) => {
      if (session) {
        agregarDesdeBoton(btn, terrarioModal);
        return;
      }
      authModal.open({ onSuccess: () => agregarDesdeBoton(btn, terrarioModal) });
    });
  });
}
```

- [ ] **Step 4: Actualizar el arranque de la página al final del archivo**

Reemplazar el bloque final por:

```javascript
const root = qs('#catalog-rows');
const catalogList = qs('.catalog-list');
const authModal = wireAuthModal();
const terrarioModal = wireTerrarioModal();
wireReloj();
wireThemeToggle();
wireCatalogAccordion(root);
wireAdd(catalogList, authModal, terrarioModal);
wireEntryClickToAdd(catalogList, authModal, terrarioModal);
wireGatedNavLink('#nav-coleccion', authModal);
wireGatedNavLink('#sidebar-nav-coleccion', authModal, { closeSidebarFirst: true });
wireGatedNavLink('#nav-riegos', authModal);
wireGatedNavLink('#sidebar-nav-riegos', authModal, { closeSidebarFirst: true });
wireCatalogFilters(root);
wireFiltersToggle();
wireSidebarToggle();
wireCatalogView({});
wireRiegoEstacion(root, {
  onChange: () => refreshCatalogFilters(root),
});
syncColeccionNavCount().catch(console.error);
```

(Se saca la llamada a `syncBotones()` — ya no existe — y `wireCatalogView`
se llama sin `onGallery3DSeleccion`.)

- [ ] **Step 5: Correr los tests**

Run: `npm test`
Expected: PASS (este archivo no tiene test propio, pero confirma que no
quedó nada roto en los módulos que sí se testean).

- [ ] **Step 6: Commit**

```bash
git add js/pages/index.js
git commit -m "Sacar el toggle de Agregar en Index, usar el modal de terrario"
```

---

## Task 8: CSS del modal de terrario

**Files:**
- Modify: `css/styles.css`

**Interfaces:**
- Produces: estilos para `.terrario-lista`, `.terrario-lista-tipo`,
  `.terrario-opcion` (usadas por el markup que genera `terrario-modal.js`
  en Task 6). El resto del modal (`.modal`, `.field`, `.input`,
  `.btn-primary`, `.field-error`) ya existe y se reusa sin cambios.

- [ ] **Step 1: Agregar las reglas nuevas**

Agregar esto al final de `css/styles.css`, cerca de las reglas de
`.modal` existentes (después de la línea `1667` donde termina
`.modal .field-status`):

```css
.terrario-lista {
  margin-bottom: var(--space-4);
}

.terrario-lista-tipo {
  margin: var(--space-4) 0 var(--space-2);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-gray-mid);
}

.terrario-lista-tipo:first-child {
  margin-top: 0;
}

.terrario-opcion {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  font-size: 16px;
  color: var(--color-ink);
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
}

.terrario-opcion input {
  cursor: pointer;
}

#btn-mostrar-nuevo-terrario {
  width: 100%;
  margin-bottom: var(--space-4);
}
```

- [ ] **Step 2: Commit**

```bash
git add css/styles.css
git commit -m "Agregar estilos del modal de terrario"
```

---

## Task 9: `js/pages/coleccion.js` — agrupar por tipo → terrario → ítems

**Files:**
- Modify: `js/pages/coleccion.js`

**Interfaces:**
- Consumes: `listarTerrarios`, `eliminarTerrario` (Task 2); `listarColeccion`, `quitarDeColeccion` (Task 4); `idDeColeccion`, `entryMarkup` (Task 3); `wireTerrarioModal` (Task 6); `escapeHtml`, `qsa` (`js/utils/dom.js`).
- Produces: markup con clases nuevas (`.coleccion-tipo-group`,
  `.coleccion-tipo-titulo`, `.coleccion-tipo-vacio`,
  `.coleccion-terrario-group`, `.coleccion-terrario-header`,
  `.coleccion-terrario-nombre`, `.coleccion-terrario-count`,
  `.coleccion-terrario-eliminar-btn`, `.coleccion-terrario-rows`) que
  consume Task 10 (CSS).

- [ ] **Step 1: Agregar el botón "+ Nuevo terrario" y actualizar el mensaje vacío en `coleccion.html`**

En `coleccion.html`, dentro de `<main class="catalog-list" ...>`, justo
antes de `<div id="coleccion-rows" ...>`, agregar:

```html
<button type="button" class="btn btn-secondary" id="btn-nuevo-terrario">+ Nuevo terrario</button>
```

Y cambiar el texto del mensaje vacío existente:

```html
<p id="mensaje-vacio" class="catalog-empty" hidden>
  Todavía no creaste ningún terrario. Agregá uno con "+ Nuevo terrario" o sumá algo desde Index.
</p>
```

- [ ] **Step 2: Reescribir los imports y el render de `coleccion.js`**

Reemplazar el bloque de imports del principio del archivo por:

```javascript
import { qs, qsa, escapeHtml } from '../utils/dom.js';
import { getSession } from '../services/auth.js';
import { listarColeccion, quitarDeColeccion, onColeccionChange } from '../services/coleccion.js';
import { listarTerrarios, eliminarTerrario } from '../services/terrarios.js';
import { entryMarkup, idDeColeccion } from '../utils/coleccion-card.js';
import { syncColeccionNavCount } from '../utils/coleccion-nav.js';
import { wireAuthModal } from '../utils/auth-modal.js';
import { wireAuthNav } from '../utils/auth-nav.js';
import { wireTerrarioModal } from '../utils/terrario-modal.js';
import { wireReloj } from '../utils/reloj.js';
import { wireThemeToggle } from '../utils/theme.js';
import { iniciarPagina, mostrarErrorDePagina } from '../utils/guard.js';

const TIPO_TITULO = { abierto: 'Terrarios Abiertos', cerrado: 'Terrarios Cerrados' };
```

Reemplazar `render` y agregar las funciones auxiliares que arman el
markup agrupado (van todas antes de `render`, después de la constante
`TIPO_TITULO`):

```javascript
function crearFilaItem(item) {
  const entry = document.createElement('div');
  entry.className = 'catalog-entry';
  entry.dataset.id = idDeColeccion(item);
  entry.dataset.nombre = item.nombre || '';
  entry.innerHTML = entryMarkup(item);
  return entry;
}

function crearGrupoTerrario({ terrario, items }) {
  const section = document.createElement('div');
  section.className = 'coleccion-terrario-group';

  section.innerHTML = `
    <div class="coleccion-terrario-header">
      <span class="coleccion-terrario-nombre">${escapeHtml(terrario.nombre)}</span>
      <span class="coleccion-terrario-count">(${items.length})</span>
      <button type="button" class="coleccion-terrario-eliminar-btn" data-terrario-id="${escapeHtml(terrario.id)}">Eliminar terrario</button>
    </div>
    <div class="coleccion-terrario-rows"></div>
  `;

  const rows = qs('.coleccion-terrario-rows', section);
  for (const item of items) {
    rows.appendChild(crearFilaItem(item));
  }

  return section;
}

function crearSeccionTipo(tipo, grupos) {
  const section = document.createElement('section');
  section.className = 'coleccion-tipo-group';

  const titulo = document.createElement('h2');
  titulo.className = 'coleccion-tipo-titulo';
  titulo.textContent = TIPO_TITULO[tipo];
  section.appendChild(titulo);

  if (grupos.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'coleccion-tipo-vacio';
    vacio.textContent = `Todavía no creaste ningún terrario ${tipo}.`;
    section.appendChild(vacio);
    return section;
  }

  for (const grupo of grupos) {
    section.appendChild(crearGrupoTerrario(grupo));
  }

  return section;
}

async function render(root) {
  const vacio = qs('#mensaje-vacio');
  if (!root || !vacio) return;

  const [terrarios, items] = await Promise.all([listarTerrarios(), listarColeccion()]);
  root.innerHTML = '';

  vacio.hidden = terrarios.length > 0;

  const itemsPorTerrario = new Map();
  for (const item of items) {
    const lista = itemsPorTerrario.get(item.terrario_id) || [];
    lista.push(item);
    itemsPorTerrario.set(item.terrario_id, lista);
  }

  const porTipo = { abierto: [], cerrado: [] };
  for (const terrario of terrarios) {
    porTipo[terrario.tipo]?.push({ terrario, items: itemsPorTerrario.get(terrario.id) || [] });
  }

  root.appendChild(crearSeccionTipo('abierto', porTipo.abierto));
  root.appendChild(crearSeccionTipo('cerrado', porTipo.cerrado));

  mostrarPreviewInicial(root);
  await syncColeccionNavCount();
}
```

`mostrarPreviewInicial` y `wirePreview` quedan exactamente igual que hoy
(usan `root.querySelector`/delegación, que siguen funcionando con el
árbol anidado nuevo).

- [ ] **Step 3: Agregar el wiring de "Eliminar terrario" y "+ Nuevo terrario"**

Agregar estas dos funciones (después de `wireEliminar`, que queda sin
cambios):

```javascript
function wireEliminarTerrario(root) {
  if (!root) return;

  root.addEventListener('click', async (event) => {
    const btn = event.target.closest('.coleccion-terrario-eliminar-btn');
    if (!btn || !root.contains(btn)) return;

    const terrarioId = btn.dataset.terrarioId;
    if (!terrarioId) return;

    const grupo = btn.closest('.coleccion-terrario-group');
    const cantidad = qsa('.catalog-entry', grupo).length;
    const confirmado = window.confirm(
      cantidad > 0
        ? `¿Eliminar este terrario y sus ${cantidad} ítems? No se puede deshacer.`
        : '¿Eliminar este terrario? No se puede deshacer.'
    );
    if (!confirmado) return;

    btn.disabled = true;
    const result = await eliminarTerrario(terrarioId);

    if (result.ok) {
      await render(root);
      return;
    }

    btn.disabled = false;
    mostrarErrorDePagina('No pudimos eliminar el terrario. Probá otra vez.');
  });
}

function wireNuevoTerrario(root, authModal, terrarioModal) {
  const btn = qs('#btn-nuevo-terrario');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const abrir = () => terrarioModal.open({ modo: 'crear', onDone: () => render(root) });

    getSession().then((session) => {
      if (session) {
        abrir();
        return;
      }
      authModal.open({ onSuccess: abrir });
    });
  });
}
```

- [ ] **Step 4: Conectar todo en `montarChrome`/`init`**

Reemplazar la sección final del archivo (desde `const root = ...` hasta
el `iniciarPagina(...)`) por:

```javascript
const MENSAJE_SIN_SESION = 'Iniciá sesión para ver los ítems de tu colección.';

const root = qs('#coleccion-rows');
const authModal = wireAuthModal();
const authNav = wireAuthNav({ onLogin: abrirLogin });
const terrarioModal = wireTerrarioModal();

let coleccionActiva = false;

function abrirLogin() {
  authModal.open({
    onSuccess: async () => {
      await authNav.sync();
      activarColeccion();
    },
  });
}

function montarChrome() {
  wireReloj();
  wireThemeToggle();
  wireEliminar(root);
  wireEliminarTerrario(root);
  wireNuevoTerrario(root, authModal, terrarioModal);
  wireSidebarToggle();
  wirePreview(root);
}

function mostrarEstadoSinSesion() {
  if (root) root.innerHTML = '';
  const vacio = qs('#mensaje-vacio');
  if (vacio) {
    vacio.textContent = MENSAJE_SIN_SESION;
    vacio.hidden = false;
  }
  syncColeccionNavCount();
}

function activarColeccion() {
  render(root);
  syncColeccionNavCount();

  if (coleccionActiva) return;
  coleccionActiva = true;

  const unsubscribe = onColeccionChange(() => {
    render(root).catch(console.error);
  });

  window.addEventListener('beforeunload', unsubscribe, { once: true });
}

iniciarPagina(async function init() {
  qs('#coleccion-contenido').hidden = false;
  montarChrome();
  await authNav.sync();

  if (await getSession()) {
    activarColeccion();
    return;
  }

  mostrarEstadoSinSesion();
});
```

(Se saca `MENSAJE_SIN_PLANTAS`: `render()` ahora arma el texto de "sin
terrarios" directamente en `#mensaje-vacio` la primera vez que se muestra,
así que no hace falta reasignarlo antes de cada `render`. `mostrarEstadoSinSesion`
mantiene su propio mensaje de "sin sesión" aparte.)

`toggleSidebar`/`closeSidebar`/`wireSidebarToggle` quedan igual que hoy,
sin cambios.

- [ ] **Step 5: Correr los tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add coleccion.html js/pages/coleccion.js
git commit -m "Reagrupar Colección en Terrarios Abiertos/Cerrados"
```

---

## Task 10: CSS de la Colección agrupada

**Files:**
- Modify: `css/styles.css`

**Interfaces:**
- Produces: estilos para las clases que genera `coleccion.js` en Task 9.

- [ ] **Step 1: Agregar las reglas nuevas**

Agregar esto al final de `css/styles.css`:

```css
.coleccion-tipo-group {
  margin-top: 60px;
}

.coleccion-tipo-group:first-child {
  margin-top: 0;
}

.coleccion-tipo-titulo {
  font-family: var(--font-heading);
  font-weight: 400;
  font-size: clamp(40px, 6vw, 64px);
  letter-spacing: -3px;
  margin: 0 0 var(--space-4);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-ink);
  color: var(--color-ink);
}

.coleccion-tipo-vacio {
  color: var(--color-gray-mid);
  font-size: 14px;
  margin: 0 0 var(--space-8);
}

.coleccion-terrario-group {
  margin: 0 0 var(--space-8);
}

.coleccion-terrario-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.coleccion-terrario-nombre {
  font-family: var(--font-heading);
  font-weight: 400;
  font-size: 24px;
  color: var(--color-ink);
}

.coleccion-terrario-count {
  font-size: 14px;
  color: var(--color-gray-mid);
}

.coleccion-terrario-eliminar-btn {
  margin-left: auto;
  padding: 0;
  border: 0;
  background: transparent;
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--color-gray-mid);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.coleccion-terrario-eliminar-btn:hover {
  color: var(--color-terracotta);
}

.coleccion-terrario-rows {
  border-top: 1px solid var(--color-border);
}

#btn-nuevo-terrario {
  margin-top: 70px;
}

.catalog-page--coleccion #btn-nuevo-terrario ~ #coleccion-rows .coleccion-tipo-group:first-child {
  margin-top: var(--space-8);
}
```

- [ ] **Step 2: Commit**

```bash
git add css/styles.css
git commit -m "Agregar estilos de la Colección agrupada por terrario"
```

---

## Task 11: Verificación manual end-to-end en el navegador

**Files:** ninguno (sólo verificación).

**Interfaces:** ninguna — cierra el flujo completo de las tareas 1-10.

- [ ] **Step 1: Confirmar que la migración (Task 1) ya se aplicó**

Si todavía no se aplicó el SQL de la Task 1 contra el proyecto real de
Supabase, hacerlo ahora — nada de lo siguiente funciona sin eso.

- [ ] **Step 2: Levantar el servidor local y loguearse**

```bash
python3 -m http.server 4174
```

Abrir `http://localhost:4174/index.html`, iniciar sesión (o crear una
cuenta de prueba).

- [ ] **Step 3: Crear el primer terrario agregando un ítem desde Index**

Click en "Agregar" de cualquier ítem del catálogo (ej. "Aloe mini" en
Suculentas). Confirmar que se abre el modal directo en "Creá tu primer
terrario" (sin lista, porque todavía no hay ninguno). Completar nombre
"TR-01", tipo "Abierto", click "Crear terrario". Confirmar que el modal
se cierra sin errores.

- [ ] **Step 4: Agregar un segundo ítem al mismo terrario, y uno repetido**

Click en "Agregar" de otro ítem (ej. "Musgo de Java"). Esta vez el modal
debe mostrar la lista con "TR-01" bajo "Abiertos" más la opción
"+ Nuevo terrario". Elegir "TR-01" — el modal se cierra solo. Repetir con
"Aloe mini" de nuevo (el mismo ítem que ya está en TR-01) y elegir TR-01
otra vez: debe agregarse una segunda fila sin error de duplicado. Si falla
con un error de constraint duplicado, volver a la Task 1 Step 4: hay un
`unique` viejo en `user_collection` que hay que dropear.

- [ ] **Step 5: Crear un segundo terrario desde Colección**

Ir a Colección. Confirmar que aparece la sección "Terrarios Abiertos" con
"TR-01 (3)" y sus 3 filas (Aloe mini x2, Musgo de Java x1), y la sección
"Terrarios Cerrados" con el mensaje "Todavía no creaste ningún terrario
cerrado." Click en "+ Nuevo terrario", crear "TR-02" tipo "Cerrado".
Confirmar que aparece en "Terrarios Cerrados" con "(0)" ítems.

- [ ] **Step 6: Eliminar un ítem puntual sin afectar el resto**

En TR-01, click "Eliminar" en una sola de las dos filas de "Aloe mini".
Confirmar que sólo desaparece esa fila y la otra ("Aloe mini" + "Musgo de
Java") sigue ahí — esto verifica el fix de la Task 3.

- [ ] **Step 7: Eliminar un terrario completo**

Click "Eliminar terrario" en TR-01. Confirmar el diálogo nativo menciona
la cantidad de ítems restantes. Confirmar que tras aceptar, la sección
"Terrarios Abiertos" vuelve al mensaje de vacío y TR-01 desapareció.

- [ ] **Step 8: Revisar la consola del navegador**

Usar las herramientas de la Browser pane (`read_console_messages` con
`onlyErrors: true`) y confirmar que no quedó ningún error tras todo el
flujo anterior.
