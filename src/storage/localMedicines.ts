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

const KEY_GUEST = "medtime:meds:guest";
const KEY_USER_PREFIX = "medtime:meds:user:";

/** Obtiene la clave de almacenamiento según el tipo de usuario */
function getStorageKey(owner: "guest" | "user", userId?: string): string {
  if (owner === "guest") {
    return KEY_GUEST;
  }
  if (!userId) {
    throw new Error("userId es requerido para usuarios autenticados");
  }
  return `${KEY_USER_PREFIX}${userId}`;
}

/** Lee medicamentos de un tipo específico de usuario */
export async function readMedicinesByOwner(owner: "guest" | "user", userId?: string): Promise<MedItem[]> {
  const key = getStorageKey(owner, userId);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as MedItem[];
    // (Opcional) de-dup por id si hubiera repetidos
    const seen = new Set<string>();
    const dedup = arr.filter(m => (seen.has(m.id) ? false : (seen.add(m.id), true)));
    if (dedup.length !== arr.length) {
      await AsyncStorage.setItem(key, JSON.stringify(dedup));
      return dedup;
    }
    return arr;
  } catch {
    return [];
  }
}

/** Lee todo el arreglo desde storage (para compatibilidad) */
export async function readAllMedicines(): Promise<MedItem[]> {
  const guestMeds = await readMedicinesByOwner("guest");
  // Para readAllMedicines, no podemos obtener todos los usuarios, así que solo devolvemos invitados
  return guestMeds;
}

/** Escribe medicamentos de un tipo específico de usuario */
export async function writeMedicinesByOwner(owner: "guest" | "user", list: MedItem[], userId?: string): Promise<void> {
  const key = getStorageKey(owner, userId);
  await AsyncStorage.setItem(key, JSON.stringify(list));
}

/** Escribe el arreglo completo (para compatibilidad) */
export async function writeAllMedicines(list: MedItem[]): Promise<void> {
  // Solo procesar medicamentos de invitados para compatibilidad
  const guestMeds = list.filter(m => m.owner === "guest");
  await writeMedicinesByOwner("guest", guestMeds);
}

/**
 * Inserta o actualiza (upsert) un medicamento:
 * - Si ya existe el id -> lo reemplaza y lo mueve al frente.
 * - Si no existe -> lo agrega al frente.
 */
export async function saveMedicineLocally(item: MedItem, userId?: string): Promise<void> {
  const all = await readMedicinesByOwner(item.owner, userId);
  const idx = all.findIndex(m => m.id === item.id);
  let next: MedItem[];
  if (idx >= 0) {
    // Reemplaza y lleva al frente
    next = [item, ...all.filter(m => m.id !== item.id)];
  } else {
    next = [item, ...all];
  }
  await writeMedicinesByOwner(item.owner, next, userId);
}

/** Elimina por id. */
export async function removeMedicineLocally(id: string, userId?: string): Promise<void> {
  // Buscar en invitados
  const guestMeds = await readMedicinesByOwner("guest");
  const guestNext = guestMeds.filter(m => m.id !== id);
  await writeMedicinesByOwner("guest", guestNext);
  
  // Si hay userId, buscar también en usuarios
  if (userId) {
    const userMeds = await readMedicinesByOwner("user", userId);
    const userNext = userMeds.filter(m => m.id !== id);
    await writeMedicinesByOwner("user", userNext, userId);
  }
}

/** Busca un medicamento por id en todos los tipos de usuario. */
export async function findMedicineById(id: string): Promise<MedItem | undefined> {
  // Buscar en medicamentos de invitados
  const guestMeds = await readMedicinesByOwner("guest");
  const foundInGuest = guestMeds.find(m => m.id === id);
  if (foundInGuest) return foundInGuest;
  
  // Si no se encuentra en invitados, buscar en todos los usuarios autenticados
  // Necesitamos obtener todas las claves de AsyncStorage que empiecen con KEY_USER_PREFIX
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const userKeys = allKeys.filter(key => key.startsWith(KEY_USER_PREFIX));
    
    for (const key of userKeys) {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        try {
          const userMeds = JSON.parse(raw) as MedItem[];
          const found = userMeds.find(m => m.id === id);
          if (found) return found;
        } catch (error) {
          console.error(`Error parsing user medicines from key ${key}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error searching in user medicines:', error);
  }
  
  return undefined;
}

/** Obtiene medicamentos filtrados por tipo de usuario */
export async function getLocalMedicines(owner?: "guest" | "user", userId?: string): Promise<MedItem[]> {
  if (owner) {
    return await readMedicinesByOwner(owner, userId);
  }
  return await readAllMedicines();
}

/** Elimina una hora específica de un medicamento */
export async function removeSpecificTimeFromMedicine(medicationId: string, timeToRemove: string, owner: "guest" | "user", userId?: string): Promise<boolean> {
  try {
    const key = getStorageKey(owner, userId);
    const existing = await readMedicinesByOwner(owner, userId);
    const medicine = existing.find(m => m.id === medicationId);
    
    if (!medicine) {
      console.error('[LocalMedicines] Medicamento no encontrado:', medicationId);
      return false;
    }
    
    // Filtrar la hora específica
    const updatedTimes = medicine.times.filter(time => time !== timeToRemove);
    
    if (updatedTimes.length === 0) {
      // Si no quedan horarios, eliminar el medicamento completo
      const updated = existing.filter(m => m.id !== medicationId);
      await AsyncStorage.setItem(key, JSON.stringify(updated));
      console.log('[LocalMedicines] Medicamento eliminado (sin horarios restantes):', medicationId);
      return true;
    }
    
    // Actualizar el medicamento con los horarios restantes
    const updatedMedicine = { ...medicine, times: updatedTimes };
    const updated = existing.map(m => m.id === medicationId ? updatedMedicine : m);
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    
    console.log('[LocalMedicines] Hora eliminada del medicamento:', medicationId, 'Hora:', timeToRemove, 'Horarios restantes:', updatedTimes.length);
    return true;
  } catch (error) {
    console.error('[LocalMedicines] Error al eliminar hora específica:', error);
    return false;
  }
}
