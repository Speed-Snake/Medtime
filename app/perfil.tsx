// app/perfil.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Image, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { supabase } from '../src/lib/supabaseClient';
import { loadProfileFromSupabase, saveProfileToSupabase, syncProfileWithGoogle, SupabaseProfile, LocalProfile } from '../src/storage/supabaseProfile';
import { loadAlarmSettings, saveAlarmSettings, updateAlarmSetting, AlarmSettings } from '../src/storage/alarmSettings';
import { scheduleTestAlarm } from '../src/alarms/alarmService';

type AuthInfo = {
  email?: string | null;
  name?: string | null;
  provider?: string | null;
  avatarUrl?: string | null;
  hasSession: boolean;
};

export default function Perfil() {
  const [info, setInfo] = useState<AuthInfo>({ hasSession: false });
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Estados para edición
  const [editName, setEditName] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editGender, setEditGender] = useState('No especificar');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Estados para configuración de alarmas
  const [alarmSettings, setAlarmSettings] = useState<AlarmSettings | null>(null);
  const [isEditingAlarms, setIsEditingAlarms] = useState(false);

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
        
        // Convertir a LocalProfile usando el gender de Supabase
        const localProfile: LocalProfile = {
          ...userProfile!,
          gender: userProfile!.gender || 'No especificar' // Usar el gender de Supabase o valor por defecto
        };
        
        setProfile(localProfile);
        
        if (localProfile) {
          setEditName(localProfile.name);
          setEditAge(localProfile.age?.toString() || '');
          setEditGender(localProfile.gender || 'No especificar');
        }
      }
      
      // Cargar configuración de alarmas
      const alarmConfig = await loadAlarmSettings();
      setAlarmSettings(alarmConfig);
    } catch (error) {
      console.error('[Perfil] Error al cargar:', error);
      Alert.alert('Error', 'No se pudo cargar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    
    // Validaciones
    if (!editName.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }
    
    // Validar que el nombre solo contenga letras y espacios
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
    if (!nameRegex.test(editName.trim())) {
      Alert.alert('Error', 'El nombre solo puede contener letras y espacios. No se permiten números ni símbolos.');
      return;
    }
    
    const age = parseInt(editAge);
    if (editAge && (isNaN(age) || age < 1 || age > 150)) {
      Alert.alert('Error', 'La edad debe ser un número entre 1 y 150');
      return;
    }
    
    setLoading(true);
    try {
      // Crear perfil para Supabase (incluyendo gender)
      const supabaseProfile = {
        user_id: profile.user_id,
        name: editName.trim(),
        age: editAge ? age : null,
        gender: editGender,
        avatar_url: selectedImage || profile?.avatar_url,
      };

      const result = await saveProfileToSupabase(supabaseProfile);
      
      if (result) {
        // Actualizar el perfil local manteniendo el gender
        const updatedLocalProfile: LocalProfile = {
          ...result,
          gender: editGender, // Mantener el gender localmente
        };
        setProfile(updatedLocalProfile);
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
      setEditGender(profile.gender || 'No especificar');
    }
    setIsEditing(false);
  };

  const handleImagePicker = async () => {
    try {
      // Solicitar permisos
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permisos', 'Se necesitan permisos para acceder a la galería');
        return;
      }

      // Abrir selector de imágenes
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Cuadrado para el avatar
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setSelectedImage(imageUri);
        console.log('Imagen seleccionada:', imageUri);
      }
    } catch (error) {
      console.error('Error al seleccionar imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };


  const handleToggleAlarm = async (setting: keyof AlarmSettings, value: any) => {
    if (!alarmSettings) return;
    
    try {
      const success = await updateAlarmSetting(setting, value);
      if (success) {
        const updatedSettings = { ...alarmSettings, [setting]: value };
        setAlarmSettings(updatedSettings);
        console.log(`[Perfil] Configuración de alarma actualizada: ${setting} = ${value}`);
      } else {
        Alert.alert('Error', 'No se pudo actualizar la configuración de alarma');
      }
    } catch (error) {
      console.error('[Perfil] Error al actualizar configuración de alarma:', error);
      Alert.alert('Error', 'No se pudo actualizar la configuración');
    }
  };

  const handleSaveAlarmSettings = async () => {
    if (!alarmSettings) return;
    
    try {
      const success = await saveAlarmSettings(alarmSettings);
      if (success) {
        setIsEditingAlarms(false);
        Alert.alert('Éxito', 'Configuración de alarmas guardada correctamente');
      } else {
        Alert.alert('Error', 'No se pudo guardar la configuración de alarmas');
      }
    } catch (error) {
      console.error('[Perfil] Error al guardar configuración de alarmas:', error);
      Alert.alert('Error', 'No se pudo guardar la configuración');
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
      <View style={s.header}>
        <Text style={s.title}>Perfil</Text>
      </View>

      {/* Avatar */}
      <View style={s.avatarContainer}>
        {selectedImage ? (
          <Image source={{ uri: selectedImage }} style={s.avatar} />
        ) : profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={s.avatar} />
        ) : (
          <View style={s.avatarPlaceholder}>
            <Text style={s.avatarText}>
              {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
        )}
        <TouchableOpacity style={s.changePhotoButton} onPress={handleImagePicker}>
          <Text style={s.changePhotoText}>Cambiar foto</Text>
        </TouchableOpacity>
      </View>


      {/* Información del perfil */}
      <View style={s.profileSection}>
        <View style={s.editForm}>
          <View style={s.inputGroup}>
            <Text style={s.label}>Nombre</Text>
            <TextInput
              style={s.input}
              value={editName}
              onChangeText={(text) => {
                // Filtrar solo letras, espacios y caracteres especiales del español
                const filteredText = text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
                setEditName(filteredText);
              }}
              placeholder="Ingresa tu nombre (solo letras)"
            />
          </View>
          
          <View style={s.inputGroup}>
            <Text style={s.label}>Edad</Text>
            <TextInput
              style={s.input}
              value={editAge}
              onChangeText={setEditAge}
              placeholder="Ingresa tu edad"
              keyboardType="numeric"
            />
          </View>

          <View style={s.inputGroup}>
            <Text style={s.label}>Género</Text>
            <TouchableOpacity 
              style={s.genderContainer}
              onPress={() => {
                Alert.alert(
                  'Seleccionar género',
                  'Elige una opción',
                  [
                    { text: 'Masculino', onPress: () => setEditGender('Masculino') },
                    { text: 'Femenino', onPress: () => setEditGender('Femenino') },
                    { text: 'No especificar', onPress: () => setEditGender('No especificar') },
                    { text: 'Cancelar', style: 'cancel' }
                  ]
                );
              }}
            >
              <Text style={s.genderText}>{editGender}</Text>
              <Text style={s.genderArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={s.saveButton} 
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={s.saveButtonText}>
              {loading ? 'Guardando...' : 'Guardar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>


    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8f9fa' 
  },
  centered: { 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#1f2937',
    textAlign: 'center'
  },
  
  // Avatar
  avatarContainer: { 
    alignItems: 'center', 
    marginBottom: 30,
    paddingHorizontal: 20
  },
  avatar: { 
    width: 140, 
    height: 140, 
    borderRadius: 70, 
    marginBottom: 15 
  },
  avatarPlaceholder: { 
    width: 140, 
    height: 140, 
    borderRadius: 70, 
    backgroundColor: '#e5e7eb', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 15
  },
  avatarText: { 
    fontSize: 48, 
    fontWeight: 'bold', 
    color: '#6b7280' 
  },
  changePhotoButton: {
    marginTop: 8,
  },
  changePhotoText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '500',
  },
  
  // Secciones
  section: { 
    marginBottom: 20, 
    padding: 16, 
    backgroundColor: '#f8f9fa', 
    borderRadius: 12 
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#333', 
    marginBottom: 8 
  },
  
  // Sección de perfil
  profileSection: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileInfo: {
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 20,
  },
  genderContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  genderText: {
    fontSize: 16,
    color: '#1f2937',
  },
  genderArrow: {
    fontSize: 12,
    color: '#6b7280',
  },
  
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
  buttonRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 16, 
    gap: 12 
  },
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
  cancelButtonText: { 
    color: '#666', 
    fontWeight: '600' 
  },
  saveButton: { 
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: { 
    color: '#fff', 
    fontWeight: '600',
    fontSize: 16,
  },


  // Toggles
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  toggle: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: '#007AFF',
  },
  toggleText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
  toggleTextActive: {
    color: '#fff',
  },

  // Estilos para sección de pruebas
  testSection: {
    backgroundColor: '#fff3cd',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  testSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 15,
    textAlign: 'center',
  },
  testButton: {
    backgroundColor: '#ffc107',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  testButtonText: {
    color: '#212529',
    fontWeight: 'bold',
    fontSize: 16,
  },
  testDescription: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
