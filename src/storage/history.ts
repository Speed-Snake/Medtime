// src/storage/history.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MedItem } from "./localMedicines";

export type HistoryStatus = "Tomado" | "Cancelado";
export type HistoryEntry = {
  id: string;               // id único de la entrada en historial
  medId: string;            // id del medicamento original
  name: string;
  dose: string;
  scheduledTimes: string[]; // horarios planificados (ISO)
  status: HistoryStatus;    // "Tomado" | "Cancelado"
  at: string;               // cuándo se generó este registro (ISO)
};

const KEY = "medtime:history";

export async function getHistory(): Promise<HistoryEntry[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as HistoryEntry[]; } catch { return []; }
}

export async function addHistoryFromMed(m: MedItem, status: HistoryStatus) {
  const entry: HistoryEntry = {
    id: `${Date.now()}`,
    medId: m.id,
    name: m.name,
    dose: m.dose,
    scheduledTimes: m.times,
    status,
    at: new Date().toISOString(),
  };
  const list = await getHistory();
  list.unshift(entry);
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function addManyHistoryFromMeds(meds: MedItem[], status: HistoryStatus) {
  if (meds.length === 0) return;
  const list = await getHistory();
  const now = new Date().toISOString();
  const batch: HistoryEntry[] = meds.map((m, i) => ({
    id: `${Date.now()}_${i}`,
    medId: m.id,
    name: m.name,
    dose: m.dose,
    scheduledTimes: m.times,
    status,
    at: now,
  }));
  const next = [...batch, ...list];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

/** Utilidad: convierte historial a CSV con formato de tabla médica. */
export function historyToCSV(rows: HistoryEntry[], patientInfo?: { name?: string; age?: number; sex?: string }) {
  const esc = (s: string) =>
    `"${s.replace(/"/g, '""')}"`; // escapar comillas
  
  // Información del paciente (opcional)
  const patientSection = patientInfo ? 
    `Nombre: ${patientInfo.name || "N/A"}, Edad: ${patientInfo.age || "N/A"}, Sexo: ${patientInfo.sex || "N/A"}\n` : "";
  
  // Cabeceras de la tabla
  const header = ["fecha", "medicamento", "dosis", "horarios", "estado"].join(",");
  
  const lines = rows.map((r) => {
    // Formato de fecha solo: MM/DD/YYYY
    const date = new Date(r.at);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const year = date.getFullYear();
    const fecha = `${month}/${day}/${year}`;
    
    // Horarios programados
    const horarios = r.scheduledTimes
      .map((iso) => {
        const d = new Date(iso);
        const hh = d.getHours().toString().padStart(2, "0");
        const mm = d.getMinutes().toString().padStart(2, "0");
        return `${hh}:${mm}`;
      })
      .join(" · ");
    
    // Estado con formato HH:MM Tomado/Cancelado
    const statusTime = new Date(r.at);
    const statusHours = statusTime.getHours().toString().padStart(2, "0");
    const statusMinutes = statusTime.getMinutes().toString().padStart(2, "0");
    const estado = `${statusHours}:${statusMinutes} ${r.status}`;
    
    return [fecha, r.name, r.dose, horarios, estado].map(esc).join(",");
  });
  
  return patientSection + [header, ...lines].join("\n");
}

// Función para agregar entrada de historial desde el modal de alarma
export async function addToHistory(entry: {
  id: string;
  name: string;
  dose: string;
  at: string;
  status: HistoryStatus;
  scheduledTimes: string[];
}): Promise<void> {
  try {
    console.log('[History] Iniciando addToHistory con entrada:', entry);
    
    const historyEntry: HistoryEntry = {
      id: entry.id,
      medId: entry.id, // Usar el mismo ID como medId
      name: entry.name,
      dose: entry.dose,
      scheduledTimes: entry.scheduledTimes,
      status: entry.status,
      at: entry.at,
    };
    
    console.log('[History] Creando entrada de historial:', historyEntry);
    
    const list = await getHistory();
    console.log('[History] Historial actual antes de agregar:', list.length, 'entradas');
    
    list.unshift(historyEntry);
    console.log('[History] Historial después de agregar:', list.length, 'entradas');
    
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
    console.log('[History] ✅ Entrada guardada en AsyncStorage');
    
    // Verificar que se guardó correctamente
    const savedList = await getHistory();
    console.log('[History] Verificación - historial guardado:', savedList.length, 'entradas');
    console.log('[History] Última entrada:', savedList[0]);
  } catch (error) {
    console.error('[History] Error al agregar entrada:', error);
    throw error;
  }
}
