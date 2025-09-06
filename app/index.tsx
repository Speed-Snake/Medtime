// app/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { useNavigation, useRoute } from "@react-navigation/native";

import { colors } from "../src/theme/colors";
import {
  saveMedicineLocally,
  MedDose,
  MedItem,
  findMedicineById,
} from "../src/storage/localMedicines";
import { useAuth } from "../App";

/** 🎛️ KNOBS */
const UI = {
  BUTTONS_CENTERED: true,
  BUTTONS_MAX_WIDTH: 340,
  BUTTONS_SHIFT_Y: -6,
  BUTTONS_GAP: 12,
  DARKEN_PRIMARY: -20,
  DARKEN_SECONDARY: -20,
};

function shade(hex: string, percent: number) {
  const p = Math.max(-100, Math.min(100, percent)) / 100;
  const n = (v: number) => {
    const out = Math.round(p < 0 ? v * (1 + p) : v + (255 - v) * p);
    return Math.max(0, Math.min(255, out));
  };
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  const rr = n(r).toString(16).padStart(2, "0");
  const gg = n(g).toString(16).padStart(2, "0");
  const bb = n(b).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`;
}

/* ---------- Catálogo local (sencillo) ---------- */
const CATALOG: Record<string, { doses: MedDose[] }> = {
  Paracetamol: { doses: ["1 g", "500 mg"] },
  Ibuprofeno: { doses: ["400 mg", "600 mg"] },
  Aspirina: { doses: ["100 mg", "500 mg"] },
  Omeprazol: { doses: ["20 mg"] },
  Amoxicilina: { doses: ["500 mg", "875 mg"] },
};
const CATALOG_NAMES = Object.keys(CATALOG);

/* ---------- Helpers ---------- */
function validateFutureToday(timeOnly: Date) {
  const now = new Date();
  const candidate = new Date();
  candidate.setHours(timeOnly.getHours(), timeOnly.getMinutes(), 0, 0);
  return candidate.getTime() > now.getTime();
}
function combineToday(timeOnly: Date) {
  const d = new Date();
  d.setHours(timeOnly.getHours(), timeOnly.getMinutes(), 0, 0);
  return d;
}

export default function AddOrEditMedicineScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();                // ← recibimos { editId? }
  const editId: string | undefined = route.params?.editId;

  const { user } = useAuth();

  const [editingItem, setEditingItem] = useState<MedItem | null>(null);
  const [query, setQuery] = useState("");
  const [selectedMed, setSelectedMed] = useState<string | null>(null);
  const [selectedDose, setSelectedDose] = useState<MedDose | null>(null);

  // Solo guardamos "horas del día" en este estado (Date con hora/min, fecha no importa)
  const [times, setTimes] = useState<Date[]>([]);
  const [timePickerVisible, setTimePickerVisible] = useState(false);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return CATALOG_NAMES.filter((n) => n.toLowerCase().includes(q));
  }, [query]);

  const doseOptions = selectedMed ? CATALOG[selectedMed]?.doses ?? [] : [];

  // --- MODO EDICIÓN: precargar datos ---
  useEffect(() => {
    (async () => {
      if (!editId) return;
      const item = await findMedicineById(editId);
      if (!item) {
        Alert.alert("No encontrado", "El medicamento a editar no existe.");
        return;
      }
      setEditingItem(item);
      setSelectedMed(item.name);
      setQuery(item.name);
      setSelectedDose(item.dose);

      // convertimos sus ISO a "horas del día" para la UI
      const t = item.times.map((iso) => {
        const d = new Date(iso);
        const only = new Date();
        only.setHours(d.getHours(), d.getMinutes(), 0, 0);
        return only;
      });
      setTimes(t);
    })();
  }, [editId]);

  // --- Añadir hora (solo si es futura hoy) ---
  const onPickTime = (_: DateTimePickerEvent, d?: Date) => {
    setTimePickerVisible(false);
    if (!d) return;

    if (!validateFutureToday(d)) {
      Alert.alert("Hora inválida", "Elige una hora futura (hoy).");
      return;
    }

    setTimes((prev) => {
      const exists = prev.some(
        (x) => x.getHours() === d.getHours() && x.getMinutes() === d.getMinutes()
      );
      if (exists) return prev; // evitar duplicados
      const next = [...prev, d].sort(
        (a, b) => a.getHours() * 60 + a.getMinutes() - (b.getHours() * 60 + b.getMinutes())
      );
      return next;
    });
  };

  const removeTime = (idx: number) =>
    setTimes((prev) => prev.filter((_, i) => i !== idx));

  const onSelectSuggestion = (name: string) => {
    setSelectedMed(name);
    setQuery(name);
    setSelectedDose(null);
  };

  const isEditing = !!editingItem;

  const onSave = async () => {
    try {
      if (!selectedMed) return Alert.alert("Falta el medicamento", "Selecciona un medicamento del listado.");
      if (!selectedDose) return Alert.alert("Falta la dosis", "Selecciona una dosis disponible.");
      if (times.length === 0) return Alert.alert("Horarios", "Agrega al menos un horario.");

      // seguridad extra: todas deben ser futuras hoy
      const allFuture = times.every(validateFutureToday);
      if (!allFuture) {
        Alert.alert("Horarios en el pasado", "Asegúrate de que todas las horas sean futuras (para hoy).");
        return;
      }

      const combined = times.map(combineToday).map((d) => d.toISOString());

      const item: MedItem = {
        id: editingItem?.id ?? `${Date.now()}`,
        name: selectedMed,
        dose: selectedDose,
        times: combined,
        owner: editingItem?.owner ?? (user?.mode === "guest" ? "guest" : "user"),
        createdAt: editingItem?.createdAt ?? new Date().toISOString(),
      };

      await saveMedicineLocally(item);
      Alert.alert(isEditing ? "Actualizado" : "Guardado", "Medicamento guardado correctamente.");

      // Si quieres volver a la lista al guardar:
      // nav.navigate("Lista");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "No se pudo guardar el medicamento.");
    }
  };

  const primaryDarker = shade(colors.primary, UI.DARKEN_PRIMARY);
  const secondaryDarker = shade(colors.secondary, UI.DARKEN_SECONDARY);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.container}>
        <Text style={s.title}>{isEditing ? "Editar medicamento" : "Agregar medicamento"}</Text>

        {/* Medicamento */}
        <Text style={s.label}>Medicamento</Text>
        <TextInput
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setSelectedMed(null);
            setSelectedDose(null);
          }}
          placeholder="Escribe el nombre (ej: para… → Paracetamol)"
          style={s.input}
        />

        {/* Sugerencias */}
        {selectedMed === null && suggestions.length > 0 && (
          <FlatList
            data={suggestions}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(x) => x}
            style={s.suggestions}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => onSelectSuggestion(item)} style={s.suggestionItem}>
                <Text style={s.suggestionText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        )}

        {/* Dosis */}
        <Text style={[s.label, { marginTop: 16 }]}>Dosis</Text>
        <View style={s.pickerBox}>
          <Picker
            enabled={!!selectedMed}
            selectedValue={selectedDose ?? undefined}
            onValueChange={(v: MedDose | undefined) => setSelectedDose(v ?? null)}
            dropdownIconColor={colors.primaryDark}
          >
            <Picker.Item label={selectedMed ? "Selecciona una dosis…" : "Selecciona primero un medicamento"} value={undefined} />
            {doseOptions.map((d) => (
              <Picker.Item key={d} label={d} value={d} />
            ))}
          </Picker>
        </View>

        {/* Horarios (solo futuros hoy) */}
        <Text style={[s.label, { marginTop: 16 }]}>Horarios</Text>
        <View style={s.row}>
          <TouchableOpacity style={[s.chipBtn, { backgroundColor: primaryDarker }]} onPress={() => setTimePickerVisible(true)}>
            <Text style={s.chipBtnText}>+ Agregar hora</Text>
          </TouchableOpacity>
        </View>

        {times.length > 0 && (
          <View style={s.chipsWrap}>
            {times.map((d, idx) => {
              const hh = d.getHours().toString().padStart(2, "0");
              const mm = d.getMinutes().toString().padStart(2, "0");
              return (
                <View key={`${d.getHours()}-${d.getMinutes()}-${idx}`} style={s.chip}>
                  <Text style={s.chipText}>{hh}:{mm}</Text>
                  <TouchableOpacity onPress={() => removeTime(idx)} style={s.chipDel}>
                    <Text style={s.chipDelText}>—</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {timePickerVisible && (
          <DateTimePicker
            value={new Date()}    // por defecto ahora
            mode="time"
            is24Hour
            onChange={onPickTime}
          />
        )}

        {/* Botones */}
        <View
          style={[
            s.actions,
            {
              gap: UI.BUTTONS_GAP,
              transform: [{ translateY: UI.BUTTONS_SHIFT_Y }],
              alignSelf: UI.BUTTONS_CENTERED ? "center" : "stretch",
              width: "100%",
              maxWidth: UI.BUTTONS_CENTERED ? UI.BUTTONS_MAX_WIDTH : undefined,
            },
          ]}
        >
          <TouchableOpacity style={[s.btn, { backgroundColor: primaryDarker }]} onPress={onSave}>
            <Text style={s.btnText}>{isEditing ? "Actualizar medicamento" : "Guardar medicamento"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.btn, { backgroundColor: secondaryDarker }]} onPress={() => nav.navigate("Lista")}>
            <Text style={s.btnText}>Ver mi lista</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "800", color: colors.primaryDark, marginBottom: 10, textAlign: "center" },
  label: { fontSize: 14, color: "#555", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#e4e6eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  suggestions: {
    maxHeight: 140,
    borderWidth: 1,
    borderColor: "#e4e6eb",
    borderRadius: 10,
    marginTop: 6,
  },
  suggestionItem: { paddingHorizontal: 12, paddingVertical: 10 },
  suggestionText: { color: "#333" },

  pickerBox: {
    borderWidth: 1,
    borderColor: "#e4e6eb",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#fff",
  },

  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  chipBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999 },
  chipBtnText: { color: "#fff", fontWeight: "700" },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f2f6ff",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e4e6eb",
    gap: 6,
  },
  chipText: { color: colors.primaryDark, fontWeight: "700" },
  chipDel: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  chipDelText: { color: "#444", fontWeight: "900" },

  actions: { marginTop: 16, alignSelf: "stretch" },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "800" },
});
