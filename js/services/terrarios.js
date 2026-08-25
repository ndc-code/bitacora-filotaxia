import { supabase } from '../config.js';
import { getSession } from './auth.js';

export async function listarTerrarios() {
  const session = await getSession();
  if (!session?.user?.id) return [];

  const { data, error } = await supabase
    .from('terrarios')
    .select('*')
    .eq('user_id', session.user.id)
    .order('tipo', { ascending: true })
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error listando terrarios:', error);
    return [];
  }

  return data || [];
}

export async function obtenerTerrario(id) {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const { data, error } = await supabase
    .from('terrarios')
    .select('*')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error) {
    console.error('Error obteniendo terrario:', error);
    return null;
  }

  return data;
}

export async function actualizarTerrario(id, cambios) {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, reason: 'not_authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('terrarios')
      .update(cambios)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) throw error;

    return { ok: true, terrario: data };
  } catch (error) {
    console.error('Error actualizando terrario:', error);
    return { ok: false, reason: 'error' };
  }
}

export async function crearTerrario({ nombre, tipo }) {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, reason: 'not_authenticated' };
  }

  if (!nombre || !nombre.trim() || (tipo !== 'abierto' && tipo !== 'cerrado')) {
    return { ok: false, reason: 'invalid' };
  }

  try {
    const { data, error } = await supabase
      .from('terrarios')
      .insert([{ user_id: session.user.id, nombre: nombre.trim(), tipo }])
      .select()
      .single();

    if (error) throw error;

    return { ok: true, terrario: data };
  } catch (error) {
    console.error('Error creando terrario:', error);
    return { ok: false, reason: 'error' };
  }
}

export async function eliminarTerrario(id) {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, reason: 'not_authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('terrarios')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select('id');

    if (error) throw error;

    if (!data || data.length === 0) {
      return { ok: false, reason: 'missing' };
    }

    return { ok: true };
  } catch (error) {
    console.error('Error eliminando terrario:', error);
    return { ok: false, reason: 'error' };
  }
}
