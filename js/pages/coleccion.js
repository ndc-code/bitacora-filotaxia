import { qs, qsa, escapeHtml } from '../utils/dom.js';
import { getSession } from '../services/auth.js';
import { listarColeccion, onColeccionChange } from '../services/coleccion.js';
import { listarTerrarios } from '../services/terrarios.js';
import { syncColeccionNavCount } from '../utils/coleccion-nav.js';
import { wireAuthModal } from '../utils/auth-modal.js';
import { wireAuthNav } from '../utils/auth-nav.js';
import { wireReloj } from '../utils/reloj.js';
import { wireThemeToggle } from '../utils/theme.js';
import { iniciarPagina } from '../utils/guard.js';

const TIPO_TITULO = { abierto: 'Abiertos', cerrado: 'Cerrados' };

function imagenDeTerrario(items) {
  for (const item of items) {
    const galeria = Array.isArray(item.galeria) ? item.galeria : [];
    const imagen = item.imagen || galeria[0];
    if (imagen) return imagen;
  }
  return '';
}

/**
 * Un tile por terrario (una sola imagen representativa, la del primer ítem
 * que tenga una), que lleva directo a su bitácora — ahí vive el contenido
 * completo del terrario (sus ítems, cuidados, riego, galería).
 */
function crearTileTerrario(terrario, items) {
  const tile = document.createElement('a');
  tile.className = 'coleccion-terrario-tile';
  tile.href = `bitacora.html?id=${encodeURIComponent(terrario.id)}`;
  tile.dataset.terrarioId = terrario.id;

  const imagenDiv = document.createElement('div');
  imagenDiv.className = 'coleccion-terrario-tile-imagen';
  const imagen = imagenDeTerrario(items);
  if (imagen) imagenDiv.style.backgroundImage = `url("${imagen}")`;
  tile.appendChild(imagenDiv);

  const nombre = document.createElement('span');
  nombre.className = 'coleccion-terrario-tile-nombre';
  nombre.textContent = terrario.nombre;
  tile.appendChild(nombre);

  return tile;
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
    grid.appendChild(crearTileTerrario(terrario, items));
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
 * Al pasar el mouse por el tile de un terrario, el resto se atenúa — así
 * queda claro cuál es cuál sin necesidad de separadores visuales pesados.
 */
function wireHoverAislado(root) {
  if (!root) return;

  root.addEventListener('mouseover', (event) => {
    const tile = event.target.closest('.coleccion-terrario-tile');
    if (!tile || !root.contains(tile)) return;

    root.classList.add('has-hover');
    qsa('.coleccion-terrario-tile', root).forEach((t) => {
      t.classList.toggle('is-active', t === tile);
    });
  });

  root.addEventListener('mouseout', (event) => {
    const tile = event.target.closest('.coleccion-terrario-tile');
    if (!tile || !root.contains(tile)) return;
    if (tile.contains(event.relatedTarget)) return;

    root.classList.remove('has-hover');
    qsa('.coleccion-terrario-tile', root).forEach((t) => t.classList.remove('is-active'));
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
  'Todavía no creaste ningún terrario. Sumá algo desde Index para crear el primero.';

const root = qs('#coleccion-rows');
const authModal = wireAuthModal();
const authNav = wireAuthNav({ onLogin: abrirLogin });

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
