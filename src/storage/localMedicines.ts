// src/storage/localMedicines.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type MedDose = string;

export type MedItem = {
  id: string;
  name: string;
  dose: MedDose;
  times: string[];       // ISO strings
  owner: "guest" | "user";
  createdAt: string;     // ISO
};

const KEY = "medtime:meds";

/** Lee todo el arreglo desde storage. */
export async function readAllMedicines(): Promise<MedItem[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as MedItem[];
    // (Opcional) de-dup por id si hubiera repetidos
    const seen = new Set<string>();
    const dedup = arr.filter(m => (seen.has(m.id) ? false : (seen.add(m.id), true)));
    if (dedup.length !== arr.length) {
      await AsyncStorage.setItem(KEY, JSON.stringify(dedup));
      return dedup;
    }
    return arr;
  } catch {
    return [];
  }
}

/** Escribe el arreglo completo. */
export async function writeAllMedicines(list: MedItem[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

/**
 * Inserta o actualiza (upsert) un medicamento:
 * - Si ya existe el id -> lo reemplaza y lo mueve al frente.
 * - Si no existe -> lo agrega al frente.
 */
export async function saveMedicineLocally(item: MedItem): Promise<void> {
  const all = await readAllMedicines();
  const idx = all.findIndex(m => m.id === item.id);
  let next: MedItem[];
  if (idx >= 0) {
    // Reemplaza y lleva al frente
    next = [item, ...all.filter(m => m.id !== item.id)];
  } else {
    next = [item, ...all];
  }
  await writeAllMedicines(next);
}

/** Elimina por id. */
export async function removeMedicineLocally(id: string): Promise<void> {
  const all = await readAllMedicines();
  const next = all.filter(m => m.id !== id);
  await writeAllMedicines(next);
}

/** Busca un medicamento por id. */
export async function findMedicineById(id: string): Promise<MedItem | undefined> {
  const all = await readAllMedicines();
  return all.find(m => m.id === id);
}

/** 🔁 Wrapper para compatibilidad con el código de la lista */
export const getLocalMedicines = readAllMedicines;
