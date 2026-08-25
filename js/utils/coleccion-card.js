export function riegosDePlanta(planta) {
  if (planta.riegos && typeof planta.riegos === 'object') return planta.riegos;
  const fallback = planta.riego || '';
  return {
    verano: fallback,
    invierno: fallback,
    primavera: fallback,
    otoño: fallback,
  };
}

export function idDeColeccion(planta) {
  return planta.id || '';
}
