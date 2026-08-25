import { supabase } from '../config.js';
import { getSession } from './auth.js';

export const FOTOS_LIMITE = 12;
const TAMANIO_MAXIMO = 5 * 1024 * 1024;
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function listarFotosTerrario(terrarioId) {
  const { data, error } = await supabase
    .from('terrario_fotos')
    .select('*')
    .eq('terrario_id', terrarioId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function obtenerFotoPortada(terrarioId) {
  const { data, error } = await supabase
    .from('terrario_fotos')
    .select('*')
    .eq('terrario_id', terrarioId)
    .eq('es_portada', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function establecerFotoPortada(terrarioId, fotoId) {
  const { error: unsetError } = await supabase
    .from('terrario_fotos')
    .update({ es_portada: false })
    .eq('terrario_id', terrarioId)
    .eq('es_portada', true);
  if (unsetError) throw unsetError;

  const { error: setError } = await supabase
    .from('terrario_fotos')
    .update({ es_portada: true })
    .eq('id', fotoId);
  if (setError) throw setError;
}

/**
 * Sube una foto y la deja marcada como portada del terrario, reemplazando a
 * la anterior (si había). A diferencia de `subirFotoTerrario`, esta es la
 * acción explícita de "(Agregar imagen)" / "(Cambiar imagen)".
 */
export async function subirPortadaTerrario(terrarioId, file) {
  const result = await subirFotoTerrario(terrarioId, file);
  if (!result.ok) return result;

  try {
    await establecerFotoPortada(terrarioId, result.foto.id);
  } catch (error) {
    return { ok: false, reason: 'error', error };
  }

  return result;
}

export async function subirFotoTerrario(terrarioId, file) {
  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    return { ok: false, reason: 'tipo_invalido' };
  }
  if (file.size > TAMANIO_MAXIMO) {
    return { ok: false, reason: 'muy_pesada' };
  }

  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, reason: 'not_authenticated' };
  }

  const actuales = await listarFotosTerrario(terrarioId);
  if (actuales.length >= FOTOS_LIMITE) {
    return { ok: false, reason: 'limite_alcanzado' };
  }

  const ext = file.name.split('.').pop();
  const path = `${session.user.id}/terrario/${terrarioId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from('plantas-fotos').upload(path, file);
  if (uploadError) return { ok: false, reason: 'error', error: uploadError };

  const { data, error } = await supabase
    .from('terrario_fotos')
    .insert({ terrario_id: terrarioId, storage_path: path })
    .select()
    .single();

  if (error) {
    await supabase.storage.from('plantas-fotos').remove([path]);
    return { ok: false, reason: 'error', error };
  }

  return { ok: true, foto: data };
}

export async function eliminarFotoTerrario(foto) {
  const { error: deleteRowError } = await supabase
    .from('terrario_fotos')
    .delete()
    .eq('id', foto.id);
  if (deleteRowError) return { ok: false, reason: 'error', error: deleteRowError };

  const { error: storageError } = await supabase.storage
    .from('plantas-fotos')
    .remove([foto.storage_path]);
  if (storageError) console.warn('No se pudo borrar el archivo de la foto', storageError);

  return { ok: true };
}
