// src/alarms/alarmService.ts
import { MedItem } from '../storage/localMedicines';
import { loadAlarmSettings } from '../storage/alarmSettings';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Callback para mostrar el modal de alarma
let showAlarmModal: ((medication: any) => void) | null = null;

// Timers activos
const activeTimers = new Map<string, NodeJS.Timeout>();

// Función para registrar el callback del modal
export function setAlarmModalCallback(callback: (medication: any) => void) {
  showAlarmModal = callback;
}

// Función para programar una alarma
export async function scheduleAlarm(medication: MedItem, scheduledTime: string): Promise<string | null> {
  try {
    console.log(`[AlarmService] Programando alarma para ${medication.name} a las ${scheduledTime}`);
    
    const alarmSettings = await loadAlarmSettings();
    
    // Si las alarmas están deshabilitadas, no programar
    if (!alarmSettings.enabled) {
      console.log('[AlarmService] Alarmas deshabilitadas, no se programará alarma');
      return null;
    }

    const now = new Date();
    
    // Parsear la hora programada
    let hours, minutes;
    
    if (scheduledTime.includes('T')) {
      const date = new Date(scheduledTime);
      if (isNaN(date.getTime())) {
        console.error('[AlarmService] Fecha ISO inválida:', scheduledTime);
        return null;
      }
      hours = date.getHours();
      minutes = date.getMinutes();
    } else {
      const timeParts = scheduledTime.split(':');
      if (timeParts.length !== 2) {
        console.error('[AlarmService] Formato de hora inválido:', scheduledTime);
        return null;
      }
      hours = parseInt(timeParts[0], 10);
      minutes = parseInt(timeParts[1], 10);
    }
    
    // Validar hora
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      console.error('[AlarmService] Hora inválida:', scheduledTime);
      return null;
    }
    
    // Crear fecha para hoy con la hora programada
    const today = new Date();
    today.setHours(hours, minutes, 0, 0);
    
    // Si la hora ya pasó hoy, programar para mañana
    let triggerDate = new Date(today);
    if (today.getTime() <= now.getTime()) {
      console.log('[AlarmService] La hora ya pasó hoy, programando para mañana');
      triggerDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    }
    
    // Para pruebas: si es muy cercano (menos de 5 minutos), programar para 10 segundos después
    const timeDiff = triggerDate.getTime() - now.getTime();
    if (timeDiff < 5 * 60 * 1000 && timeDiff > 0) {
      console.log('[AlarmService] Hora muy cercana, programando para 10 segundos después');
      triggerDate = new Date(now.getTime() + 10 * 1000);
    }
    
    // Asegurar que la fecha sea al menos 1 segundo en el futuro
    const minFutureTime = new Date(now.getTime() + 1000);
    if (triggerDate.getTime() <= minFutureTime.getTime()) {
      triggerDate = minFutureTime;
    }
    
    if (isNaN(triggerDate.getTime())) {
      console.error('[AlarmService] Fecha inválida generada:', triggerDate);
      return null;
    }
    
    const alarmId = `${medication.id}_alarm_${scheduledTime}_${triggerDate.getTime()}`;
    
    console.log(`[AlarmService] Fecha programada: ${triggerDate.toISOString()}`);
    console.log(`[AlarmService] Diferencia en segundos: ${(triggerDate.getTime() - now.getTime()) / 1000}`);
    
    // Para horarios muy cercanos (menos de 2 minutos), usar timer
    // Para horarios más lejanos, usar notificación del sistema
    // timeDiff ya está calculado arriba
    
    if (timeDiff < 2 * 60 * 1000) {
      // Usar timer para horarios cercanos
      const timer = setTimeout(() => {
        console.log(`[AlarmService] 🚨 ALARMA ACTIVADA (timer) para ${medication.name}`);
        
        if (showAlarmModal) {
          showAlarmModal({
            id: medication.id,
            name: medication.name,
            dose: medication.dose,
            scheduledTime: scheduledTime,
          });
        } else {
          console.error('[AlarmService] No hay callback de modal registrado');
        }
        
        // Remover el timer de la lista de activos
        activeTimers.delete(alarmId);
      }, timeDiff);
      
      // Guardar el timer
      activeTimers.set(alarmId, timer);
    } else {
      // Para horarios lejanos, usar el sistema de notificaciones principal
      // No programar aquí para evitar duplicados
      console.log(`[AlarmService] Horario lejano, delegando a notificationService`);
    }
    
    console.log(`[AlarmService] ✅ Alarma programada para ${medication.name} a las ${triggerDate.toLocaleTimeString()}`);
    return alarmId;
  } catch (error) {
    console.error('[AlarmService] Error al programar alarma:', error);
    return null;
  }
}

// Función para cancelar una alarma
export function cancelAlarm(alarmId: string): void {
  const timer = activeTimers.get(alarmId);
  if (timer) {
    clearTimeout(timer);
    activeTimers.delete(alarmId);
    console.log(`[AlarmService] ✅ Alarma cancelada: ${alarmId}`);
  }
}

// Función para cancelar todas las alarmas de un medicamento
export function cancelAllAlarmsForMedication(medicationId: string): void {
  const alarmsToCancel: string[] = [];
  
  for (const [alarmId, timer] of activeTimers.entries()) {
    if (alarmId.includes(medicationId)) {
      clearTimeout(timer);
      alarmsToCancel.push(alarmId);
    }
  }
  
  alarmsToCancel.forEach(alarmId => {
    activeTimers.delete(alarmId);
    console.log(`[AlarmService] ✅ Alarma cancelada: ${alarmId}`);
  });
  
  console.log(`[AlarmService] ✅ ${alarmsToCancel.length} alarmas canceladas para medicamento ${medicationId}`);
}

// Función para cancelar todas las alarmas
export function cancelAllAlarms(): void {
  for (const [alarmId, timer] of activeTimers.entries()) {
    clearTimeout(timer);
    console.log(`[AlarmService] ✅ Alarma cancelada: ${alarmId}`);
  }
  activeTimers.clear();
  console.log(`[AlarmService] ✅ Todas las alarmas canceladas`);
}

// Función para obtener alarmas activas
export function getActiveAlarms(): string[] {
  return Array.from(activeTimers.keys());
}

// Función de prueba para programar alarma inmediata
export async function scheduleTestAlarm(): Promise<string | null> {
  try {
    console.log('[AlarmService] Programando alarma de prueba inmediata');
    
    const testMedication: MedItem = {
      id: 'test',
      name: 'Paracetamol',
      dose: '500 mg',
      times: [new Date(Date.now() + 5 * 1000).toISOString()], // 5 segundos después
      owner: 'guest',
      createdAt: new Date().toISOString(),
    };
    
    return await scheduleAlarm(testMedication, testMedication.times[0]);
  } catch (error) {
    console.error('[AlarmService] Error al programar alarma de prueba:', error);
    return null;
  }
}
