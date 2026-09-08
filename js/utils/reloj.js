import { qsa } from './dom.js';
import { aplicarEstacionTema } from './catalog-season-theme.js';
import { aplicarMomentoTema } from './theme.js';

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

// Hora y fecha van separadas (no en un solo formatter) para poder armar
// "19:18 AR 08 SEP 2026" a mano, sin las comas ni el "de" que mete `Intl`
// cuando le pedís todo junto. El mes se pide abreviado y se pasa a mayúscula.
const formatoHora = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ZONA,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const formatoFechaCorta = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ZONA,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function partesPor(date, formatter) {
  return Object.fromEntries(formatter.formatToParts(date).map((parte) => [parte.type, parte.value]));
}

// Estaciones meteorológicas del hemisferio sur, agrupadas por mes calendario
// (índice 0 = enero ... 11 = diciembre) en vez de por fecha exacta de
// equinoccio/solsticio — más simple y es como la gente las nombra.
const ESTACIONES = [
  'Verano', 'Verano', 'Otoño', 'Otoño', 'Otoño', 'Invierno',
  'Invierno', 'Invierno', 'Invierno', 'Primavera', 'Primavera', 'Verano',
];

/**
 * Estación de Buenos Aires para la fecha dada, por mes calendario. La usan el
 * reloj (texto "13 ago Invierno") y el tema por estación (`data-season`).
 */
export function estacionActualTema(date = new Date()) {
  const mes = Number(formatoMes.format(date));
  return ESTACIONES[mes - 1];
}

/**
 * Devuelve la fecha y estación de Buenos Aires como "13 ago Invierno".
 */
export function formatearFechaEstacion(date = new Date()) {
  return `${formatoFecha.format(date)} ${estacionActualTema(date)}`;
}

export function formatearEstacion(date = new Date()) {
  return estacionActualTema(date);
}

/**
 * Devuelve hora, huso (literal "AR") y fecha con el mes abreviado en mayúscula:
 * "19:18 AR 08 SEP 2026". El huso es literal porque la zona es fija: `Intl`
 * diría "ART"/"GMT-3" según el motor y acá siempre es Argentina.
 */
export function formatearHoraCompleta(date = new Date()) {
  const { hour, minute } = partesPor(date, formatoHora);
  const { day, month, year } = partesPor(date, formatoFechaCorta);
  // es-AR abrevia los meses a 3 letras salvo septiembre ("sept."). Sacamos
  // cualquier punto, recortamos a 3 y pasamos a mayúscula -> "SEP", "AGO".
  const mes = month.replace('.', '').slice(0, 3).toUpperCase();
  return `${hour}:${minute} AR ${day} ${mes} ${year}`;
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
 * Tick único de la página: cada minuto reescribe la hora en los
 * `[data-hora-completa]` y re-aplica el tema por estación y por momento del
 * día (que a su vez pintan los `[data-estacion-tema]` y `[data-theme-toggle]`).
 * Así, con la página abierta, todo cambia solo al cruzar un minuto, un corte
 * horario o un cambio de mes. Devuelve una función para frenarlo.
 */
export function wireReloj() {
  const horasCompletas = qsa('[data-hora-completa]');

  let timer = null;

  function pintar() {
    const ahora = new Date();
    // `datetime` legible por máquinas; el texto visible ya está en hora de
    // Buenos Aires, así que acá va el instante exacto en ISO.
    horasCompletas.forEach((el) => {
      el.textContent = formatearHoraCompleta(ahora);
      if (el.tagName === 'TIME') el.setAttribute('datetime', ahora.toISOString());
    });

    aplicarEstacionTema(ahora);
    aplicarMomentoTema(ahora);

    timer = setTimeout(pintar, msHastaProximoMinuto(ahora));
  }

  pintar();

  return () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
}
