import { qs, qsa } from './dom.js';

/**
 * "Terrarios" abre/cierra sus sublinks (Abiertos/Cerrados) como un acordeón.
 * Arranca abierto si la página ya está en uno de esos dos destinos, para no
 * esconder el link activo detrás de un toggle cerrado.
 */
export function wireSidebarAccordion() {
  const toggle = qs('#sidebar-terrarios-toggle');
  const group = qs('#sidebar-terrarios-group');
  if (!toggle || !group) return;

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    group.hidden = !open;
  };

  const yaEstaEnEsteDestino = qsa('.catalog-sidebar-sublink', group).some((link) => {
    const url = new URL(link.href, window.location.href);
    return url.pathname === window.location.pathname && url.search === window.location.search;
  });

  setOpen(yaEstaEnEsteDestino);

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });
}
