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

/** Utilidad: convierte historial a CSV (cabeceras incluidas). */
export function historyToCSV(rows: HistoryEntry[]) {
  const esc = (s: string) =>
    `"${s.replace(/"/g, '""')}"`; // escapar comillas
  const header = ["fecha", "nombre", "dosis", "horarios", "estado"].join(",");
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
    return [fecha, r.name, r.dose, horarios, r.status].map(esc).join(",");
  });
  return [header, ...lines].join("\n");
}
