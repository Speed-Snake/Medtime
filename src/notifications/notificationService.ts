// src/notifications/notificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { MedItem } from '../storage/localMedicines';

// Configurar el comportamiento de las notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Solicita permisos para notificaciones
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    console.log('[NotificationService] Verificando permisos de notificación...');
    console.log('[NotificationService] Es dispositivo físico:', Device.isDevice);
    console.log('[NotificationService] Plataforma:', Platform.OS);
    console.log('[NotificationService] Device info:', {
      isDevice: Device.isDevice,
      platform: Platform.OS,
      deviceName: Device.deviceName,
      deviceType: Device.deviceType
    });
    
    // Forzar que funcione en dispositivos físicos y emuladores
    const isPhysicalDevice = Device.isDevice || Platform.OS === 'android' || Platform.OS === 'ios';
    console.log('[NotificationService] Dispositivo válido para notificaciones:', isPhysicalDevice);
    
    if (isPhysicalDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('[NotificationService] Estado actual de permisos:', existingStatus);
      
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        console.log('[NotificationService] Solicitando permisos...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log('[NotificationService] Nuevo estado de permisos:', status);
      }
      
      if (finalStatus !== 'granted') {
        console.log('[NotificationService] ❌ Permisos de notificación denegados');
        return false;
      }
      
      // Configurar el canal de notificación para Android
      if (Platform.OS === 'android') {
        console.log('[NotificationService] Configurando canal de notificación para Android...');
        await Notifications.setNotificationChannelAsync('medtime-reminders', {
          name: 'Recordatorios de Medicamentos',
          description: 'Notificaciones para recordar tomar medicamentos',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
          enableVibrate: true,
          enableLights: true,
          showBadge: true,
        });
        
        console.log('[NotificationService] ✅ Canal de notificación configurado para Android');
      }
      
      console.log('[NotificationService] ✅ Permisos de notificación concedidos');
      return true;
    } else {
      console.log('[NotificationService] ⚠️ Dispositivo no soportado para notificaciones');
      return false;
    }
  } catch (error) {
    console.error('[NotificationService] ❌ Error al solicitar permisos de notificación:', error);
    return false;
  }
}

/**
 * Programa una notificación para un medicamento
 */
export async function scheduleMedicationNotification(medication: MedItem, scheduledTime: string): Promise<string | null> {
  try {
    console.log(`[NotificationService] Intentando programar notificación para ${medication.name} a las ${scheduledTime}`);
    
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[NotificationService] No se pueden programar notificaciones sin permisos');
      return null;
    }

    const now = new Date();
    
    // Parsear la hora programada - puede ser HH:MM o ISO date
    let hours, minutes;
    
    if (scheduledTime.includes('T')) {
      // Es una fecha ISO, extraer la hora
      const date = new Date(scheduledTime);
      if (isNaN(date.getTime())) {
        console.error('[NotificationService] Fecha ISO inválida:', scheduledTime);
        return null;
      }
      hours = date.getHours();
      minutes = date.getMinutes();
      console.log('[NotificationService] Convertido de ISO:', scheduledTime, '→', `${hours}:${minutes}`);
    } else {
      // Es formato HH:MM
      const timeParts = scheduledTime.split(':');
      if (timeParts.length !== 2) {
        console.error('[NotificationService] Formato de hora inválido:', scheduledTime);
        return null;
      }
      hours = parseInt(timeParts[0], 10);
      minutes = parseInt(timeParts[1], 10);
    }
    
    // Validar que las horas y minutos sean válidos
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      console.error('[NotificationService] Hora inválida:', scheduledTime, '→', `${hours}:${minutes}`);
      return null;
    }
    
    // Crear fecha para hoy con la hora programada
    const today = new Date();
    today.setHours(hours, minutes, 0, 0);
    
    // Si la hora ya pasó hoy, programar para mañana
    let triggerDate = new Date(today);
    if (today.getTime() <= now.getTime()) {
      console.log('[NotificationService] La hora ya pasó hoy, programando para mañana');
      triggerDate = new Date(today.getTime() + 24 * 60 * 60 * 1000); // +1 día
    }
    
    // Asegurar que la fecha sea al menos 1 minuto en el futuro
    const minFutureTime = new Date(now.getTime() + 60 * 1000); // +1 minuto
    if (triggerDate.getTime() <= minFutureTime.getTime()) {
      console.log('[NotificationService] Ajustando fecha para que sea al menos 1 minuto en el futuro');
      triggerDate = minFutureTime;
    }
    
    // Validar que la fecha final sea válida
    if (isNaN(triggerDate.getTime())) {
      console.error('[NotificationService] Fecha inválida generada:', triggerDate);
      return null;
    }
    
    const notificationId = `${medication.id}_${scheduledTime}_${triggerDate.getTime()}`;
    
    console.log(`[NotificationService] Fecha actual: ${now.toISOString()}`);
    console.log(`[NotificationService] Fecha programada: ${triggerDate.toISOString()}`);
    console.log(`[NotificationService] Diferencia en minutos: ${(triggerDate.getTime() - now.getTime()) / (1000 * 60)}`);
    
    // Verificar que la fecha sea futura
    if (triggerDate.getTime() <= now.getTime()) {
      console.log('[NotificationService] No se puede programar notificación para tiempo pasado');
      return null;
    }

    const notificationRequest = {
      identifier: notificationId,
      content: {
        title: '💊 Hora de tomar medicamento',
        body: `Es hora de tomar ${medication.name} (${medication.dose})`,
        sound: 'default',
        data: {
          medicationId: medication.id,
          medicationName: medication.name,
          dose: medication.dose,
          scheduledTime: scheduledTime,
        },
        ...(Platform.OS === 'android' && {
          channelId: 'medtime-reminders',
        }),
      },
      trigger: {
        type: 'date' as Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    };

    console.log(`[NotificationService] Programando notificación:`, JSON.stringify(notificationRequest, null, 2));

    await Notifications.scheduleNotificationAsync(notificationRequest);

    console.log(`[NotificationService] ✅ Notificación programada exitosamente para ${medication.name} a las ${triggerDate.toLocaleTimeString()}`);
    return notificationId;
  } catch (error) {
    console.error('[NotificationService] Error al programar notificación:', error);
    return null;
  }
}

