// app/alarmModal.tsx
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Vibration,
  Dimensions,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../src/contexts/AuthContext';
import { addToHistory } from '../src/storage/history';
import { saveHistoryEntryToSupabase } from '../src/storage/supabaseHistory';
import { removeSpecificTimeFromMedicine, getLocalMedicines, writeMedicinesByOwner } from '../src/storage/localMedicines';
import { scheduleMedicationNotificationWithAlarm } from '../src/notifications/notificationService';

interface AlarmModalProps {
  visible: boolean;
  medication: {
    id: string;
    name: string;
    dose: string;
    scheduledTime: string;
  } | null;
  onClose: () => void;
  onMedicinesUpdate?: () => void;
}

const { width, height } = Dimensions.get('window');

export default function AlarmModal({
  visible,
  medication,
  onClose,
  onMedicinesUpdate,
}: AlarmModalProps) {
  const { user } = useAuth();

  useEffect(() => {
    if (visible && medication) {
      playAlarmSound();
      // Vibrar continuamente mientras el modal esté abierto con patrón más intenso
      const vibrationInterval = setInterval(() => {
        console.log('[AlarmModal] Vibración continua intensa');
        Vibration.vibrate([0, 1000, 500, 1000, 500, 1000]);
      }, 1500); // Más frecuente

      return () => {
        clearInterval(vibrationInterval);
        Vibration.cancel();
      };
    }
  }, [visible, medication]);

  const playAlarmSound = async () => {
    try {
      console.log('🔊 ALARMA INICIADA - Medicamento:', medication?.name);
      
      // NO programar notificación adicional aquí - ya se programó desde notificationService
      console.log('🔔 Modal de alarma abierto - no se necesita notificación adicional');
      
      // Vibración intensa
      console.log('📳 Iniciando vibración...');
      Vibration.vibrate([
        0, 200, 100, 200, 100, 200, 100, 200, 100, 200, 100, 200, 100, 200, 100, 200,
        0, 500, 100, 500, 100, 500, 100, 500, 100, 500, 100, 500, 100, 500, 100, 500,
        0, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000
      ]);
      
      console.log('✅ Alarma completada');
      
    } catch (error) {
      console.error('❌ Error general:', error);
      Vibration.vibrate([0, 1000, 500, 1000, 500, 1000, 500, 1000]);
    }
  };

  const stopAlarm = async () => {
    try {
      // Detener vibración
      Vibration.cancel();
      console.log('[AlarmModal] Alarma detenida');
    } catch (error) {
      console.error('Error stopping alarm:', error);
    }
  };

  const handleTake = async () => {
    if (!medication) return;
    
    try {
      console.log('[AlarmModal] Marcando medicamento como tomado:', medication);
      
      // Detener alarma primero
      await stopAlarm();
      
      // Marcar como tomado en el historial
      const historyEntry = {
        id: Date.now().toString(),
        name: medication.name,
        dose: medication.dose,
        at: new Date().toISOString(),
        status: 'Tomado' as const,
        scheduledTimes: [medication.scheduledTime],
      };
      
      console.log('[AlarmModal] Agregando al historial:', historyEntry);
      try {
        // Guardar en historial local
        await addToHistory(historyEntry);
        console.log('[AlarmModal] ✅ Historial local actualizado correctamente');
        
        // Eliminar la hora específica del medicamento
        const owner = user?.mode === "user" ? "user" : "guest";
        const userId = user?.mode === "user" ? user.name : undefined;
        const timeRemoved = await removeSpecificTimeFromMedicine(
          medication.id, 
          medication.scheduledTime, 
          owner, 
          userId
        );
        
        if (timeRemoved) {
          console.log('[AlarmModal] ✅ Hora específica eliminada del medicamento');
        } else {
          console.warn('[AlarmModal] ⚠️ No se pudo eliminar la hora específica del medicamento');
        }
        
        // Si el usuario está autenticado, también guardar en Supabase
        if (user?.mode === "user") {
          console.log('[AlarmModal] Usuario autenticado, guardando en Supabase...');
          const supabaseEntry = {
            // medication_id: undefined, // No enviar para medicamentos locales
            med_name: medication.name,
            dose: medication.dose,
            taken_at: new Date().toISOString(),
            status: 'Tomado' as const,
            scheduled_times: [medication.scheduledTime], // Enviar como array
          };
          
          console.log('[AlarmModal] Datos para Supabase:', supabaseEntry);
          const savedEntry = await saveHistoryEntryToSupabase(supabaseEntry);
          if (savedEntry) {
            console.log('[AlarmModal] ✅ Historial Supabase actualizado correctamente:', savedEntry);
          } else {
            console.warn('[AlarmModal] ⚠️ No se pudo guardar en Supabase, pero se guardó localmente');
          }
        } else {
          console.log('[AlarmModal] Usuario no autenticado, solo guardando localmente');
        }
      } catch (error) {
        console.error('[AlarmModal] ❌ Error al actualizar historial:', error);
        Alert.alert('Error', 'No se pudo guardar en el historial');
        return;
      }

      onClose();
      
      // Notificar actualización de medicamentos
      if (onMedicinesUpdate) {
        onMedicinesUpdate();
      }
      
      Alert.alert('✅ Medicamento Tomado', `${medication.name} registrado correctamente.`);
    } catch (error) {
      console.error('Error al marcar medicamento como tomado:', error);
      Alert.alert('Error', `No se pudo registrar la toma del medicamento: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleSnooze = async () => {
    if (!medication) return;
    
    try {
      console.log('[AlarmModal] Posponiendo medicamento:', medication);
      
      // Calcular nueva hora (10 minutos después de la hora programada)
      const originalTime = new Date(medication.scheduledTime);
      const snoozeTime = new Date(originalTime.getTime() + 10 * 60 * 1000);
      
      console.log('[AlarmModal] Hora original:', originalTime.toISOString());
      console.log('[AlarmModal] Nueva hora (pospuesta):', snoozeTime.toISOString());
      
      // Actualizar el medicamento: eliminar la hora original y agregar la nueva
      const owner = user?.mode === "user" ? "user" : "guest";
      const userId = user?.mode === "user" ? user.name : undefined;
      
      // Primero eliminar la hora original
      const timeRemoved = await removeSpecificTimeFromMedicine(
        medication.id, 
        medication.scheduledTime, 
        owner, 
        userId
      );
      
      if (timeRemoved) {
        console.log('[AlarmModal] ✅ Hora original eliminada, agregando nueva hora...');
        
        // Ahora necesitamos agregar la nueva hora al medicamento
        // Para esto necesitamos cargar el medicamento actualizado y agregar la nueva hora
        const currentMedicines = await getLocalMedicines(owner, userId);
        const updatedMedicine = currentMedicines.find(m => m.id === medication.id);
        
        if (updatedMedicine) {
          // Agregar la nueva hora
          const newTimes = [...updatedMedicine.times, snoozeTime.toISOString()];
          const updatedMed = { ...updatedMedicine, times: newTimes };
          const otherMeds = currentMedicines.filter(m => m.id !== medication.id);
          await writeMedicinesByOwner(owner, [...otherMeds, updatedMed], userId);
          
          console.log('[AlarmModal] ✅ Medicamento actualizado con nueva hora');
        }
      }
      
      // Programar notificación para la nueva hora
      await scheduleMedicationNotificationWithAlarm({
        id: medication.id,
        name: medication.name,
        dose: medication.dose,
        times: [snoozeTime.toISOString()],
        owner: owner,
        createdAt: new Date().toISOString(),
      }, snoozeTime.toISOString());

      await stopAlarm();
      onClose();
      
      // Notificar actualización de medicamentos
      if (onMedicinesUpdate) {
        onMedicinesUpdate();
      }
      
      Alert.alert('⏰ Aplazado', `${medication.name} se recordará a las ${snoozeTime.toLocaleTimeString()}.`);
    } catch (error) {
      console.error('Error al aplazar medicamento:', error);
      Alert.alert('Error', 'No se pudo aplazar el medicamento.');
    }
  };

  const handleCancel = async () => {
    if (!medication) return;
    
    try {
      console.log('[AlarmModal] Cancelando medicamento:', medication);
      
      // Detener alarma primero
      await stopAlarm();
      
      // Marcar como cancelado en el historial
      const historyEntry = {
        id: Date.now().toString(),
        name: medication.name,
        dose: medication.dose,
        at: new Date().toISOString(),
        status: 'Cancelado' as const,
        scheduledTimes: [medication.scheduledTime],
      };
      
      console.log('[AlarmModal] Agregando al historial:', historyEntry);
      try {
        // Guardar en historial local
        await addToHistory(historyEntry);
        console.log('[AlarmModal] ✅ Historial local actualizado correctamente');
        
        // Si el usuario está autenticado, también guardar en Supabase
        if (user?.mode === "user") {
          console.log('[AlarmModal] Usuario autenticado, guardando cancelación en Supabase...');
          const supabaseEntry = {
            // medication_id: undefined, // No enviar para medicamentos locales
            med_name: medication.name,
            dose: medication.dose,
            taken_at: new Date().toISOString(),
            status: 'Cancelado' as const,
            scheduled_times: [medication.scheduledTime], // Enviar como array
          };
          
          console.log('[AlarmModal] Datos de cancelación para Supabase:', supabaseEntry);
          const savedEntry = await saveHistoryEntryToSupabase(supabaseEntry);
          if (savedEntry) {
            console.log('[AlarmModal] ✅ Cancelación guardada en Supabase correctamente:', savedEntry);
          } else {
            console.warn('[AlarmModal] ⚠️ No se pudo guardar cancelación en Supabase, pero se guardó localmente');
          }
        } else {
          console.log('[AlarmModal] Usuario no autenticado, solo guardando cancelación localmente');
        }
      } catch (error) {
        console.error('[AlarmModal] ❌ Error al actualizar historial:', error);
        Alert.alert('Error', 'No se pudo guardar en el historial');
        return;
      }

      onClose();
      
      Alert.alert('❌ Cancelado', `${medication.name} cancelado.`);
    } catch (error) {
      console.error('Error al cancelar medicamento:', error);
      Alert.alert('Error', `No se pudo cancelar el medicamento: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (!visible || !medication) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header de alarma */}
          <View style={styles.header}>
            <Text style={styles.alarmIcon}>🚨</Text>
            <Text style={styles.alarmTitle}>¡Hora de tu medicamento!</Text>
          </View>

          {/* Información del medicamento */}
          <View style={styles.medicationInfo}>
            <Text style={styles.medicationName}>{medication.name}</Text>
            <Text style={styles.medicationDose}>Dosis: {medication.dose}</Text>
            <Text style={styles.medicationTime}>
              Horario: {new Date(medication.scheduledTime).toLocaleTimeString()}
            </Text>
          </View>

          {/* Botones de acción */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.takeButton]}
              onPress={handleTake}
            >
              <Text style={styles.buttonText}>✅ Tomar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.snoozeButton]}
              onPress={handleSnooze}
            >
              <Text style={styles.buttonText}>⏰ Posponer 10min</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Text style={styles.buttonText}>❌ Cancelar</Text>
            </TouchableOpacity>
          </View>

          {/* Instrucciones */}
          <Text style={styles.instructions}>
            Selecciona una acción para continuar
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    margin: 20,
    width: width * 0.9,
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  alarmIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  alarmTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e74c3c',
    textAlign: 'center',
  },
  medicationInfo: {
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  medicationName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  medicationDose: {
    fontSize: 18,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  medicationTime: {
    fontSize: 16,
    color: '#95a5a6',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  takeButton: {
    backgroundColor: '#27ae60',
  },
  snoozeButton: {
    backgroundColor: '#f39c12',
  },
  cancelButton: {
    backgroundColor: '#e74c3c',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  instructions: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
    marginTop: 16,
  },
});
