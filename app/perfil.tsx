// app/perfil.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, Alert, Image, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { supabase } from '../src/lib/supabaseClient';
import { loadProfileFromSupabase, saveProfileToSupabase, syncProfileWithGoogle, SupabaseProfile } from '../src/storage/supabaseProfile';
import { scheduleTestNotification, checkScheduledNotifications, sendImmediateTestNotification, diagnoseNotificationSystem } from '../src/notifications/notificationService';

type AuthInfo = {
  email?: string | null;
  name?: string | null;
  provider?: string | null;
  avatarUrl?: string | null;
  hasSession: boolean;
};

export default function Perfil() {
  const [info, setInfo] = useState<AuthInfo>({ hasSession: false });
  const [profile, setProfile] = useState<SupabaseProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Estados para edición
  const [editName, setEditName] = useState('');
  const [editAge, setEditAge] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: s }, { data: u }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.getUser(),
      ]);

      const session = s.session ?? null;
      const user = u.user ?? null;

      const provider =
        (user?.identities && user.identities[0]?.provider) ||
        (user?.app_metadata?.provider as string | undefined) ||
        null;

      const next: AuthInfo = {
        hasSession: !!session,
        email: user?.email ?? null,
        name: (user?.user_metadata as any)?.full_name ?? null,
        avatarUrl: (user?.user_metadata as any)?.avatar_url ?? null,
        provider,
      };

      console.log('[Perfil] session?', next.hasSession, 'email:', next.email, 'provider:', next.provider);
      setInfo(next);

      // Si hay sesión, cargar o sincronizar perfil
      if (next.hasSession && user) {
        let userProfile = await loadProfileFromSupabase();
        
        // Si no hay perfil, sincronizar con Google
        if (!userProfile) {
          userProfile = await syncProfileWithGoogle(user);
        }
        
        setProfile(userProfile);
        
        if (userProfile) {
          setEditName(userProfile.name);
          setEditAge(userProfile.age?.toString() || '');
        }
      }
    } catch (error) {
      console.error('[Perfil] Error al cargar:', error);
      Alert.alert('Error', 'No se pudo cargar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    
    setLoading(true);
    try {
      const updatedProfile = {
        ...profile,
        name: editName.trim(),
        age: editAge ? parseInt(editAge) : null,
      };

      const result = await saveProfileToSupabase(updatedProfile);
      
      if (result) {
        setProfile(result);
        setIsEditing(false);
        Alert.alert('Éxito', 'Perfil actualizado correctamente');
      } else {
        Alert.alert('Error', 'No se pudo actualizar el perfil');
      }
    } catch (error) {
      console.error('[Perfil] Error al guardar:', error);
      Alert.alert('Error', 'No se pudo guardar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setEditName(profile.name);
      setEditAge(profile.age?.toString() || '');
    }
    setIsEditing(false);
  };

  const handleTestNotification = async () => {
    try {
      // Primero verificar notificaciones existentes
      await checkScheduledNotifications();
      
      const testId = await scheduleTestNotification();
      if (testId) {
        Alert.alert(
          'Prueba de notificación', 
          'Se programó una notificación de prueba que sonará en 5 segundos. Si no la ves, revisa la configuración de notificaciones.',
          [
            { text: 'OK' },
            { 
              text: 'Ver notificaciones programadas', 
              onPress: async () => {
                await checkScheduledNotifications();
                Alert.alert('Info', 'Revisa la consola para ver las notificaciones programadas');
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', 'No se pudo programar la notificación de prueba. Revisa los permisos.');
      }
    } catch (error) {
      console.error('[Perfil] Error al probar notificación:', error);
      Alert.alert('Error', 'No se pudo probar la notificación');
    }
  };

  const handleImmediateTestNotification = async () => {
    try {
      console.log('[Perfil] Probando notificación inmediata...');
      const success = await sendImmediateTestNotification();
      
      if (success) {
        Alert.alert(
          'Prueba inmediata', 
          'Se envió una notificación inmediata. Si no la ves, revisa la configuración de notificaciones.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'No se pudo enviar la notificación inmediata. Revisa los permisos.');
      }
    } catch (error) {
      console.error('[Perfil] Error al probar notificación inmediata:', error);
      Alert.alert('Error', 'No se pudo probar la notificación inmediata');
    }
  };

  const handleDiagnoseNotifications = async () => {
    try {
      await diagnoseNotificationSystem();
      Alert.alert(
        'Diagnóstico completado', 
        'Se ejecutó el diagnóstico completo. Revisa la consola para ver los detalles.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('[Perfil] Error en diagnóstico:', error);
      Alert.alert('Error', 'No se pudo ejecutar el diagnóstico');
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading && !profile) {
    return (
      <View style={[s.container, s.centered]}>
        <Text>Cargando perfil...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.container}>
      <Text style={s.title}>Mi perfil</Text>

      {/* Avatar */}
      <View style={s.avatarContainer}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={s.avatar} />
        ) : (
          <View style={s.avatarPlaceholder}>
            <Text style={s.avatarText}>
              {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
        )}
      </View>

      {/* Información de sesión */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Información de sesión</Text>
        <Text style={s.row}>Sesión: {info.hasSession ? 'Activa ✅' : 'No activa ❌'}</Text>
        <Text style={s.row}>Email: {info.email ?? '—'}</Text>
        <Text style={s.row}>Proveedor: {info.provider ?? '—'}</Text>
      </View>

      {/* Información del perfil */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Información personal</Text>
          {!isEditing && (
            <TouchableOpacity style={s.editButton} onPress={() => setIsEditing(true)}>
              <Text style={s.editButtonText}>Editar</Text>
            </TouchableOpacity>
          )}
        </View>

        {isEditing ? (
          <View style={s.editForm}>
            <Text style={s.label}>Nombre</Text>
            <TextInput
              style={s.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Ingresa tu nombre"
            />
            
            <Text style={s.label}>Edad</Text>
            <TextInput
              style={s.input}
              value={editAge}
              onChangeText={setEditAge}
              placeholder="Ingresa tu edad"
              keyboardType="numeric"
            />

            <View style={s.buttonRow}>
              <TouchableOpacity style={[s.button, s.cancelButton]} onPress={handleCancel}>
                <Text style={s.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[s.button, s.saveButton]} 
                onPress={handleSave}
                disabled={loading}
              >
                <Text style={s.saveButtonText}>
                  {loading ? 'Guardando...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
            <Text style={s.row}>Nombre: {profile?.name ?? '—'}</Text>
            <Text style={s.row}>Edad: {profile?.age ? `${profile.age} años` : '—'}</Text>
          </View>
        )}
      </View>

      {/* Sección de notificaciones */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Notificaciones</Text>
        
        <TouchableOpacity style={s.testButton} onPress={handleImmediateTestNotification}>
          <Text style={s.testButtonText}>⚡ Prueba inmediata</Text>
        </TouchableOpacity>
        <Text style={s.testDescription}>
          Envía una notificación inmediata para probar
        </Text>
        
        <TouchableOpacity style={[s.testButton, s.scheduledButton]} onPress={handleTestNotification}>
          <Text style={s.testButtonText}>⏰ Prueba programada</Text>
        </TouchableOpacity>
        <Text style={s.testDescription}>
          Programa una notificación para 5 segundos después
        </Text>
        
        <TouchableOpacity style={[s.testButton, s.diagnoseButton]} onPress={handleDiagnoseNotifications}>
          <Text style={s.testButtonText}>🔍 Diagnóstico</Text>
        </TouchableOpacity>
        <Text style={s.testDescription}>
          Ejecuta un diagnóstico completo del sistema
        </Text>
      </View>

      <View style={{ height: 20 }} />
      <Button title="Actualizar perfil" onPress={load} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 20, textAlign: 'center', color: '#333' },
  
  // Avatar
  avatarContainer: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 10 },
  avatarPlaceholder: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    backgroundColor: '#e0e0e0', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 10
  },
  avatarText: { fontSize: 36, fontWeight: 'bold', color: '#666' },
  
  // Secciones
  section: { marginBottom: 20, padding: 16, backgroundColor: '#f8f9fa', borderRadius: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 8 },
  
  // Información
  row: { fontSize: 16, marginTop: 6, color: '#555' },
  
  // Botón de editar
  editButton: { 
    backgroundColor: '#007AFF', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 6 
  },
  editButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  
  // Formulario de edición
  editForm: { marginTop: 12 },
  label: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  
  // Botones
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 12 },
  button: { 
    flex: 1, 
    paddingVertical: 12, 
    borderRadius: 8, 
    alignItems: 'center' 
  },
  cancelButton: { 
    backgroundColor: '#f0f0f0', 
    borderWidth: 1, 
    borderColor: '#ddd' 
  },
  cancelButtonText: { color: '#666', fontWeight: '600' },
  saveButton: { backgroundColor: '#007AFF' },
  saveButtonText: { color: '#fff', fontWeight: '600' },

  // Botón de prueba
  testButton: {
    backgroundColor: '#34D399',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  scheduledButton: {
    backgroundColor: '#3B82F6',
    marginTop: 12,
  },
  diagnoseButton: {
    backgroundColor: '#F59E0B',
    marginTop: 12,
  },
  testButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  testDescription: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