/**
 * Programa todas las notificaciones para un medicamento
 */
export async function scheduleAllMedicationNotifications(medication: MedItem): Promise<string[]> {
  const notificationIds: string[] = [];
  
  for (const scheduledTime of medication.times) {
    const id = await scheduleMedicationNotification(medication, scheduledTime);
    if (id) {
      notificationIds.push(id);
    }
  }
  
  return notificationIds;
}

/**
 * Cancela una notificación específica
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log(`Notificación cancelada: ${notificationId}`);
  } catch (error) {
    console.error('Error al cancelar notificación:', error);
  }
}

/**
 * Cancela todas las notificaciones de un medicamento
 */
export async function cancelAllMedicationNotifications(medication: MedItem): Promise<void> {
  console.log(`[NotificationService] Cancelando notificaciones para ${medication.name}...`);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const idsToCancel = scheduled
    .filter(n => n.identifier.startsWith(`${medication.id}_`))
    .map(n => n.identifier);

  console.log(`[NotificationService] Encontradas ${idsToCancel.length} notificaciones para cancelar:`, idsToCancel);

  for (const id of idsToCancel) {
    await Notifications.cancelScheduledNotificationAsync(id);
    console.log(`[NotificationService] Notificación cancelada: ${id}`);
  }
  console.log(`[NotificationService] ✅ ${idsToCancel.length} notificaciones canceladas para ${medication.name}`);
}

/**
 * Cancela todas las notificaciones programadas
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Todas las notificaciones canceladas');
  } catch (error) {
    console.error('Error al cancelar todas las notificaciones:', error);
  }
}

/**
 * Obtiene todas las notificaciones programadas
 */
export async function getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error al obtener notificaciones programadas:', error);
    return [];
  }
}

/**
 * Maneja la respuesta del usuario a una notificación
 */
