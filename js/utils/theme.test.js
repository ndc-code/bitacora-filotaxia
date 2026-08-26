import { test } from 'node:test';
import assert from 'node:assert/strict';
import { temaSiguiente, etiquetaParaTema, TEMA_DIA, TEMA_ATARDECER, TEMA_NOCHE } from './theme.js';

test('temaSiguiente de día es atardecer', () => {
  assert.equal(temaSiguiente(TEMA_DIA), TEMA_ATARDECER);
});

test('temaSiguiente de atardecer es noche', () => {
  assert.equal(temaSiguiente(TEMA_ATARDECER), TEMA_NOCHE);
});

test('temaSiguiente de noche vuelve a día (cierra el ciclo)', () => {
  assert.equal(temaSiguiente(TEMA_NOCHE), TEMA_DIA);
});

test('etiquetaParaTema nombra el estado actual: Día', () => {
  assert.equal(etiquetaParaTema(TEMA_DIA), 'Día');
});

test('etiquetaParaTema nombra el estado actual: Atardecer', () => {
  assert.equal(etiquetaParaTema(TEMA_ATARDECER), 'Atardecer');
});

test('etiquetaParaTema nombra el estado actual: Noche', () => {
  assert.equal(etiquetaParaTema(TEMA_NOCHE), 'Noche');
});
