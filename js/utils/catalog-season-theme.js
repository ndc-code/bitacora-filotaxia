import { qsa } from './dom.js';

const CLAVE_STORAGE = 'estacion-tema';
const RESET = 'Reset';
const ORDEN = ['Invierno', 'Primavera', 'Verano', 'Otoño', RESET];

function sinAcentos(str) {
  return str.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function siguienteEstacion(actual) {
  const i = ORDEN.indexOf(actual);
  return ORDEN[(i + 1) % ORDEN.length] ?? ORDEN[0];
}

function guardar(estacion) {
  try {
    localStorage.setItem(CLAVE_STORAGE, estacion);
  } catch {
    /* Navegación privada o storage lleno: el ciclo sigue andando en esta
       sesión, solo no persiste entre recargas. */
  }
}

/**
 * La estación (o "Reset") manualmente elegida, si el usuario ya tocó el
 * botón alguna vez — para que tanto el reloj (que la escribe cada minuto)
 * como el tema por estación usen la misma fuente de verdad. `null` significa
 * que nunca la tocó, así que el reloj sigue mostrando la estación real.
 */
export function estacionElegida() {
  try {
    const guardada = localStorage.getItem(CLAVE_STORAGE);
    return ORDEN.includes(guardada) ? guardada : null;
  } catch {
    return null;
  }
}

function aplicarTema(estacion) {
  const raiz = document.documentElement;
  if (estacion && estacion !== RESET) {
    raiz.setAttribute('data-season', sinAcentos(estacion));
  } else {
    raiz.removeAttribute('data-season');
  }
}

/**
 * Conecta los botones `[data-estacion-tema]`: por defecto el sitio queda en
 * blanco/negro de siempre. Tocar la estación la cicla (Invierno -> Primavera
 * -> Verano -> Otoño -> Reset -> ...); "Reset" vuelve al blanco/negro de
 * siempre y de ahí el ciclo arranca de nuevo en Invierno.
 */
export function wireSeasonTheme() {
  const botones = qsa('[data-estacion-tema]');
  if (!botones.length) return;

  const guardada = estacionElegida();
  if (guardada) aplicarTema(guardada);

  botones.forEach((boton) => {
    boton.addEventListener('click', () => {
      const siguiente = siguienteEstacion(boton.textContent.trim());
      guardar(siguiente);
      aplicarTema(siguiente);
      botones.forEach((b) => {
        b.textContent = siguiente;
      });
    });
  });
}
