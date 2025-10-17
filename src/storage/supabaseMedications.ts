// src/storage/supabaseMedications.ts
import { supabase } from '../lib/supabaseClient';

export type SupabaseMedication = {
  id: string;
  name: string;
  doses: string[];
  created_at: string;
};

/**
 * Carga el catálogo de medicamentos desde Supabase
 */
export async function loadMedicationsCatalog(): Promise<SupabaseMedication[]> {
  try {
    const { data, error } = await supabase
      .from('medications_catalog')
      .select('*')
      .order('name');

    if (error) throw error;

    console.log('[SupabaseMedications] Catálogo cargado exitosamente:', data?.length || 0, 'medicamentos');
    return data || [];
  } catch (error) {
    console.error('[SupabaseMedications] Error al cargar catálogo:', error);
    return [];
  }
}

/**
 * Agrega un medicamento al catálogo (solo si no existe)
 */
export async function addMedicationToCatalog(name: string, doses: string[]): Promise<SupabaseMedication | null> {
  try {
    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('medications_catalog')
      .select('*')
      .eq('name', name)
      .single();

    if (existing) {
      console.log('[SupabaseMedications] Medicamento ya existe:', name);
      return existing;
    }

    // Crear nuevo medicamento
    const { data, error } = await supabase
      .from('medications_catalog')
      .insert({
        name,
        doses,
      })
      .select()
      .single();

    if (error) throw error;

    console.log('[SupabaseMedications] Medicamento agregado exitosamente:', data);
    return data;
  } catch (error) {
    console.error('[SupabaseMedications] Error al agregar medicamento:', error);
    return null;
  }
}

/**
 * Inicializa el catálogo con medicamentos básicos
 */
export async function initializeMedicationsCatalog(): Promise<void> {
  try {
    const basicMedications = [
      { name: 'Paracetamol', doses: ['1 g', '500 mg'] },
      { name: 'Ibuprofeno', doses: ['400 mg', '600 mg'] },
      { name: 'Aspirina', doses: ['100 mg', '500 mg'] },
      { name: 'Omeprazol', doses: ['20 mg'] },
      { name: 'Amoxicilina', doses: ['500 mg', '875 mg'] },
      { name: 'Loratadina', doses: ['10 mg'] },
      { name: 'Diclofenaco', doses: ['50 mg', '75 mg'] },
      { name: 'Metformina', doses: ['500 mg', '850 mg'] },
    ];

    console.log('[SupabaseMedications] Inicializando catálogo con medicamentos básicos...');
    
    for (const med of basicMedications) {
      await addMedicationToCatalog(med.name, med.doses);
    }

    console.log('[SupabaseMedications] Catálogo inicializado exitosamente');
  } catch (error) {
    console.error('[SupabaseMedications] Error al inicializar catálogo:', error);
  }
}

/**
 * Busca medicamentos por nombre (máximo 2 resultados con scroll)
 */
export async function searchMedications(query: string): Promise<SupabaseMedication[]> {
  try {
    if (!query || query.length < 2) return [];
    
    const queryLower = query.toLowerCase();
    
    // Si la consulta tiene 4 o más caracteres, buscar coincidencia exacta de primeras 4 letras
    if (queryLower.length >= 4) {
      const firstFourLetters = queryLower.substring(0, 4);
      
      const { data: exactMatches, error: exactError } = await supabase
        .from('medications_catalog')
        .select('*')
        .ilike('name', `${firstFourLetters}%`)
        .order('name')
        .limit(2); // Máximo 2 resultados

      if (exactError) throw exactError;
      
      // Si hay coincidencias exactas, devolverlas
      if (exactMatches && exactMatches.length > 0) {
        return exactMatches;
      }
    }
    
    // Si no hay coincidencias exactas o la consulta es muy corta, buscar coincidencias parciales
    const { data: partialMatches, error: partialError } = await supabase
      .from('medications_catalog')
      .select('*')
      .ilike('name', `%${queryLower}%`)
      .order('name')
      .limit(2); // Máximo 2 resultados

    if (partialError) throw partialError;

    return partialMatches || [];
  } catch (error) {
    console.error('[SupabaseMedications] Error al buscar medicamentos:', error);
    return [];
  }
}
