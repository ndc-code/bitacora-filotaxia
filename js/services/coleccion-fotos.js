import { supabase } from '../config.js';

export async function obtenerUrlFoto(storagePath) {
  const { data, error } = await supabase.storage
    .from('plantas-fotos')
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}
