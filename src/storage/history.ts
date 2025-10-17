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
  selectedDates?: string[]; // fechas seleccionadas (YYYY-MM-DD)
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
    selectedDates: m.selectedDates,
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
    selectedDates: m.selectedDates,
    status,
    at: now,
  }));
  const next = [...batch, ...list];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

/** Utilidad: convierte historial a CSV (cabeceras incluidas). */
export function historyToCSV(rows: HistoryEntry[], userInfo?: { name?: string; age?: number; gender?: string }) {
  const esc = (s: string) =>
    `"${s.replace(/"/g, '""')}"`; // escapar comillas
  
  // Agregar mensaje formal al inicio del documento
  let csvContent = "";
  csvContent += `"HISTORIAL MEDICO - MEDTIME"\n`;
  csvContent += `"Este documento contiene el registro detallado de medicamentos y horarios de administracion"\n`;
  csvContent += `"Fecha de generacion: ${new Date().toLocaleDateString()}"\n`;
  csvContent += `"Documento confidencial - Tratar con privacidad"\n`;
  csvContent += `\n`; // Línea en blanco
  
  // Agregar información del usuario al inicio
  if (userInfo) {
    csvContent += `"INFORMACION DEL PACIENTE"\n`;
    if (userInfo.name) csvContent += `"Nombre","${userInfo.name}"\n`;
    if (userInfo.age) csvContent += `"Edad","${userInfo.age} anos"\n`;
    if (userInfo.gender) csvContent += `"Genero","${userInfo.gender}"\n`;
    csvContent += `\n`; // Línea en blanco
  }
  
  const header = ["fecha", "medicamento", "dosis", "fechas_seleccionadas", "horarios", "estado"].join(",");
  const lines = rows.map((r) => {
    const fecha = new Date(r.at).toLocaleString();
    const horarios = r.scheduledTimes
      .map((iso) => {
        const d = new Date(iso);
        const hh = d.getHours().toString().padStart(2, "0");
        const mm = d.getMinutes().toString().padStart(2, "0");
        return `${hh}:${mm}`;
      })
      .join(" · ");
    const fechasSeleccionadas = r.selectedDates?.map(dateString => {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES');
    }).join(" · ") || "—";
    return [fecha, r.name, r.dose, fechasSeleccionadas, horarios, r.status].map(esc).join(",");
  });
  
  csvContent += [header, ...lines].join("\n");
  return csvContent;
}

// Función para agregar entrada de historial desde el modal de alarma
export async function addToHistory(entry: {
  id: string;
  name: string;
  dose: string;
  at: string;
  status: HistoryStatus;
  scheduledTimes: string[];
  selectedDates?: string[];
}): Promise<void> {
  try {
    console.log('[History] Iniciando addToHistory con entrada:', entry);
    
    const historyEntry: HistoryEntry = {
      id: entry.id,
      medId: entry.id, // Usar el mismo ID como medId
      name: entry.name,
      dose: entry.dose,
      scheduledTimes: entry.scheduledTimes,
      selectedDates: entry.selectedDates,
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
