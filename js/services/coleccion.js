import { supabase } from '../config.js';
import { getSession } from './auth.js';

const STORAGE_KEY = 'bitacora-coleccion';

// Cache local para optimización
let coleccionCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Listeners para cambios en tiempo real
let realtimeSubscription = null;
let onChangeCallbacks = [];

function leerDelCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function guardarEnCache(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function cacheValido() {
  return coleccionCache && Date.now() - cacheTimestamp < CACHE_DURATION;
}

/**
 * Borra el respaldo local. El cache no está scopeado por usuario, así que al
 * cerrar sesión hay que vaciarlo: si no, la rama de error de `leerDeSupabase`
 * podría devolverle a la próxima persona la colección de la anterior.
 */
export function limpiarCacheColeccion() {
  coleccionCache = null;
  cacheTimestamp = 0;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage puede fallar (modo privado, cuota). No hay nada que hacer.
  }
}

async function leerDeSupabase() {
  const session = await getSession();
  if (!session?.user?.id) {
    // Sin sesión no hay colección que mostrar. El cache de localStorage es del
    // último usuario logueado: devolverlo acá dejaría su colección a la vista
    // después de cerrar sesión. Lo vaciamos acá además de en el logout, para
    // cubrir también las sesiones que vencen solas.
    limpiarCacheColeccion();
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('user_collection')
      .select('*')
      .eq('user_id', session.user.id)
      .order('nombre', { ascending: true });

    if (error) throw error;

    // Guardar en cache local como backup
    guardarEnCache(data || []);
    coleccionCache = data || [];
    cacheTimestamp = Date.now();

    return data || [];
  } catch (error) {
    console.error('Error leyendo colección de Supabase:', error);
    return leerDelCache();
  }
}

async function leer() {
  if (cacheValido()) {
    return coleccionCache;
  }
  return await leerDeSupabase();
}

export async function listarColeccion() {
  const items = await leer();
  return items.sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
  );
}

export async function contarColeccion() {
  const items = await leer();
  return items.length;
}

export async function agregarAColeccion(planta, terrarioId) {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, reason: 'not_authenticated' };
  }

  if (!terrarioId) {
    return { ok: false, reason: 'invalid' };
  }

  const riegos =
    planta.riegos && typeof planta.riegos === 'object'
      ? planta.riegos
      : {
          verano: planta.riego,
          invierno: planta.riego,
          primavera: planta.riego,
          otoño: planta.riego,
        };

  const nuevoItem = {
    user_id: session.user.id,
    terrario_id: terrarioId,
    planta_id: planta.id,
    nombre: planta.nombre,
    especie: planta.especie,
    riego: planta.riego,
    riegos,
    luz: planta.luz,
    ubicacion: planta.ubicacion,
    suelo: planta.suelo,
    cuidado: planta.cuidado,
    estado: planta.estado || 'Sin registrar',
    ultimoriego: planta.ultimoRiego,
    imagen: planta.imagen || null,
    galeria: Array.isArray(planta.galeria) ? planta.galeria : [],
  };

  try {
    const { error } = await supabase
      .from('user_collection')
      .insert([nuevoItem]);

    if (error) throw error;

    coleccionCache = null;

    return { ok: true };
  } catch (error) {
    console.error('Error agregando a colección:', error);
    return { ok: false, reason: 'error' };
  }
}

export async function quitarDeColeccion(id) {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, reason: 'not_authenticated' };
  }

  try {
    const { data: borradas, error } = await supabase
      .from('user_collection')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select('id');

    if (error) throw error;

    if (!borradas || borradas.length === 0) {
      return { ok: false, reason: 'missing' };
    }

    coleccionCache = null;

    return { ok: true };
  } catch (error) {
    console.error('Error quitando de colección:', error);
    return { ok: false, reason: 'error' };
  }
}

export async function obtenerItemColeccion(id) {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const { data, error } = await supabase
    .from('user_collection')
    .select('*')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function idDesdePlanta({ nombre, especie, ubicacion }) {
  return [nombre, especie, ubicacion].join('::').toLowerCase();
}

// Sincronización en tiempo real con Supabase
async function setupRealtimeSync() {
  const session = await getSession();
  if (!session?.user?.id) return;

  // Cancelar suscripción anterior si existe
  if (realtimeSubscription) {
    supabase.removeChannel(realtimeSubscription);
  }

  // Suscribirse a cambios en tiempo real
  realtimeSubscription = supabase
    .channel(`user_collection:${session.user.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_collection',
        filter: `user_id=eq.${session.user.id}`,
      },
      () => {
        // Invalidar cache cuando hay cambios
        coleccionCache = null;
        // Notificar a listeners
        onChangeCallbacks.forEach(cb => cb?.());
      }
    )
    .subscribe();
}

export function onColeccionChange(callback) {
  onChangeCallbacks.push(callback);
  setupRealtimeSync().catch(console.error);

  // Retornar función para desuscribirse
  return () => {
    onChangeCallbacks = onChangeCallbacks.filter(cb => cb !== callback);
  };
}