export function addNotificationResponseListener(listener: (response: Notifications.NotificationResponse) => void) {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

/**
 * Maneja las notificaciones recibidas mientras la app está abierta
 */
export function addNotificationReceivedListener(listener: (notification: Notifications.Notification) => void) {
  return Notifications.addNotificationReceivedListener(listener);
}

/**
 * Diagnóstico completo del sistema de notificaciones
 */
export async function diagnoseNotificationSystem(): Promise<void> {
  try {
    console.log('🔍🔍🔍 INICIANDO DIAGNÓSTICO DE NOTIFICACIONES 🔍🔍🔍');
    console.log('================================================');
    
    // Información del dispositivo
    console.log('📱 INFORMACIÓN DEL DISPOSITIVO:');
    console.log('  - isDevice:', Device.isDevice);
    console.log('  - platform:', Platform.OS);
    console.log('  - deviceName:', Device.deviceName);
    console.log('  - deviceType:', Device.deviceType);
    console.log('================================================');
    
    // Estado de permisos
    console.log('🔐 ESTADO DE PERMISOS:');
    const { status } = await Notifications.getPermissionsAsync();
    console.log('  - Estado actual:', status);
    console.log('  - ¿Permisos concedidos?', status === 'granted' ? '✅ SÍ' : '❌ NO');
    console.log('================================================');
    
    // Canales de notificación (Android)
    if (Platform.OS === 'android') {
      console.log('📢 CANALES DE NOTIFICACIÓN (Android):');
      try {
        const channels = await Notifications.getNotificationChannelsAsync();
        console.log('  - Total de canales:', channels.length);
        if (channels.length > 0) {
          channels.forEach((channel, index) => {
            console.log(`  - ${index + 1}. Nombre: ${channel.name}`);
            console.log(`     ID: ${channel.id}`);
            console.log(`     Importancia: ${channel.importance}`);
          });
        } else {
          console.log('  - ⚠️ No se encontraron canales');
        }
      } catch (error) {
        console.log('  - ❌ Error al obtener canales:', error);
      }
    } else {
      console.log('📢 CANALES DE NOTIFICACIÓN: No aplica para iOS');
    }
    console.log('================================================');
    
    // Notificaciones programadas
    console.log('⏰ NOTIFICACIONES PROGRAMADAS:');
    const scheduled = await getAllScheduledNotifications();
    console.log('  - Total programadas:', scheduled.length);
    
    if (scheduled.length > 0) {
      console.log('  - Detalles de cada notificación:');
      scheduled.forEach((notification, index) => {
        console.log(`  - ${index + 1}. ID: ${notification.identifier}`);
        console.log(`     Título: ${notification.content.title}`);
        console.log(`     Cuerpo: ${notification.content.body}`);
        console.log(`     Trigger: ${JSON.stringify(notification.trigger)}`);
        console.log(`     Datos: ${JSON.stringify(notification.content.data)}`);
      });
    } else {
      console.log('  - ⚠️ No hay notificaciones programadas');
    }
    console.log('================================================');
    
    // Información adicional
    console.log('📊 INFORMACIÓN ADICIONAL:');
    console.log('  - Fecha actual:', new Date().toISOString());
    console.log('  - Hora local:', new Date().toLocaleString());
    console.log('  - Zona horaria:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    console.log('  - Timestamp actual:', Date.now());
    console.log('================================================');
    
    console.log('🔍🔍🔍 DIAGNÓSTICO COMPLETADO 🔍🔍🔍');
  } catch (error) {
    console.error('❌❌❌ ERROR EN DIAGNÓSTICO ❌❌❌');
    console.error('Error:', error);
    console.error('================================================');
  }
}

/**
 * Verifica el estado de las notificaciones programadas
 */
export async function checkScheduledNotifications(): Promise<void> {
  try {
    const scheduled = await getAllScheduledNotifications();
    console.log(`[NotificationService] Notificaciones programadas: ${scheduled.length}`);
    
    scheduled.forEach((notification, index) => {
      console.log(`[NotificationService] ${index + 1}. ID: ${notification.identifier}`);
      console.log(`[NotificationService]    Título: ${notification.content.title}`);
      console.log(`[NotificationService]    Trigger: ${JSON.stringify(notification.trigger)}`);
    });
  } catch (error) {
    console.error('[NotificationService] Error al verificar notificaciones:', error);
  }
}

/**
 * Envía una notificación inmediata para pruebas
 */
export async function sendImmediateTestNotification(): Promise<boolean> {
  try {
    console.log('[NotificationService] Enviando notificación inmediata de prueba...');
    
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[NotificationService] No se pueden enviar notificaciones sin permisos');
      return false;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: `immediate_test_${Date.now()}`,
      content: {
        title: '🧪 Prueba inmediata',
        body: 'Esta es una notificación de prueba inmediata',
        sound: 'default',
        data: { test: true, immediate: true },
        ...(Platform.OS === 'android' && {
          channelId: 'medtime-reminders',
        }),
      },
      trigger: null, // Inmediata
    });

    console.log('[NotificationService] ✅ Notificación inmediata enviada');
    return true;
  } catch (error) {
    console.error('[NotificationService] Error al enviar notificación inmediata:', error);
    return false;
  }
}

/**
 * Programa una notificación de prueba para verificar que funciona
 */
export async function scheduleTestNotification(): Promise<string | null> {
  try {
    console.log('[NotificationService] Programando notificación de prueba...');
    
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[NotificationService] No se pueden programar notificaciones sin permisos');
      return null;
    }

    const testId = `test_${Date.now()}`;
    const triggerDate = new Date(Date.now() + 5000); // 5 segundos desde ahora

    await Notifications.scheduleNotificationAsync({
      identifier: testId,
      content: {
        title: '🧪 Prueba de notificación',
        body: 'Si ves esto, las notificaciones funcionan correctamente',
        sound: 'default',
        data: { test: true },
        ...(Platform.OS === 'android' && {
          channelId: 'medtime-reminders',
        }),
      },
      trigger: {
        type: 'date' as Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    console.log(`[NotificationService] ✅ Notificación de prueba programada para ${triggerDate.toLocaleTimeString()}`);
    return testId;
  } catch (error) {
    console.error('[NotificationService] Error al programar notificación de prueba:', error);
    return null;
  }
}
