// src/storage/supabaseHistory.ts
import { supabase } from '../lib/supabaseClient';

export type SupabaseHistoryEntry = {
  id?: string;
  user_id: string;
  medication_id?: string;
  med_name: string;
  dose: string;
  scheduled_times: string[];
  status: 'Tomado' | 'Cancelado';
  taken_at: string;
  created_at?: string;
};

/**
 * Guarda una entrada de historial en Supabase
 */
export async function saveHistoryEntryToSupabase(entry: Omit<SupabaseHistoryEntry, 'id' | 'user_id' | 'created_at'>): Promise<SupabaseHistoryEntry | null> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      console.error('[SupabaseHistory] No hay usuario autenticado');
      return null;
    }

    const historyData = {
      ...entry,
      user_id: user.user.id,
    };

    const { data, error } = await supabase
      .from('medication_history')
      .insert(historyData)
      .select()
      .single();

    if (error) throw error;

    console.log('[SupabaseHistory] Entrada guardada exitosamente:', data);
    return data;
  } catch (error) {
    console.error('[SupabaseHistory] Error al guardar entrada:', error);
    return null;
  }
}

/**
 * Carga el historial del usuario desde Supabase
 */
export async function loadUserHistoryFromSupabase(): Promise<SupabaseHistoryEntry[]> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      console.error('[SupabaseHistory] No hay usuario autenticado');
      return [];
    }

    const { data, error } = await supabase
      .from('medication_history')
      .select('*')
      .eq('user_id', user.user.id)
      .order('taken_at', { ascending: false });

    if (error) throw error;

    console.log('[SupabaseHistory] Historial cargado exitosamente:', data?.length || 0, 'entradas');
    return data || [];
  } catch (error) {
    console.error('[SupabaseHistory] Error al cargar historial:', error);
    return [];
  }
}

/**
 * Guarda múltiples entradas de historial en lote
 */
export async function saveMultipleHistoryEntriesToSupabase(entries: Omit<SupabaseHistoryEntry, 'id' | 'user_id' | 'created_at'>[]): Promise<SupabaseHistoryEntry[]> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      console.error('[SupabaseHistory] No hay usuario autenticado');
      return [];
    }

    if (entries.length === 0) return [];

    const historyData = entries.map(entry => ({
      ...entry,
      user_id: user.user.id,
    }));

    const { data, error } = await supabase
      .from('medication_history')
      .insert(historyData)
      .select();

    if (error) throw error;

    console.log('[SupabaseHistory] Entradas guardadas exitosamente:', data?.length || 0, 'entradas');
    return data || [];
  } catch (error) {
    console.error('[SupabaseHistory] Error al guardar entradas:', error);
    return [];
  }
}

/**
 * Busca el historial por rango de fechas
 */
export async function getHistoryByDateRange(startDate: string, endDate: string): Promise<SupabaseHistoryEntry[]> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      console.error('[SupabaseHistory] No hay usuario autenticado');
      return [];
    }

    const { data, error } = await supabase
      .from('medication_history')
      .select('*')
      .eq('user_id', user.user.id)
      .gte('taken_at', startDate)
      .lte('taken_at', endDate)
      .order('taken_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('[SupabaseHistory] Error al buscar historial por fechas:', error);
    return [];
  }
}

/**
 * Elimina una entrada del historial
 */
export async function deleteHistoryEntryFromSupabase(entryId: string): Promise<boolean> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      console.error('[SupabaseHistory] No hay usuario autenticado');
      return false;
    }

    const { error } = await supabase
      .from('medication_history')
      .delete()
      .eq('id', entryId)
      .eq('user_id', user.user.id); // Asegurar que solo puede eliminar sus propias entradas

    if (error) throw error;

    console.log('[SupabaseHistory] Entrada eliminada exitosamente:', entryId);
    return true;
  } catch (error) {
    console.error('[SupabaseHistory] Error al eliminar entrada:', error);
    return false;
  }
}

/**
 * Convierte el historial de Supabase a formato CSV
 */
export function supabaseHistoryToCSV(entries: SupabaseHistoryEntry[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`; // escapar comillas
  
  const header = ["fecha", "medicamento", "dosis", "horarios", "estado"].join(",");
  
  const lines = entries.map((entry) => {
    const fecha = new Date(entry.taken_at).toLocaleString();
    const horarios = entry.scheduled_times
      .map((iso) => {
        const d = new Date(iso);
        const hh = d.getHours().toString().padStart(2, "0");
        const mm = d.getMinutes().toString().padStart(2, "0");
        return `${hh}:${mm}`;
      })
      .join(" · ");
    
    return [fecha, entry.med_name, entry.dose, horarios, entry.status].map(esc).join(",");
  });
  
  return [header, ...lines].join("\n");
}
