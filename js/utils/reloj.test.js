import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatearFechaEstacion, msHastaProximoMinuto } from './reloj.js';

test('formatearFechaEstacion arma "13 ago Invierno" sin la coma que mete Intl', () => {
  const d = new Date('2026-08-14T02:46:00.000Z'); // 23:46 del 13 en Buenos Aires
  assert.equal(formatearFechaEstacion(d), '13 ago Invierno');
});

test('formatearFechaEstacion usa el huso de Buenos Aires, no el del sistema', () => {
  // 01:30 UTC del 14 todavía es el 13 a las 22:30 en Buenos Aires (UTC-3).
  const d = new Date('2026-08-14T01:30:00.000Z');
  assert.equal(formatearFechaEstacion(d), '13 ago Invierno');
});

test('formatearFechaEstacion usa las estaciones del hemisferio sur', () => {
  assert.equal(formatearFechaEstacion(new Date('2026-01-13T15:00:00.000Z')), '13 ene Verano');
  assert.equal(formatearFechaEstacion(new Date('2026-04-13T15:00:00.000Z')), '13 abr Otoño');
  assert.equal(formatearFechaEstacion(new Date('2026-07-13T15:00:00.000Z')), '13 jul Invierno');
  assert.equal(formatearFechaEstacion(new Date('2026-10-13T15:00:00.000Z')), '13 oct Primavera');
  assert.equal(formatearFechaEstacion(new Date('2026-12-13T15:00:00.000Z')), '13 dic Verano');
});

test('msHastaProximoMinuto descuenta segundos y milisegundos', () => {
  const d = new Date('2026-08-13T15:30:20.250Z');
  assert.equal(msHastaProximoMinuto(d), 39750);
});

test('msHastaProximoMinuto devuelve un minuto entero justo en el minuto redondo', () => {
  const d = new Date('2026-08-13T15:30:00.000Z');
  assert.equal(msHastaProximoMinuto(d), 60000);
});
