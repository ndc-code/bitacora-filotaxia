import { qs } from '../utils/dom.js';
import { agregarAColeccion, idDesdePlanta } from '../services/coleccion.js';
import { getSession } from '../services/auth.js';
import { mostrarErrorDePagina } from '../utils/guard.js';
import { esDesktopConHover, wireCatalogAccordion } from '../utils/catalog-accordion.js';
import { wireCatalogFilters, wireFiltersToggle } from '../utils/catalog-filters.js';
import { wireCatalogView } from '../utils/catalog-view.js';
import { syncColeccionNavCount } from '../utils/coleccion-nav.js';
import { wireRiegoEstacion } from '../utils/catalog-riego-estacion.js';
import { refreshCatalogFilters } from '../utils/catalog-filters.js';
import { wireAuthModal } from '../utils/auth-modal.js';
import { wireReloj } from '../utils/reloj.js';
import { wireThemeToggle } from '../utils/theme.js';
import { wireSeasonTheme } from '../utils/catalog-season-theme.js';
import { wireTerrarioModal } from '../utils/terrario-modal.js';
import { wireSidebarAccordion } from '../utils/catalog-sidebar-accordion.js';

function parseGaleria(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseRiegos(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function plantaDesdeBoton(btn) {
  const galeria = parseGaleria(btn.dataset.galeria);
  const riegos = parseRiegos(btn.dataset.riegos);
  return {
    id: btn.dataset.id,
    nombre: btn.dataset.nombre,
    especie: btn.dataset.especie,
    riego: btn.dataset.riego,
    riegos,
    luz: btn.dataset.luz,
    ubicacion: btn.dataset.ubicacion,
    suelo: btn.dataset.suelo,
    cuidado: btn.dataset.cuidado,
    estado: btn.dataset.estado || 'Sin registrar',
    ultimoRiego: btn.dataset.ultimoRiego,
    imagen: btn.dataset.imagen || galeria[0] || null,
    galeria,
  };
}

async function agregarDesdeBoton(btn, terrarioModal) {
  const planta = plantaDesdeBoton(btn);
  if (!planta.id) {
    planta.id = idDesdePlanta(planta);
  }

  terrarioModal.open({
    modo: 'elegir',
    onDone: async (terrarioId) => {
      const result = await agregarAColeccion(planta, terrarioId);
      if (!result.ok) {
        mostrarErrorDePagina('No pudimos agregar el ítem al terrario. Probá otra vez.');
        return;
      }
      await syncColeccionNavCount();
    },
  });
}

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

/**
 * En desktop el click en el item ya no abre nada (el hover se encarga), así
 * que queda libre para agregar/quitar de la colección. En mobile el click
 * sigue siendo el que abre el panel de detalle, así que ahí no se toca.
 */
function wireEntryClickToAdd(root, authModal, terrarioModal) {
  if (!root) return;

  root.addEventListener('click', (event) => {
    if (event.target.closest('.catalog-add')) return; // ya lo maneja wireAdd
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

/**
 * Links como "Colección" o "Riegos" llevan a páginas que requieren sesión:
 * antes de navegar, chequea si hay una activa y si no, abre el modal de login
 * en vez de dejar que la persona llegue a la página y se encuentre con el
 * mensaje de "iniciá sesión" ahí.
 */
function wireGatedNavLink(selector, authModal, { closeSidebarFirst = false } = {}) {
  const link = qs(selector);
  if (!link) return;

  link.addEventListener('click', (event) => {
    event.preventDefault();
    if (closeSidebarFirst) closeSidebar();
    getSession().then((session) => {
      if (session) {
        window.location.href = link.href;
        return;
      }
      authModal.open({ onSuccess: () => window.location.href = link.href });
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

const root = qs('#catalog-rows');
const catalogList = qs('.catalog-list');
const authModal = wireAuthModal();
const terrarioModal = wireTerrarioModal();
wireReloj();
wireThemeToggle();
wireSeasonTheme();
wireCatalogAccordion(root);
wireAdd(catalogList, authModal, terrarioModal);
wireEntryClickToAdd(catalogList, authModal, terrarioModal);
wireGatedNavLink('#nav-abiertos', authModal);
wireGatedNavLink('#nav-cerrados', authModal);
wireGatedNavLink('#sidebar-nav-abiertos', authModal, { closeSidebarFirst: true });
wireGatedNavLink('#sidebar-nav-cerrados', authModal, { closeSidebarFirst: true });
wireGatedNavLink('#nav-riegos', authModal);
wireGatedNavLink('#sidebar-nav-riegos', authModal, { closeSidebarFirst: true });
wireCatalogFilters(root);
wireFiltersToggle();
wireSidebarToggle();
wireSidebarAccordion();
wireCatalogView({});
wireRiegoEstacion(root, {
  onChange: () => refreshCatalogFilters(root),
});
syncColeccionNavCount().catch(console.error);
