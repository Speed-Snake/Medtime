// src/storage/alarmSettings.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AlarmSettings {
  enabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  reminderInterval: number; // en minutos
  lastUpdated: string;
}

const ALARM_SETTINGS_KEY = 'medtime_alarm_settings';

const DEFAULT_SETTINGS: AlarmSettings = {
  enabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  reminderInterval: 5, // 5 minutos de intervalo
  lastUpdated: new Date().toISOString(),
};

/**
 * Carga la configuración de alarmas desde AsyncStorage
 */
export async function loadAlarmSettings(): Promise<AlarmSettings> {
  try {
    const stored = await AsyncStorage.getItem(ALARM_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        lastUpdated: new Date().toISOString(),
      };
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('[AlarmSettings] Error al cargar configuración:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Guarda la configuración de alarmas en AsyncStorage
 */
export async function saveAlarmSettings(settings: AlarmSettings): Promise<boolean> {
  try {
    const settingsToSave = {
      ...settings,
      lastUpdated: new Date().toISOString(),
    };
    await AsyncStorage.setItem(ALARM_SETTINGS_KEY, JSON.stringify(settingsToSave));
    console.log('[AlarmSettings] Configuración guardada:', settingsToSave);
    return true;
  } catch (error) {
    console.error('[AlarmSettings] Error al guardar configuración:', error);
    return false;
  }
}

/**
 * Actualiza una configuración específica
 */
export async function updateAlarmSetting<K extends keyof AlarmSettings>(
  key: K,
  value: AlarmSettings[K]
): Promise<boolean> {
  try {
    const currentSettings = await loadAlarmSettings();
    const updatedSettings = {
      ...currentSettings,
      [key]: value,
    };
    return await saveAlarmSettings(updatedSettings);
  } catch (error) {
    console.error('[AlarmSettings] Error al actualizar configuración:', error);
    return false;
  }
}

/**
 * Resetea la configuración a los valores por defecto
 */
export async function resetAlarmSettings(): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(ALARM_SETTINGS_KEY);
    console.log('[AlarmSettings] Configuración reseteada a valores por defecto');
    return true;
  } catch (error) {
    console.error('[AlarmSettings] Error al resetear configuración:', error);
    return false;
  }
}
