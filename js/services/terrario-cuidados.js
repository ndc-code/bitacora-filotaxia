import { supabase } from '../config.js';

export async function listarCuidadosTerrario(terrarioId) {
  const { data, error } = await supabase
    .from('terrario_cuidados')
    .select('*')
    .eq('terrario_id', terrarioId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function registrarCuidadoTerrario(terrarioId, tipo, fecha, notas) {
  const { data, error } = await supabase
    .from('terrario_cuidados')
    .insert({ terrario_id: terrarioId, tipo, fecha, notas })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarCuidadoTerrario(id) {
  const { error } = await supabase.from('terrario_cuidados').delete().eq('id', id);
  if (error) throw error;
}
