// src/storage/supabaseHistory.ts
import { supabase } from '../lib/supabaseClient';

export type SupabaseHistoryEntry = {
  id?: string;
  user_id: string;
  medication_id?: string; // Hacer opcional para medicamentos locales
  med_name: string;
  dose: string;
  scheduled_times: string[]; // Volver a array (PostgreSQL array)
  status: 'Tomado' | 'Cancelado';
  taken_at: string;
  created_at?: string;
};

/**
 * Guarda una entrada de historial en Supabase
 */
export async function saveHistoryEntryToSupabase(entry: Omit<SupabaseHistoryEntry, 'id' | 'user_id' | 'created_at'>): Promise<SupabaseHistoryEntry | null> {
  try {
    console.log('[SupabaseHistory] Iniciando guardado de entrada:', entry);
    
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      console.error('[SupabaseHistory] No hay usuario autenticado');
      return null;
    }

    console.log('[SupabaseHistory] Usuario autenticado:', user.user.id);

    const historyData = {
      ...entry,
      user_id: user.user.id,
    };

    console.log('[SupabaseHistory] Datos a insertar:', historyData);

    const { data, error } = await supabase
      .from('medication_history')
      .insert(historyData)
      .select()
      .single();

    if (error) {
      console.error('[SupabaseHistory] Error de Supabase:', error);
      throw error;
    }

    console.log('[SupabaseHistory] ✅ Entrada guardada exitosamente:', data);
    return data;
  } catch (error) {
    console.error('[SupabaseHistory] ❌ Error al guardar entrada:', error);
    return null;
  }
}

/**
 * Carga el historial del usuario desde Supabase
 */
export async function loadUserHistoryFromSupabase(): Promise<SupabaseHistoryEntry[]> {
  try {
    console.log('[SupabaseHistory] Cargando historial desde Supabase...');
    
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      console.error('[SupabaseHistory] No hay usuario autenticado');
      return [];
    }

    console.log('[SupabaseHistory] Usuario autenticado para carga:', user.user.id);

    const { data, error } = await supabase
      .from('medication_history')
      .select('*')
      .eq('user_id', user.user.id)
      .order('taken_at', { ascending: false });

    if (error) {
      console.error('[SupabaseHistory] Error de Supabase al cargar:', error);
      throw error;
    }

    console.log('[SupabaseHistory] ✅ Historial cargado exitosamente:', data?.length || 0, 'entradas');
    console.log('[SupabaseHistory] Datos cargados:', data);
    return data || [];
  } catch (error) {
    console.error('[SupabaseHistory] ❌ Error al cargar historial:', error);
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
 * Convierte el historial de Supabase a formato CSV con formato de tabla médica
 */
export function supabaseHistoryToCSV(entries: SupabaseHistoryEntry[], patientInfo?: { name?: string; age?: number; sex?: string }): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`; // escapar comillas
  
  // Información del paciente (opcional)
  const patientSection = patientInfo ? 
    `Nombre: ${patientInfo.name || "N/A"}, Edad: ${patientInfo.age || "N/A"}, Sexo: ${patientInfo.sex || "N/A"}\n` : "";
  
  // Cabeceras de la tabla
  const header = ["fecha", "medicamento", "dosis", "horarios", "estado"].join(",");
  
  const lines = entries.map((entry) => {
    // Formato de fecha solo: MM/DD/YYYY
    const date = new Date(entry.taken_at);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const year = date.getFullYear();
    const fecha = `${month}/${day}/${year}`;
    
    // Convertir scheduled_times a array si es string
    const timesArray = Array.isArray(entry.scheduled_times) ? entry.scheduled_times : [entry.scheduled_times];
    const horarios = timesArray
      .map((iso) => {
        const d = new Date(iso);
        const hh = d.getHours().toString().padStart(2, "0");
        const mm = d.getMinutes().toString().padStart(2, "0");
        return `${hh}:${mm}`;
      })
      .join(" · ");
    
    // Estado con formato HH:MM Tomado/Cancelado
    const statusTime = new Date(entry.taken_at);
    const statusHours = statusTime.getHours().toString().padStart(2, "0");
    const statusMinutes = statusTime.getMinutes().toString().padStart(2, "0");
    const estado = `${statusHours}:${statusMinutes} ${entry.status}`;
    
    return [fecha, entry.med_name, entry.dose, horarios, estado].map(esc).join(",");
  });
  
  return patientSection + [header, ...lines].join("\n");
}
