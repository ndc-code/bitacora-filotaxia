import { qs, qsa, escapeHtml } from '../utils/dom.js';
import { getSession } from '../services/auth.js';
import { listarColeccion, onColeccionChange } from '../services/coleccion.js';
import { listarTerrarios } from '../services/terrarios.js';
import { syncColeccionNavCount } from '../utils/coleccion-nav.js';
import { wireAuthModal } from '../utils/auth-modal.js';
import { wireAuthNav } from '../utils/auth-nav.js';
import { wireTerrarioModal } from '../utils/terrario-modal.js';
import { wireReloj } from '../utils/reloj.js';
import { wireThemeToggle } from '../utils/theme.js';
import { iniciarPagina } from '../utils/guard.js';

const TIPO_TITULO = { abierto: 'Terrarios Abiertos', cerrado: 'Terrarios Cerrados' };

function imagenDeItem(item) {
  const galeria = Array.isArray(item.galeria) ? item.galeria : [];
  return item.imagen || galeria[0] || '';
}

/**
 * Un grupo por terrario: una "etiqueta" del mismo tamaño que un tile,
 * seguida de un tile por ítem. Todos los grupos de una sección fluyen
 * juntos en el mismo grid, como en la referencia de portfolio.
 */
function crearGrupoTiles(terrario, items) {
  const grupo = document.createElement('div');
  grupo.className = 'coleccion-terrario-tiles';
  grupo.dataset.terrarioId = terrario.id;

  const href = `terrario.html?id=${encodeURIComponent(terrario.id)}`;

  const label = document.createElement('a');
  label.className = 'coleccion-terrario-tiles-label';
  label.href = href;
  label.innerHTML = `<span>${escapeHtml(terrario.nombre)}</span>`;
  grupo.appendChild(label);

  for (const item of items) {
    const tile = document.createElement('a');
    tile.className = 'coleccion-tile';
    tile.href = href;
    tile.title = item.nombre || '';
    const imagen = imagenDeItem(item);
    if (imagen) tile.style.backgroundImage = `url("${imagen}")`;
    grupo.appendChild(tile);
  }

  return grupo;
}

function crearSeccionTipo(tipo, grupos) {
  const section = document.createElement('section');
  section.className = 'coleccion-tipo-group';

  const titulo = document.createElement('h2');
  titulo.className = 'coleccion-tipo-titulo';
  titulo.innerHTML = `
    <span class="coleccion-tipo-titulo-label">${escapeHtml(TIPO_TITULO[tipo])}</span>
    <span class="coleccion-tipo-titulo-count">(${grupos.length})</span>
  `;
  section.appendChild(titulo);

  if (grupos.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'coleccion-tipo-vacio';
    vacio.textContent = `Todavía no creaste ningún terrario ${tipo}.`;
    section.appendChild(vacio);
    return section;
  }

  const grid = document.createElement('div');
  grid.className = 'coleccion-grid';
  for (const { terrario, items } of grupos) {
    grid.appendChild(crearGrupoTiles(terrario, items));
  }
  section.appendChild(grid);

  return section;
}

async function render(root) {
  const vacio = qs('#mensaje-vacio');
  if (!root || !vacio) return;

  const [terrarios, items] = await Promise.all([listarTerrarios(), listarColeccion()]);
  root.innerHTML = '';

  vacio.textContent = MENSAJE_SIN_TERRARIOS;
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

  await syncColeccionNavCount();
}

/**
 * Al pasar el mouse por el grupo de tiles de un terrario, el resto se atenúa
 * — así queda claro qué imágenes pertenecen a cuál terrario sin necesidad de
 * separadores visuales pesados entre ellos.
 */
function wireHoverAislado(root) {
  if (!root) return;

  root.addEventListener('mouseover', (event) => {
    const grupo = event.target.closest('.coleccion-terrario-tiles');
    if (!grupo || !root.contains(grupo)) return;

    root.classList.add('has-hover');
    qsa('.coleccion-terrario-tiles', root).forEach((g) => {
      g.classList.toggle('is-active', g === grupo);
    });
  });

  root.addEventListener('mouseout', (event) => {
    const grupo = event.target.closest('.coleccion-terrario-tiles');
    if (!grupo || !root.contains(grupo)) return;
    if (grupo.contains(event.relatedTarget)) return;

    root.classList.remove('has-hover');
    qsa('.coleccion-terrario-tiles', root).forEach((g) => g.classList.remove('is-active'));
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
      authModal.open({
        onSuccess: async () => {
          await authNav.sync();
          activarColeccion();
          abrir();
        },
      });
    });
  });
}

function toggleSidebar() {
  const sidebar = qs('#catalog-sidebar');
  const toggle = qs('#catalog-menu-toggle');
  if (!sidebar || !toggle) return;

  const isOpen = sidebar.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', isOpen);
  document.body.classList.toggle('sidebar-open', isOpen);
}

function closeSidebar() {
  const sidebar = qs('#catalog-sidebar');
  const toggle = qs('#catalog-menu-toggle');
  if (!sidebar || !toggle) return;

  sidebar.classList.remove('is-open');
  toggle.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('sidebar-open');
}

function wireSidebarToggle() {
  const toggle = qs('#catalog-menu-toggle');
  if (!toggle) return;

  toggle.addEventListener('click', toggleSidebar);

  const closeBtn = qs('#catalog-sidebar-close');
  closeBtn?.addEventListener('click', closeSidebar);

  const backdrop = document.body;
  backdrop.addEventListener('click', (event) => {
    const sidebar = qs('#catalog-sidebar');
    if (sidebar && sidebar.classList.contains('is-open') && !sidebar.contains(event.target) && !toggle.contains(event.target)) {
      closeSidebar();
    }
  });
}

const MENSAJE_SIN_SESION = 'Iniciá sesión para ver los ítems de tu colección.';
const MENSAJE_SIN_TERRARIOS =
  'Todavía no creaste ningún terrario. Agregá uno con el botón "+" o sumá algo desde Index.';

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
  wireNuevoTerrario(root, authModal, terrarioModal);
  wireSidebarToggle();
  wireHoverAislado(root);
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
