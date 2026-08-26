import { qs, qsa } from './dom.js';
import { wireCatalogGallery3D } from './catalog-gallery-3d.js';

const STORAGE_KEY = 'bitacora-catalog-view';

function setActiveButtons(switcher, view) {
  qsa('.catalog-view-btn', switcher).forEach((btn) => {
    const active = btn.dataset.view === view;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function applyView(page, view, gallery3d) {
  page.dataset.view = view;

  if (view === '3') {
    gallery3d.activar();
  } else {
    gallery3d.desactivar();
  }
}

/**
 * Hay dos `.catalog-view-switch` en el DOM (uno junto a "Filtros" para
 * desktop, otro junto a "Menú" para mobile — CSS muestra solo el que
 * corresponde al breakpoint), así que hay que mantenerlos sincronizados: un
 * click en cualquiera de los dos actualiza la vista y refleja el estado en
 * ambos.
 */
export function wireCatalogView({ onGallery3DSeleccion } = {}) {
  const page = qs('.catalog-page');
  const switchers = qsa('.catalog-view-switch');
  if (!page || !switchers.length) return;

  const gallery3d = wireCatalogGallery3D({ onSeleccion: onGallery3DSeleccion });

  let initial = '1';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === '1' || saved === '2' || saved === '3') initial = saved;
  } catch {
    /* ignore */
  }

  applyView(page, initial, gallery3d);
  switchers.forEach((switcher) => setActiveButtons(switcher, initial));

  function seleccionarVista(view) {
    applyView(page, view, gallery3d);
    switchers.forEach((switcher) => setActiveButtons(switcher, view));
    try {
      localStorage.setItem(STORAGE_KEY, view);
    } catch {
      /* ignore */
    }
  }

  switchers.forEach((switcher) => {
    switcher.addEventListener('click', (event) => {
      const btn = event.target.closest('.catalog-view-btn');
      if (!btn || !switcher.contains(btn)) return;
      const view = btn.dataset.view;
      if (!view) return;
      seleccionarVista(view);
    });
  });
}
