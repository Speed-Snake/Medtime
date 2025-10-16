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
  ScrollView,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { Calendar } from "react-native-calendars";
import { useNavigation, useRoute } from "@react-navigation/native";

import { colors } from "../src/theme/colors";
import {
  saveMedicineLocally,
  MedDose,
  MedItem,
  findMedicineById,
} from "../src/storage/localMedicines";
import { loadMedicationsCatalog, initializeMedicationsCatalog, searchMedications, SupabaseMedication } from "../src/storage/supabaseMedications";
import { scheduleMedicationNotificationWithAlarmForDates } from "../src/notifications/notificationService";
import { cancelAllAlarmsForMedication } from "../src/alarms/alarmService";
import { useAuth } from "../src/contexts/AuthContext";
import { shade, combineNextOccurrence } from "../src/utils/helpers";

/** 🎛️ KNOBS */
const UI = {
  BUTTONS_CENTERED: true,
  BUTTONS_MAX_WIDTH: 340,
  BUTTONS_SHIFT_Y: -6,
  BUTTONS_GAP: 12,
  DARKEN_PRIMARY: -20,
  DARKEN_SECONDARY: -20,
};

/* ---------- Catálogo de Supabase ---------- */

export default function AddMedicineScreen() {
  const nav = useNavigation<any>();
  const { user } = useAuth();

  const [query, setQuery] = useState("");
  const [selectedMed, setSelectedMed] = useState<string | null>(null);
  const [selectedDose, setSelectedDose] = useState<MedDose | null>(null);
  
  // Estados para fechas seleccionadas
  const [selectedDates, setSelectedDates] = useState<{[key: string]: any}>({});
  const [showCalendar, setShowCalendar] = useState(false);

  // Solo guardamos "horas del día" en este estado (Date con hora/min, fecha no importa)
  const [times, setTimes] = useState<Date[]>([]);
  const [timePickerVisible, setTimePickerVisible] = useState(false);

  // Estados para el catálogo de Supabase
  const [catalog, setCatalog] = useState<SupabaseMedication[]>([]);
  const [suggestions, setSuggestions] = useState<SupabaseMedication[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const doseOptions = selectedMed ? 
    catalog.find(med => med.name === selectedMed)?.doses ?? [] : [];

  // --- Cargar catálogo de medicamentos ---
  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const catalogData = await loadMedicationsCatalog();
      setCatalog(catalogData);
      
      // Si no hay medicamentos, inicializar con los básicos
      if (catalogData.length === 0) {
        await initializeMedicationsCatalog();
        const newCatalog = await loadMedicationsCatalog();
        setCatalog(newCatalog);
      }
    } catch (error) {
      console.error('[AddMedicine] Error al cargar catálogo:', error);
      Alert.alert(
        'Error de Conexión', 
        'No se pudo cargar el catálogo de medicamentos. Verifica tu conexión a internet.',
        [
          { text: 'Reintentar', onPress: loadCatalog },
          { text: 'Continuar', style: 'cancel' }
        ]
      );
    } finally {
      setLoadingCatalog(false);
    }
  };

  // --- Buscar medicamentos ---
  useEffect(() => {
    const searchMedicines = async () => {
      if (!query.trim()) {
        setSuggestions([]);
        return;
      }

      try {
        const results = await searchMedications(query);
        setSuggestions(results);
      } catch (error) {
        console.error('[AddMedicine] Error al buscar medicamentos:', error);
        setSuggestions([]);
      }
    };

    const timeoutId = setTimeout(searchMedicines, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [query]);

  // --- Añadir hora (solo si es futura hoy) ---
  const onPickTime = (_: DateTimePickerEvent, d?: Date) => {
    setTimePickerVisible(false);
    if (!d) return;

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

  // --- Manejar selección de fechas ---
  const onDayPress = (day: any) => {
    const dateString = day.dateString;
    setSelectedDates(prev => {
      const newDates = { ...prev };
      if (newDates[dateString]) {
        delete newDates[dateString];
      } else {
        newDates[dateString] = {
          selected: true,
          selectedColor: colors.primary,
          selectedTextColor: '#fff'
        };
      }
      return newDates;
    });
  };

  const removeDate = (dateString: string) => {
    setSelectedDates(prev => {
      const newDates = { ...prev };
      delete newDates[dateString];
      return newDates;
    });
  };

  const onSelectSuggestion = (medication: SupabaseMedication) => {
    setSelectedMed(medication.name);
    setQuery(medication.name);
    setSelectedDose(null);
  };

  const onSave = async () => {
    try {
      // Validaciones de entrada
      if (!selectedMed) {
        Alert.alert("Error de Validación", "Selecciona un medicamento del listado.");
        return;
      }
      if (!selectedDose) {
        Alert.alert("Error de Validación", "Selecciona una dosis disponible.");
        return;
      }
      if (Object.keys(selectedDates).length === 0) {
        Alert.alert("Error de Validación", "Selecciona al menos una fecha.");
        return;
      }
      if (times.length === 0) {
        Alert.alert("Error de Validación", "Agrega al menos un horario.");
        return;
      }

      // Validar que no haya horarios duplicados
      const uniqueTimes = new Set(times.map(t => `${t.getHours()}:${t.getMinutes()}`));
      if (uniqueTimes.size !== times.length) {
        Alert.alert("Error de Validación", "No puedes tener horarios duplicados.");
        return;
      }

      // Convertir a próxima ocurrencia (hoy o mañana)
      const combined = times.map(combineNextOccurrence).map((d) => d.toISOString());

      const item: MedItem = {
        id: `${Date.now()}`,
        name: selectedMed,
        dose: selectedDose,
        times: combined,
        selectedDates: Object.keys(selectedDates),
        owner: user?.mode === "guest" ? "guest" : "user",
        createdAt: new Date().toISOString(),
      };

      const userId = user?.mode === "user" ? user.name || undefined : undefined;
      await saveMedicineLocally(item, userId);

      // Programar notificaciones para el medicamento
      let totalNotifications = 0;
      let notificationErrors = 0;
      
      for (const scheduledTime of item.times) {
        try {
          console.log(`[AddMedicine] Programando notificaciones para ${item.name} a las ${scheduledTime}`);
          const notificationIds = await scheduleMedicationNotificationWithAlarmForDates(item, scheduledTime);
          if (notificationIds.length > 0) {
            totalNotifications += notificationIds.length;
            console.log(`[AddMedicine] ✅ ${notificationIds.length} notificaciones programadas:`, notificationIds);
          }
        } catch (notificationError) {
          console.error('[AddMedicine] Error al programar notificaciones:', notificationError);
          notificationErrors++;
        }
      }
      
      if (totalNotifications > 0 && notificationErrors === 0) {
        // Limpiar formulario
        setQuery("");
        setSelectedMed(null);
        setSelectedDose(null);
        setTimes([]);
        setSelectedDates({});
        
        Alert.alert(
          "✅ Guardado", 
          `Medicamento guardado correctamente.\n\nSe programaron ${totalNotifications} notificaciones para las fechas seleccionadas.`,
          [{ text: 'OK', onPress: () => nav.navigate("Lista") }]
        );
      } else if (totalNotifications > 0 && notificationErrors > 0) {
        // Limpiar formulario
        setQuery("");
        setSelectedMed(null);
        setSelectedDose(null);
        setTimes([]);
        setSelectedDates({});
        
        Alert.alert(
          "⚠️ Guardado con Advertencias", 
          `Medicamento guardado correctamente.\n\nSe programaron ${totalNotifications} notificaciones para las fechas seleccionadas.\n\n${notificationErrors} horarios no se pudieron programar.`,
          [{ text: 'OK', onPress: () => nav.navigate("Lista") }]
        );
      } else {
        // Limpiar formulario
        setQuery("");
        setSelectedMed(null);
        setSelectedDose(null);
        setTimes([]);
        setSelectedDates({});
        
        Alert.alert(
          "⚠️ Guardado sin Notificaciones", 
          "Medicamento guardado correctamente.\n\nNo se pudieron programar notificaciones. Revisa la configuración de alarmas en tu perfil.",
          [{ text: 'OK', onPress: () => nav.navigate("Lista") }]
        );
      }
    } catch (error) {
      console.error('[AddMedicine] Error al guardar:', error);
      
      // Limpiar formulario incluso en caso de error
      setQuery("");
      setSelectedMed(null);
      setSelectedDose(null);
      setTimes([]);
      
      Alert.alert(
        "❌ Error de Guardado", 
        "No se pudo guardar el medicamento. Verifica tu conexión e intenta de nuevo.",
        [
          { text: 'Reintentar', onPress: onSave },
          { text: 'Cancelar', style: 'cancel' }
        ]
      );
    }
  };

  const primaryDarker = shade(colors.primary, UI.DARKEN_PRIMARY);
  const secondaryDarker = shade(colors.secondary, UI.DARKEN_SECONDARY);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={s.container} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        <Text style={s.title}>Agregar medicamento</Text>

        {/* 1. Medicamento */}
        <Text style={s.label}>1. Medicamento</Text>
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
          <View style={s.suggestions}>
            {suggestions.map((item) => (
              <TouchableOpacity 
                key={item.id}
                onPress={() => onSelectSuggestion(item)} 
                style={s.suggestionItem}
              >
                <Text style={s.suggestionText}>{item.name}</Text>
                <Text style={s.suggestionDoses}>
                  {item.doses.join(', ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loadingCatalog && (
          <Text style={s.loadingText}>Cargando catálogo de medicamentos...</Text>
        )}

        {/* 2. Dosis */}
        <Text style={[s.label, { marginTop: 16 }]}>2. Dosis</Text>
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

        {/* 3. Fechas */}
        <Text style={[s.label, { marginTop: 16 }]}>3. Fechas</Text>
        <TouchableOpacity 
          style={[s.dateButton, { backgroundColor: primaryDarker }]} 
          onPress={() => setShowCalendar(!showCalendar)}
        >
          <Text style={s.dateButtonText}>
            {Object.keys(selectedDates).length > 0 
              ? `${Object.keys(selectedDates).length} fecha(s) seleccionada(s)` 
              : "Seleccionar fechas"
            }
          </Text>
        </TouchableOpacity>

        {showCalendar && (
          <View style={s.calendarContainer}>
            <Calendar
              onDayPress={onDayPress}
              markedDates={selectedDates}
              theme={{
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: '#fff',
                todayTextColor: colors.primary,
                dayTextColor: '#2d4150',
                textDisabledColor: '#d9e1e8',
                dotColor: colors.primary,
                selectedDotColor: '#fff',
                arrowColor: colors.primary,
                monthTextColor: colors.primary,
                indicatorColor: colors.primary,
                textDayFontWeight: '300',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: '300'
              }}
            />
          </View>
        )}

        {/* Fechas seleccionadas */}
        {Object.keys(selectedDates).length > 0 && (
          <View style={s.selectedDatesContainer}>
            <Text style={s.selectedDatesLabel}>Fechas seleccionadas:</Text>
            <View style={s.selectedDatesWrap}>
              {Object.keys(selectedDates)
                .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                .map((dateString) => {
                const date = new Date(dateString);
                const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' });
                const dayNumber = date.getDate();
                const monthName = date.toLocaleDateString('es-ES', { month: 'long' });
                return (
                  <View key={dateString} style={s.dateChip}>
                    <Text style={s.dateChipText}>
                      {dayName} {dayNumber} de {monthName}
                    </Text>
                    <TouchableOpacity onPress={() => removeDate(dateString)} style={s.dateChipDel}>
                      <Text style={s.dateChipDelText}>×</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 4. Horarios */}
        <Text style={[s.label, { marginTop: 16 }]}>4. Horarios</Text>
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
            <Text style={s.btnText}>Guardar medicamento</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.btn, { backgroundColor: secondaryDarker }]} onPress={() => nav.navigate("Lista")}>
            <Text style={s.btnText}>Ver mi lista</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContent: { padding: 16, paddingBottom: 100 },
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
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#e4e6eb",
    borderRadius: 10,
    marginTop: 6,
    backgroundColor: "#fff",
    zIndex: 1000,
  },
  suggestionItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  suggestionText: { color: "#333", fontSize: 16, fontWeight: "600" },
  suggestionDoses: { color: "#666", fontSize: 14, marginTop: 2 },
  loadingText: { textAlign: "center", color: "#666", fontStyle: "italic", marginTop: 8 },

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

  // Estilos para el calendario
  dateButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  dateButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  calendarContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e4e6eb",
  },
  selectedDatesContainer: {
    marginBottom: 10,
  },
  selectedDatesLabel: {
    fontSize: 14,
    color: "#555",
    marginBottom: 8,
    fontWeight: "600",
  },
  selectedDatesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f2f6ff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e4e6eb",
    gap: 8,
  },
  dateChipText: {
    color: colors.primaryDark,
    fontWeight: "600",
    fontSize: 14,
  },
  dateChipDel: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  dateChipDelText: {
    color: "#444",
    fontWeight: "900",
    fontSize: 16,
  },
});
