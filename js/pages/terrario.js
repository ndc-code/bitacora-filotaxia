import { qs, escapeHtml } from '../utils/dom.js';
import { getSession } from '../services/auth.js';
import { listarColeccion, quitarDeColeccion } from '../services/coleccion.js';
import { obtenerTerrario, eliminarTerrario } from '../services/terrarios.js';
import { idDeColeccion } from '../utils/coleccion-card.js';
import { syncColeccionNavCount } from '../utils/coleccion-nav.js';
import { wireAuthModal } from '../utils/auth-modal.js';
import { wireAuthNav } from '../utils/auth-nav.js';
import { wireReloj } from '../utils/reloj.js';
import { wireThemeToggle } from '../utils/theme.js';
import { iniciarPagina, mostrarErrorDePagina } from '../utils/guard.js';

const TIPO_LABEL = { abierto: 'Terrario abierto', cerrado: 'Terrario cerrado' };

const terrarioId = new URLSearchParams(window.location.search).get('id');

function crearTarjetaItem(item) {
  const id = idDeColeccion(item);
  const nombre = escapeHtml(item.nombre || '');
  const imagen = item.imagen || (Array.isArray(item.galeria) ? item.galeria[0] : '') || '';

  const card = document.createElement('div');
  card.className = 'terrario-item';
  card.dataset.id = id;

  const link = document.createElement('a');
  link.className = 'terrario-item-imagen';
  link.href = `bitacora.html?id=${encodeURIComponent(id)}`;
  if (imagen) link.style.backgroundImage = `url("${imagen}")`;
  card.appendChild(link);

  card.innerHTML += `
    <div class="terrario-item-info">
      <a class="terrario-item-nombre" href="bitacora.html?id=${encodeURIComponent(id)}">${nombre}</a>
      <button type="button" class="coleccion-eliminar-btn" data-id="${escapeHtml(id)}" title="Eliminar de Colección" aria-label="Eliminar ${nombre} de Colección">Eliminar</button>
    </div>
  `;

  return card;
}

async function renderItems() {
  const grid = qs('#terrario-grid');
  const vacio = qs('#terrario-vacio');
  const items = (await listarColeccion()).filter((item) => item.terrario_id === terrarioId);

  grid.innerHTML = '';
  vacio.hidden = items.length > 0;

  for (const item of items) {
    grid.appendChild(crearTarjetaItem(item));
  }

  await syncColeccionNavCount();
}

function wireEliminarItem() {
  qs('#terrario-grid').addEventListener('click', async (event) => {
    const btn = event.target.closest('.coleccion-eliminar-btn');
    if (!btn) return;

    event.preventDefault();

    const id = btn.dataset.id;
    if (!id || btn.disabled) return;

    btn.disabled = true;
    const result = await quitarDeColeccion(id);

    if (result.ok || result.reason === 'missing') {
      await renderItems();
      return;
    }

    btn.disabled = false;
    mostrarErrorDePagina('No pudimos eliminar el ítem de este terrario. Probá otra vez.');
  });
}

function wireEliminarTerrario() {
  qs('#btn-eliminar-terrario').addEventListener('click', async () => {
    const confirmado = window.confirm('¿Eliminar este terrario? No se puede deshacer.');
    if (!confirmado) return;

    const btn = qs('#btn-eliminar-terrario');
    btn.disabled = true;

    const result = await eliminarTerrario(terrarioId);

    if (result.ok) {
      window.location.href = 'coleccion.html';
      return;
    }

    btn.disabled = false;
    mostrarErrorDePagina('No pudimos eliminar el terrario. Probá otra vez.');
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
  qs('#catalog-sidebar-close')?.addEventListener('click', closeSidebar);

  document.body.addEventListener('click', (event) => {
    const sidebar = qs('#catalog-sidebar');
    if (sidebar && sidebar.classList.contains('is-open') && !sidebar.contains(event.target) && !toggle.contains(event.target)) {
      closeSidebar();
    }
  });
}

async function cargarTerrario() {
  const terrario = await obtenerTerrario(terrarioId);
  if (!terrario) {
    qs('#mensaje-faltante').hidden = false;
    return null;
  }

  qs('#terrario-contenido').hidden = false;
  qs('#terrario-nombre').textContent = terrario.nombre;
  qs('#terrario-tipo').textContent = TIPO_LABEL[terrario.tipo] || '';

  await renderItems();
  return terrario;
}

const authModal = wireAuthModal();
const authNav = wireAuthNav({
  onLogin: () => {
    authModal.open({
      onSuccess: async () => {
        await authNav.sync();
        qs('#mensaje-sesion').hidden = true;
        await cargarTerrario();
      },
    });
  },
});

iniciarPagina(async function init() {
  wireReloj();
  wireThemeToggle();
  wireSidebarToggle();
  await authNav.sync();

  if (!terrarioId) {
    window.location.href = 'coleccion.html';
    return;
  }

  if (!(await getSession())) {
    qs('#mensaje-sesion').hidden = false;
    return;
  }

  const terrario = await cargarTerrario();
  if (!terrario) return;

  wireEliminarItem();
  wireEliminarTerrario();
});
