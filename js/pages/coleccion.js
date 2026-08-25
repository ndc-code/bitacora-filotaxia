import { qs, qsa, escapeHtml } from '../utils/dom.js';
import { getSession } from '../services/auth.js';
import { listarColeccion, quitarDeColeccion, onColeccionChange, limpiarCacheColeccion } from '../services/coleccion.js';
import { listarTerrarios, eliminarTerrario } from '../services/terrarios.js';
import { filaTablaMarkup, idDeColeccion, riegosDePlanta } from '../utils/coleccion-card.js';
import { syncColeccionNavCount } from '../utils/coleccion-nav.js';
import { wireAuthModal } from '../utils/auth-modal.js';
import { wireAuthNav } from '../utils/auth-nav.js';
import { wireTerrarioModal } from '../utils/terrario-modal.js';
import { wireReloj } from '../utils/reloj.js';
import { wireThemeToggle } from '../utils/theme.js';
import { wireRiegoEstacion, refreshRiegoEstacion } from '../utils/catalog-riego-estacion.js';
import { iniciarPagina, mostrarErrorDePagina } from '../utils/guard.js';

const TIPO_TITULO = { abierto: 'Terrarios Abiertos', cerrado: 'Terrarios Cerrados' };

/**
 * Header de tabla igual al de Index (mismo `--catalog-columns`, mismo toggle
 * de estación), para que ambas páginas se vean y se comporten igual.
 */
function headerTablaMarkup() {
  return `
    <div class="catalog-row is-header" role="row">
      <span>Nombre</span>
      <span>Especie</span>
      <span>Sol</span>
      <span>Luminosidad</span>
      <button type="button" class="catalog-riego-toggle" data-estacion="verano" aria-label="Riego en verano. Clic para cambiar estación">
        Riego <span class="riego-estacion-label">(verano)</span>
      </button>
      <span>Clima</span>
      <span>Suelo</span>
      <span>Cuidado</span>
      <span class="catalog-cell--action">Eliminar</span>
    </div>
  `;
}

function crearFilaItem(item) {
  const entry = document.createElement('div');
  entry.className = 'catalog-entry';
  entry.dataset.id = idDeColeccion(item);
  entry.dataset.nombre = item.nombre || '';
  entry.dataset.riego = item.riego || '—';
  entry.dataset.riegos = JSON.stringify(riegosDePlanta(item));
  entry.innerHTML = filaTablaMarkup(item);
  return entry;
}

function crearGrupoTerrario({ terrario, items }) {
  const section = document.createElement('div');
  section.className = 'coleccion-terrario-group';
  const nombre = escapeHtml(terrario.nombre);

  section.innerHTML = `
    <div class="coleccion-terrario-header">
      <span class="coleccion-terrario-nombre">${nombre}</span>
      <button
        type="button"
        class="coleccion-terrario-eliminar-btn"
        data-terrario-id="${escapeHtml(terrario.id)}"
        title="Eliminar terrario"
        aria-label="Eliminar terrario ${nombre}"
      >Eliminar terrario</button>
    </div>
  `;

  if (items.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'coleccion-terrario-vacio';
    vacio.textContent = 'Todavía no le agregaste nada a este terrario.';
    section.appendChild(vacio);
    return section;
  }

  const tabla = document.createElement('div');
  tabla.className = 'catalog-group-table';
  tabla.innerHTML = headerTablaMarkup();
  for (const item of items) {
    tabla.appendChild(crearFilaItem(item));
  }
  section.appendChild(tabla);

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

  const lista = document.createElement('div');
  lista.className = 'coleccion-tipo-lista';
  for (const grupo of grupos) {
    lista.appendChild(crearGrupoTerrario(grupo));
  }
  section.appendChild(lista);

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

  refreshRiegoEstacion(root);
  await syncColeccionNavCount();
}

function wireEliminar(root) {
  if (!root) return;

  root.addEventListener('click', async (event) => {
    const btn = event.target.closest('.coleccion-eliminar-btn');
    if (!btn || !root.contains(btn)) return;

    event.preventDefault();
    event.stopPropagation();

    const id = btn.dataset.id;
    if (!id) return;
    if (btn.disabled) return;

    btn.disabled = true;
    const textoOriginal = btn.textContent;
    btn.textContent = 'Eliminando…';

    try {
      const result = await quitarDeColeccion(id);

      if (result.ok || result.reason === 'missing') {
        await render(root);
        return;
      }

      btn.disabled = false;
      btn.textContent = textoOriginal;
      mostrarErrorDePagina(
        result.reason === 'not_authenticated'
          ? 'Iniciá sesión de nuevo para editar tu colección.'
          : 'No pudimos eliminar el ítem de tu colección. Probá otra vez.'
      );
    } catch (error) {
      console.error('Error eliminando de la colección', error);
      btn.disabled = false;
      btn.textContent = textoOriginal;
      mostrarErrorDePagina('No pudimos eliminar el ítem de tu colección. Probá otra vez.');
    }
  });
}

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
      limpiarCacheColeccion();
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
  wireEliminar(root);
  wireEliminarTerrario(root);
  wireNuevoTerrario(root, authModal, terrarioModal);
  wireSidebarToggle();
  wireRiegoEstacion(root, {});
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
