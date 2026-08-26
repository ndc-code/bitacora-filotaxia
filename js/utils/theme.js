import { qsa } from './dom.js';

const CLAVE_STORAGE = 'tema';
export const TEMA_DIA = 'light';
export const TEMA_ATARDECER = 'dusk';
export const TEMA_NOCHE = 'dark';

const ORDEN = [TEMA_DIA, TEMA_ATARDECER, TEMA_NOCHE];

export function temaSiguiente(tema) {
  const i = ORDEN.indexOf(tema);
  return ORDEN[(i + 1) % ORDEN.length] ?? TEMA_DIA;
}

// El botón nombra el estado actual, no la acción.
export function etiquetaParaTema(tema) {
  if (tema === TEMA_NOCHE) return 'Noche';
  if (tema === TEMA_ATARDECER) return 'Atardecer';
  return 'Día';
}

function guardarTema(tema) {
  try {
    localStorage.setItem(CLAVE_STORAGE, tema);
  } catch {
    // Navegación privada o storage lleno: el toggle sigue funcionando en la
    // sesión actual, solo no persiste entre recargas.
  }
}

function pintarBotones(botones, tema) {
  botones.forEach((boton) => {
    boton.textContent = etiquetaParaTema(tema);
    boton.setAttribute('aria-pressed', String(tema !== TEMA_DIA));
  });
}

/**
 * Sincroniza los botones `[data-theme-toggle]` de la página con el
 * `data-theme` ya aplicado en `<html>` (lo pone el script inline anti-flash
 * del `<head>`) y los conecta para ciclarlo Día -> Atardecer -> Noche -> ...
 * Devuelve una función para desconectarlos.
 */
export function wireThemeToggle() {
  const botones = qsa('[data-theme-toggle]');
  if (botones.length === 0) return () => {};

  const raiz = document.documentElement;

  function temaActual() {
    const valor = raiz.getAttribute('data-theme');
    return ORDEN.includes(valor) ? valor : TEMA_DIA;
  }

  pintarBotones(botones, temaActual());

  function onClick() {
    const siguiente = temaSiguiente(temaActual());
    if (siguiente === TEMA_DIA) {
      raiz.removeAttribute('data-theme');
    } else {
      raiz.setAttribute('data-theme', siguiente);
    }
    guardarTema(siguiente);
    pintarBotones(botones, siguiente);
  }

  botones.forEach((boton) => boton.addEventListener('click', onClick));

  return () => {
    botones.forEach((boton) => boton.removeEventListener('click', onClick));
  };
}
