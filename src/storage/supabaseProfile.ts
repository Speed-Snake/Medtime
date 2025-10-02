// src/storage/supabaseProfile.ts
import { supabase } from '../lib/supabaseClient';

export type SupabaseProfile = {
  id?: string;
  user_id: string;
  name: string;
  age: number | null;
  gender: string | null;
  avatar_url: string | null;
  created_at?: string;
  updated_at?: string;
};

// Tipo local que es igual a SupabaseProfile
export type LocalProfile = SupabaseProfile;

/**
 * Guarda o actualiza el perfil del usuario en Supabase
 */
export async function saveProfileToSupabase(profile: Omit<SupabaseProfile, 'id' | 'created_at' | 'updated_at'>): Promise<SupabaseProfile | null> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      console.error('[SupabaseProfile] No hay usuario autenticado');
      return null;
    }

    const profileData = {
      ...profile,
      user_id: user.user.id,
      updated_at: new Date().toISOString(),
    };

    // Intentar actualizar primero
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.user.id)
      .single();

    let result;
    if (existingProfile) {
      // Actualizar perfil existente
      const { data, error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('user_id', user.user.id)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      // Crear nuevo perfil
      const { data, error } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }

    console.log('[SupabaseProfile] Perfil guardado exitosamente:', result);
    return result;
  } catch (error) {
    console.error('[SupabaseProfile] Error al guardar perfil:', error);
    return null;
  }
}

/**
 * Carga el perfil del usuario desde Supabase
 */
export async function loadProfileFromSupabase(): Promise<SupabaseProfile | null> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      console.error('[SupabaseProfile] No hay usuario autenticado');
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No se encontró perfil, esto es normal para usuarios nuevos
        console.log('[SupabaseProfile] No se encontró perfil para el usuario');
        return null;
      }
      throw error;
    }

    console.log('[SupabaseProfile] Perfil cargado exitosamente:', data);
    return data;
  } catch (error) {
    console.error('[SupabaseProfile] Error al cargar perfil:', error);
    return null;
  }
}

/**
 * Sincroniza el perfil local con Supabase
 * Si no hay perfil en Supabase, crea uno con los datos de Google
 */
export async function syncProfileWithGoogle(user: any): Promise<SupabaseProfile | null> {
  try {
    // Verificar si ya existe un perfil
    const existingProfile = await loadProfileFromSupabase();
    if (existingProfile) {
      return existingProfile;
    }

    // Crear perfil con datos de Google
    const googleProfile = {
      user_id: user.id,
      name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
      age: null, // El usuario puede editarlo después
      gender: null, // El usuario puede editarlo después
      avatar_url: user.user_metadata?.avatar_url || null,
    };

    return await saveProfileToSupabase(googleProfile);
  } catch (error) {
    console.error('[SupabaseProfile] Error al sincronizar perfil con Google:', error);
    return null;
  }
}
