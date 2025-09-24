// src/notifications/notificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, AppState } from 'react-native';
import { MedItem } from '../storage/localMedicines';
import { loadAlarmSettings, AlarmSettings } from '../storage/alarmSettings';

// Variable global para el modal de alarma
let showAlarmModal: ((medication: any) => void) | null = null;

// Configurar el comportamiento de las notificaciones
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Si es una notificación de medicamento, mostrar notificación del sistema
    // para que funcione cuando la app está en segundo plano
    if (notification.request.content.data?.showModal) {
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    }
    
    // Para otras notificaciones, mostrar normalmente
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

// Configurar categorías de notificación con botones de acción
export async function setupNotificationCategories(): Promise<void> {
  try {
    console.log('[NotificationService] Configurando categorías de notificación...');
    
    // Categoría para alarmas de medicamentos
    await Notifications.setNotificationCategoryAsync('MEDICATION_ALARM', [
      {
        identifier: 'TAKE_MEDICATION',
        buttonTitle: '✅ Tomar',
        options: {
          isDestructive: false,
          isAuthenticationRequired: false,
        },
      },
      {
        identifier: 'SNOOZE_MEDICATION',
        buttonTitle: '⏰ Aplazar 10min',
        options: {
          isDestructive: false,
          isAuthenticationRequired: false,
        },
      },
      {
        identifier: 'CANCEL_MEDICATION',
        buttonTitle: '❌ Cancelar',
        options: {
          isDestructive: true,
          isAuthenticationRequired: false,
        },
      },
    ]);

    // Categoría para recordatorios
    await Notifications.setNotificationCategoryAsync('MEDICATION_REMINDER', [
      {
        identifier: 'TAKE_MEDICATION',
        buttonTitle: '✅ Tomar',
        options: {
          isDestructive: false,
          isAuthenticationRequired: false,
        },
      },
      {
        identifier: 'SNOOZE_MEDICATION',
        buttonTitle: '⏰ Aplazar 10min',
        options: {
          isDestructive: false,
          isAuthenticationRequired: false,
        },
      },
      {
        identifier: 'CANCEL_MEDICATION',
        buttonTitle: '❌ Cancelar',
        options: {
          isDestructive: true,
          isAuthenticationRequired: false,
        },
      },
    ]);

    console.log('[NotificationService] ✅ Categorías de notificación configuradas');
  } catch (error) {
    console.error('[NotificationService] Error al configurar categorías:', error);
  }
}

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
          vibrationPattern: [0, 1000, 500, 1000, 500, 1000], // Patrón más agresivo
          lightColor: '#FF231F7C',
          sound: 'default',
          enableVibrate: true,
          enableLights: true,
          showBadge: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true, // Pasar el modo "No molestar"
        });
        
        console.log('[NotificationService] ✅ Canal de notificación configurado para Android');
      }
      
      console.log('[NotificationService] ✅ Permisos de notificación concedidos');
      
      // Configurar categorías de notificación
      await setupNotificationCategories();
      
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
 * Programa una notificación precisa para un medicamento
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
    
    // Asegurar que la fecha sea al menos 1 segundo en el futuro (máxima precisión)
    const minFutureTime = new Date(now.getTime() + 1000); // +1 segundo
    if (triggerDate.getTime() <= minFutureTime.getTime()) {
      console.log('[NotificationService] Ajustando fecha para que sea al menos 1 segundo en el futuro');
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
        title: '🚨 ¡HORA DE MEDICAMENTO!',
        body: `Es hora de tomar ${medication.name} (${medication.dose})`,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: {
          medicationId: medication.id,
          medicationName: medication.name,
          dose: medication.dose,
          scheduledTime: scheduledTime,
        },
        ...(Platform.OS === 'android' && {
          channelId: 'medtime-reminders',
          vibrate: [0, 1000, 500, 1000, 500, 1000],
          lights: true,
          lightColor: '#FF231F7C',
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
 * Envía una notificación inmediata con botones de acción para pruebas
 */
export async function sendImmediateTestNotificationWithButtons(): Promise<boolean> {
  try {
    console.log('[NotificationService] Enviando notificación inmediata con botones...');
    
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[NotificationService] No se pueden enviar notificaciones sin permisos');
      return false;
    }

    // Asegurar que las categorías estén configuradas
    await setupNotificationCategories();

    await Notifications.scheduleNotificationAsync({
      identifier: `immediate_test_buttons_${Date.now()}`,
      content: {
        title: '🧪 Prueba con botones',
        body: 'Esta notificación debería tener botones de acción',
        sound: 'default',
        data: { 
          test: true, 
          immediate: true,
          medicationId: 'test_medication',
          medicationName: 'Medicamento de Prueba',
          dose: '1 pastilla'
        },
        categoryIdentifier: 'MEDICATION_ALARM',
        ...(Platform.OS === 'android' && {
          channelId: 'medtime-reminders',
        }),
      },
      trigger: null, // Inmediata
    });

    console.log('[NotificationService] ✅ Notificación inmediata con botones enviada');
    return true;
  } catch (error) {
    console.error('[NotificationService] Error al enviar notificación inmediata con botones:', error);
    return false;
  }
}

/**
 * Programa una notificación de prueba que simula un medicamento real
 */
export async function scheduleRealMedicationTest(): Promise<string | null> {
  try {
    console.log('[NotificationService] Programando notificación de medicamento real...');
    
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[NotificationService] No se pueden programar notificaciones sin permisos');
      return null;
    }

    // Asegurar que las categorías estén configuradas
    await setupNotificationCategories();

    // Programar para 5 segundos desde ahora
    const triggerDate = new Date(Date.now() + 5000);

    const testId = `real_medication_test_${Date.now()}`;

    await Notifications.scheduleNotificationAsync({
      identifier: testId,
      content: {
        title: '🔔 ¡Hora de medicamento!',
        body: 'Es hora de tomar Metformina (500 mg)',
        sound: 'default',
        data: {
          medicationId: 'metformina_test',
          medicationName: 'Metformina',
          dose: '500 mg',
          scheduledTime: '14:35',
          isAlarm: true,
        },
        categoryIdentifier: 'MEDICATION_ALARM',
        ...(Platform.OS === 'android' && {
          channelId: 'medtime-reminders',
        }),
      },
      trigger: {
        type: 'date' as Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    console.log(`[NotificationService] ✅ Notificación de medicamento real programada para ${triggerDate.toLocaleTimeString()}`);
    return testId;
  } catch (error) {
    console.error('[NotificationService] Error al programar notificación de medicamento real:', error);
    return null;
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

/**
 * Programa una notificación con configuración de alarma
 */
export async function scheduleMedicationNotificationWithAlarm(medication: MedItem, scheduledTime: string): Promise<string | null> {
  try {
    console.log(`[NotificationService] Programando notificación con alarma para ${medication.name} a las ${scheduledTime}`);
    
    const alarmSettings = await loadAlarmSettings();
    
    // Si las alarmas están deshabilitadas, no programar
    if (!alarmSettings.enabled) {
      console.log('[NotificationService] Alarmas deshabilitadas, no se programará notificación');
      return null;
    }
    
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[NotificationService] No se pueden programar notificaciones sin permisos');
      return null;
    }

    const now = new Date();
    
    // Validar que scheduledTime existe
    if (!scheduledTime) {
      console.error('[NotificationService] scheduledTime es undefined');
      return null;
    }
    
    // Parsear la hora programada
    let hours, minutes;
    
    if (scheduledTime.includes('T')) {
      const date = new Date(scheduledTime);
      if (isNaN(date.getTime())) {
        console.error('[NotificationService] Fecha ISO inválida:', scheduledTime);
        return null;
      }
      hours = date.getHours();
      minutes = date.getMinutes();
    } else {
      const timeParts = scheduledTime.split(':');
      if (timeParts.length !== 2) {
        console.error('[NotificationService] Formato de hora inválido:', scheduledTime);
        return null;
      }
      hours = parseInt(timeParts[0], 10);
      minutes = parseInt(timeParts[1], 10);
    }
    
    // Validar hora
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      console.error('[NotificationService] Hora inválida:', scheduledTime);
      return null;
    }
    
    // Crear fecha para hoy con la hora programada
    const today = new Date();
    today.setHours(hours, minutes, 0, 0);
    
    // Si la hora ya pasó hoy, programar para mañana
    let triggerDate = new Date(today);
    if (today.getTime() <= now.getTime()) {
      console.log('[NotificationService] La hora ya pasó hoy, programando para mañana');
      triggerDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    }
    
    // Para pruebas: si es muy cercano (menos de 5 minutos), programar para 10 segundos después
    const timeDiff = triggerDate.getTime() - now.getTime();
    if (timeDiff < 5 * 60 * 1000 && timeDiff > 0) {
      console.log('[NotificationService] Hora muy cercana, programando para 10 segundos después');
      triggerDate = new Date(now.getTime() + 10 * 1000);
    }
    
    // Asegurar que la fecha sea al menos 1 segundo en el futuro (máxima precisión)
    const minFutureTime = new Date(now.getTime() + 1000);
    if (triggerDate.getTime() <= minFutureTime.getTime()) {
      triggerDate = minFutureTime;
    }
    
    if (isNaN(triggerDate.getTime())) {
      console.error('[NotificationService] Fecha inválida generada:', triggerDate);
      return null;
    }
    
    const notificationId = `${medication.id}_alarm_${scheduledTime}_${triggerDate.getTime()}`;
    
    console.log(`[NotificationService] Fecha programada: ${triggerDate.toISOString()}`);
    console.log(`[NotificationService] Diferencia en segundos: ${(triggerDate.getTime() - now.getTime()) / 1000}`);
    
    // Configurar notificación que activa el modal con máxima intensidad
    const notificationRequest = {
      identifier: notificationId,
      content: {
        title: '🚨 ¡HORA DE MEDICAMENTO!',
        body: `Es hora de tomar ${medication.name} (${medication.dose})`,
        sound: 'default', // Sonido del sistema para mayor intensidad
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: {
          medicationId: medication.id,
          medicationName: medication.name,
          dose: medication.dose,
          scheduledTime: scheduledTime,
          isAlarm: true,
          showModal: true, // Indicar que debe mostrar modal
        },
        categoryIdentifier: 'MEDICATION_ALARM',
        ...(Platform.OS === 'android' && {
          channelId: 'medtime-reminders',
          vibrate: [0, 1000, 500, 1000, 500, 1000],
          lights: true,
          lightColor: '#FF231F7C',
        }),
      },
      trigger: {
        type: 'date' as Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    };

    await Notifications.scheduleNotificationAsync(notificationRequest);

    console.log(`[NotificationService] ✅ Notificación con alarma programada para ${medication.name} a las ${triggerDate.toLocaleTimeString()}`);
    return notificationId;
  } catch (error) {
    console.error('[NotificationService] Error al programar notificación con alarma:', error);
    return null;
  }
}

/**
 * Programa notificaciones de recordatorio basadas en la configuración
 */
export async function scheduleReminderNotifications(medication: MedItem, scheduledTime: string): Promise<string[]> {
  try {
    const alarmSettings = await loadAlarmSettings();
    const notificationIds: string[] = [];
    
    if (!alarmSettings.enabled) {
      console.log('[NotificationService] Alarmas deshabilitadas, no se programarán recordatorios');
      return [];
    }
    
    // Programar notificación principal
    const mainId = await scheduleMedicationNotificationWithAlarm(medication, scheduledTime);
    if (mainId) {
      notificationIds.push(mainId);
    }
    
    // Programar recordatorios adicionales si está configurado
    if (alarmSettings.reminderInterval > 0) {
      const now = new Date();
      let hours, minutes;
      
      if (scheduledTime.includes('T')) {
        const date = new Date(scheduledTime);
        hours = date.getHours();
        minutes = date.getMinutes();
      } else {
        const timeParts = scheduledTime.split(':');
        hours = parseInt(timeParts[0], 10);
        minutes = parseInt(timeParts[1], 10);
      }
      
      const scheduledDate = new Date();
      scheduledDate.setHours(hours, minutes, 0, 0);
      
      // Si la hora ya pasó hoy, programar para mañana
      if (scheduledDate.getTime() <= now.getTime()) {
        scheduledDate.setTime(scheduledDate.getTime() + 24 * 60 * 60 * 1000);
      }
      
      // Programar recordatorios cada X minutos después de la hora programada
      for (let i = 1; i <= 3; i++) { // Máximo 3 recordatorios
        const reminderTime = new Date(scheduledDate.getTime() + (alarmSettings.reminderInterval * i * 60 * 1000));
        
        // Solo programar si es en el futuro
        if (reminderTime.getTime() > now.getTime()) {
          const reminderId = `${medication.id}_reminder_${i}_${scheduledTime}_${reminderTime.getTime()}`;
          
          const reminderRequest = {
            identifier: reminderId,
            content: {
              title: '⏰ Recordatorio de medicamento',
              body: `No olvides tomar ${medication.name} (${medication.dose})`,
              sound: alarmSettings.soundEnabled ? 'default' : false,
              data: {
                medicationId: medication.id,
                medicationName: medication.name,
                dose: medication.dose,
                scheduledTime: scheduledTime,
                isReminder: true,
                reminderNumber: i,
              },
              categoryIdentifier: 'MEDICATION_REMINDER',
              ...(Platform.OS === 'android' && {
                channelId: 'medtime-reminders',
                vibrate: alarmSettings.vibrationEnabled ? [0, 250, 250, 250] : undefined,
              }),
            },
            trigger: {
              type: 'date' as Notifications.SchedulableTriggerInputTypes.DATE,
              date: reminderTime,
            },
          };
          
          await Notifications.scheduleNotificationAsync(reminderRequest);
          notificationIds.push(reminderId);
          
          console.log(`[NotificationService] Recordatorio ${i} programado para ${reminderTime.toLocaleTimeString()}`);
        }
      }
    }
    
    return notificationIds;
  } catch (error) {
    console.error('[NotificationService] Error al programar recordatorios:', error);
    return [];
  }
}

/**
 * Maneja las respuestas de las notificaciones interactivas
 */
export function handleNotificationResponse(response: Notifications.NotificationResponse): void {
  const { actionIdentifier, notification } = response;
  const data = notification.request.content.data;
  
  console.log('[NotificationService] Respuesta de notificación:', {
    action: actionIdentifier,
    medicationId: data?.medicationId,
    medicationName: data?.medicationName,
  });

  switch (actionIdentifier) {
    case 'TAKE_MEDICATION':
      handleTakeMedication(data);
      break;
    case 'SNOOZE_MEDICATION':
      handleSnoozeMedication(data);
      break;
    case 'CANCEL_MEDICATION':
      handleCancelMedication(data);
      break;
    default:
      console.log('[NotificationService] Acción no reconocida:', actionIdentifier);
  }
}

/**
 * Cancela todas las notificaciones pendientes y limpia alarmas
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    console.log('[NotificationService] Cancelando todas las notificaciones pendientes...');
    
    // Cancelar todas las notificaciones programadas
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    // Limpiar todas las notificaciones entregadas
    await Notifications.dismissAllNotificationsAsync();
    
    console.log('[NotificationService] ✅ Todas las notificaciones han sido canceladas');
  } catch (error) {
    console.error('[NotificationService] Error al cancelar notificaciones:', error);
  }
}

/**
 * Función de prueba para programar notificación inmediata
 */
export async function scheduleTestNotificationImmediate(): Promise<string | null> {
  try {
    console.log('[NotificationService] Programando notificación de prueba inmediata');
    
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[NotificationService] No se pueden programar notificaciones sin permisos');
      return null;
    }

    const now = new Date();
    const triggerDate = new Date(now.getTime() + 5 * 1000); // 5 segundos después
    
    const notificationId = `test_immediate_${Date.now()}`;
    
    const notificationRequest = {
      identifier: notificationId,
      content: {
        title: '🔔 ¡Hora de medicamento!',
        body: 'Es hora de tomar Paracetamol (500 mg)',
        sound: false,
        data: {
          medicationId: 'test',
          medicationName: 'Paracetamol',
          dose: '500 mg',
          scheduledTime: triggerDate.toISOString(),
          isAlarm: true,
          showModal: true,
        },
        categoryIdentifier: 'MEDICATION_ALARM',
        ...(Platform.OS === 'android' && {
          channelId: 'medtime-reminders',
        }),
      },
      trigger: {
        type: 'date' as Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    };

    await Notifications.scheduleNotificationAsync(notificationRequest);
    console.log(`[NotificationService] ✅ Notificación de prueba programada para ${triggerDate.toLocaleTimeString()}`);
    return notificationId;
  } catch (error) {
    console.error('[NotificationService] Error al programar notificación de prueba:', error);
    return null;
  }
}

/**
 * Maneja cuando el usuario presiona "Tomar" medicamento
 */
async function handleTakeMedication(data: any): Promise<void> {
  try {
    console.log('[NotificationService] ✅ Medicamento tomado:', data?.medicationName);
    
    // Importar la función de historial
    const { addToHistory } = await import('../storage/history');
    
    // Agregar al historial
    await addToHistory({
      id: Date.now().toString(),
      name: data.medicationName || 'Medicamento',
      dose: data.dose || 'N/A',
      at: new Date().toISOString(),
      status: 'Tomado',
      scheduledTimes: [data.scheduledTime || new Date().toISOString()],
    });
    
    console.log('[NotificationService] ✅ Medicamento marcado como tomado y agregado al historial');
  } catch (error) {
    console.error('[NotificationService] Error al registrar toma de medicamento:', error);
  }
}

/**
 * Maneja cuando el usuario presiona "Aplazar 10min"
 */
async function handleSnoozeMedication(data: any): Promise<void> {
  try {
    console.log('[NotificationService] ⏰ Aplazando medicamento 10 minutos:', data?.medicationName);
    
    // Programar nueva notificación para 10 minutos después
    const snoozeTime = new Date(Date.now() + 10 * 60 * 1000); // +10 minutos
    const snoozeId = `${data?.medicationId}_snooze_${Date.now()}`;
    
    const snoozeRequest = {
      identifier: snoozeId,
      content: {
        title: '🔔 ¡Hora de medicamento! (Aplazado)',
        body: `Es hora de tomar ${data?.medicationName} (${data?.dose})`,
        sound: 'default',
        data: {
          medicationId: data?.medicationId,
          medicationName: data?.medicationName,
          dose: data?.dose,
          scheduledTime: data?.scheduledTime,
          isAlarm: true,
          isSnoozed: true,
        },
        categoryIdentifier: 'MEDICATION_ALARM',
      },
      trigger: {
        type: 'date' as Notifications.SchedulableTriggerInputTypes.DATE,
        date: snoozeTime,
      },
    };

    await Notifications.scheduleNotificationAsync(snoozeRequest);
    console.log('[NotificationService] ✅ Notificación aplazada para:', snoozeTime.toLocaleTimeString());
    
  } catch (error) {
    console.error('[NotificationService] Error al aplazar medicamento:', error);
  }
}

/**
 * Maneja cuando el usuario presiona "Cancelar"
 */
async function handleCancelMedication(data: any): Promise<void> {
  try {
    console.log('[NotificationService] ❌ Medicamento cancelado:', data?.medicationName);
    
    // Importar la función de historial
    const { addToHistory } = await import('../storage/history');
    
    // Agregar al historial como cancelado
    await addToHistory({
      id: Date.now().toString(),
      name: data.medicationName || 'Medicamento',
      dose: data.dose || 'N/A',
      at: new Date().toISOString(),
      status: 'Cancelado',
      scheduledTimes: [data.scheduledTime || new Date().toISOString()],
    });
    
    // Cancelar todas las notificaciones relacionadas con este medicamento
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const idsToCancel = scheduled
      .filter(n => n.identifier.includes(data?.medicationId))
      .map(n => n.identifier);

    for (const id of idsToCancel) {
      await Notifications.cancelScheduledNotificationAsync(id);
      console.log('[NotificationService] Notificación cancelada:', id);
    }
    
    console.log('[NotificationService] ✅ Medicamento cancelado y agregado al historial');
    
  } catch (error) {
    console.error('[NotificationService] Error al cancelar medicamento:', error);
  }
}

// Función para registrar el callback del modal (importada desde alarmService)
export { setAlarmModalCallback } from '../alarms/alarmService';
