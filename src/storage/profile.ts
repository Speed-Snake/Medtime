// src/storage/profile.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Gender = "Femenino" | "Masculino" | "No especificar";
export type UserProfile = {
  name: string;
  age: number | null;
  gender: Gender;
  avatarUri?: string | null; // local file URI
};

const KEY = "medtime:user_profile";

export async function saveProfile(p: UserProfile) {
  await AsyncStorage.setItem(KEY, JSON.stringify(p));
}

export async function loadProfile(): Promise<UserProfile | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearProfile() {
  await AsyncStorage.removeItem(KEY);
}
