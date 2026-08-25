import { qsa } from './dom.js';

/**
 * El cartel dice "Buenos Aires, ARG", así que la hora es siempre la de Buenos
 * Aires: quien entre desde otro huso ve la misma que acá, y la etiqueta nunca
 * miente. Por eso el huso es fijo y no `undefined` (hora local del dispositivo).
 */
export const ZONA = 'America/Argentina/Buenos_Aires';

const LOCALE = 'es-AR';

// Dos formatters en vez de uno: pedirle fecha y hora juntos a `Intl` devuelve
// "13 ago, 23:46", y esa coma choca con la de "Buenos Aires, ARG".
const formatoFecha = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  timeZone: ZONA,
});

const formatoMes = new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: ZONA });

// Estaciones meteorológicas del hemisferio sur, agrupadas por mes calendario
// (índice 0 = enero ... 11 = diciembre) en vez de por fecha exacta de
// equinoccio/solsticio — más simple y es como la gente las nombra.
const ESTACIONES = [
  'Verano', 'Verano', 'Otoño', 'Otoño', 'Otoño', 'Invierno',
  'Invierno', 'Invierno', 'Primavera', 'Primavera', 'Primavera', 'Verano',
];

function estacionDe(date) {
  const mes = Number(formatoMes.format(date));
  return ESTACIONES[mes - 1];
}

/**
 * Devuelve la fecha y estación de Buenos Aires como "13 ago Invierno".
 */
export function formatearFechaEstacion(date = new Date()) {
  return `${formatoFecha.format(date)} ${estacionDe(date)}`;
}

/**
 * Milisegundos que faltan para el próximo minuto redondo. Se reprograma con
 * este valor en vez de un intervalo fijo de 60s para que el reloj cambie cuando
 * cambia el minuto real, y no con el desfase que tuviera al cargar la página.
 */
export function msHastaProximoMinuto(date = new Date()) {
  return 60000 - (date.getSeconds() * 1000 + date.getMilliseconds());
}

/**
 * Mantiene en hora todos los `[data-reloj]` de la página. Devuelve una función
 * para frenarlo.
 */
export function wireReloj() {
  const elementos = qsa('[data-reloj]');
  if (elementos.length === 0) return () => {};

  let timer = null;

  function pintar() {
    const ahora = new Date();
    const texto = formatearFechaEstacion(ahora);
    elementos.forEach((el) => {
      el.textContent = texto;
      // `datetime` legible por máquinas; el texto visible ya está en hora de
      // Buenos Aires, así que acá va el instante exacto en ISO.
      if (el.tagName === 'TIME') el.setAttribute('datetime', ahora.toISOString());
    });
    timer = setTimeout(pintar, msHastaProximoMinuto(ahora));
  }

  pintar();

  return () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
}
