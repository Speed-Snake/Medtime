// src/storage/supabaseHistory.ts
import { supabase } from '../lib/supabaseClient';

export type SupabaseHistoryEntry = {
  id?: string;
  user_id: string;
  medication_id?: string; // Hacer opcional para medicamentos locales
  med_name: string;
  dose: string;
  scheduled_times: string[]; // Volver a array (PostgreSQL array)
  selected_dates?: string[]; // Fechas seleccionadas (YYYY-MM-DD)
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
 * Convierte el historial de Supabase a formato CSV
 */
export function supabaseHistoryToCSV(entries: SupabaseHistoryEntry[], userInfo?: { name?: string; age?: number; gender?: string }): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`; // escapar comillas
  
  // Agregar mensaje formal al inicio del documento
  let csvContent = "";
  csvContent += `"HISTORIAL MEDICO - MEDTIME"\n`;
  csvContent += `"Este documento contiene el registro detallado de medicamentos y horarios de administracion"\n`;
  csvContent += `"Fecha de generacion: ${new Date().toLocaleDateString()}"\n`;
  csvContent += `"Documento confidencial - Tratar con privacidad"\n`;
  csvContent += `\n`; // Línea en blanco
  
  // Agregar información del usuario al inicio
  if (userInfo) {
    csvContent += `"INFORMACION DEL PACIENTE"\n`;
    if (userInfo.name) csvContent += `"Nombre","${userInfo.name}"\n`;
    if (userInfo.age) csvContent += `"Edad","${userInfo.age} anos"\n`;
    if (userInfo.gender) csvContent += `"Genero","${userInfo.gender}"\n`;
    csvContent += `\n`; // Línea en blanco
  }
  
  const header = ["fecha", "medicamento", "dosis", "fechas_seleccionadas", "horarios", "estado"].join(",");
  
  const lines = entries.map((entry) => {
    const fecha = new Date(entry.taken_at).toLocaleString();
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
    
    const fechasSeleccionadas = entry.selected_dates?.map(dateString => {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES');
    }).join(" · ") || "—";
    
    return [fecha, entry.med_name, entry.dose, fechasSeleccionadas, horarios, entry.status].map(esc).join(",");
  });
  
  csvContent += [header, ...lines].join("\n");
  return csvContent;
}
