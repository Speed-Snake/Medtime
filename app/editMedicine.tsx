// app/editMedicine.tsx
import React, { useEffect, useState } from "react";
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
import { loadMedicationsCatalog, searchMedications, SupabaseMedication } from "../src/storage/supabaseMedications";
import { scheduleMedicationNotificationWithAlarmForDates } from "../src/notifications/notificationService";
import { cancelAllAlarmsForMedication } from "../src/alarms/alarmService";
import { useAuth } from "../src/contexts/AuthContext";
import { combineNextOccurrence } from "../src/utils/helpers";

/** 🎛️ KNOBS */
const UI = {
  BUTTONS_CENTERED: true,
  BUTTONS_MAX_WIDTH: 340,
  BUTTONS_SHIFT_Y: -6,
  BUTTONS_GAP: 12,
  DARKEN_PRIMARY: -20,
  DARKEN_SECONDARY: -20,
};

export default function EditMedicineScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const editId: string = route.params?.editId;

  const { user } = useAuth();

  const [editingItem, setEditingItem] = useState<MedItem | null>(null);
  const [query, setQuery] = useState("");
  const [selectedMed, setSelectedMed] = useState<string | null>(null);
  const [selectedDose, setSelectedDose] = useState<MedDose | null>(null);
  
  // Estados para fechas seleccionadas
  const [selectedDates, setSelectedDates] = useState<{[key: string]: any}>({});
  const [showCalendar, setShowCalendar] = useState(false);
  
  const [times, setTimes] = useState<Date[]>([]);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [loading, setLoading] = useState(true);

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
    } catch (error) {
      console.error('[EditMedicine] Error al cargar catálogo:', error);
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
        console.error('[EditMedicine] Error al buscar medicamentos:', error);
        setSuggestions([]);
      }
    };

    const timeoutId = setTimeout(searchMedicines, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [query]);

  // --- Cargar datos del medicamento a editar ---
  useEffect(() => {
    const loadMedicineData = async () => {
      if (!editId) {
        Alert.alert("Error", "No se especificó el medicamento a editar.");
        nav.goBack();
        return;
      }

      setLoading(true);
      try {
        const item = await findMedicineById(editId);
        if (!item) {
          Alert.alert(
            "Medicamento no encontrado", 
            "El medicamento que intentas editar ya no existe o fue eliminado.",
            [{ text: 'OK', onPress: () => nav.goBack() }]
          );
          return;
        }

        setEditingItem(item);
        setSelectedMed(item.name);
        setQuery(item.name);
        setSelectedDose(item.dose);

        // Cargar fechas seleccionadas si existen
        if (item.selectedDates && item.selectedDates.length > 0) {
          const datesObj: {[key: string]: any} = {};
          item.selectedDates.forEach(dateString => {
            datesObj[dateString] = {
              selected: true,
              selectedColor: colors.primary,
              selectedTextColor: '#fff'
            };
          });
          setSelectedDates(datesObj);
        }

        // Convertir sus ISO a "horas del día" para la UI
        const t = item.times.map((iso) => {
          const d = new Date(iso);
          const only = new Date();
          only.setHours(d.getHours(), d.getMinutes(), 0, 0);
          return only;
        });
        setTimes(t);
      } catch (error) {
        console.error('[EditMedicine] Error al cargar medicamento:', error);
        Alert.alert(
          'Error de Carga', 
          'No se pudo cargar el medicamento. Verifica tu conexión e intenta de nuevo.',
          [
            { text: 'Reintentar', onPress: loadMedicineData },
            { text: 'Volver', onPress: () => nav.goBack() }
          ]
        );
      } finally {
        setLoading(false);
      }
    };

    loadMedicineData();
  }, [editId, nav]);

  // --- Añadir hora ---
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
        id: editingItem?.id ?? `${Date.now()}`,
        name: selectedMed,
        dose: selectedDose,
        times: combined,
        selectedDates: Object.keys(selectedDates),
        owner: editingItem?.owner ?? (user?.mode === "guest" ? "guest" : "user"),
        createdAt: editingItem?.createdAt ?? new Date().toISOString(),
      };

      // Cancelar notificaciones anteriores
      if (editingItem) {
        try {
          await cancelAllAlarmsForMedication(editingItem.id);
        } catch (alarmError) {
          console.warn('[EditMedicine] Error al cancelar alarmas anteriores:', alarmError);
          // No bloquear el proceso por este error
        }
      }

      const userId = user?.mode === "user" ? user.name || undefined : undefined;
      await saveMedicineLocally(item, userId);

      // Programar notificaciones para el medicamento
      let totalNotifications = 0;
      let notificationErrors = 0;
      
      for (const scheduledTime of item.times) {
        try {
          const notificationIds = await scheduleMedicationNotificationWithAlarmForDates(item, scheduledTime);
          if (notificationIds.length > 0) {
            totalNotifications += notificationIds.length;
          }
        } catch (notificationError) {
          console.error('[EditMedicine] Error al programar notificaciones:', notificationError);
          notificationErrors++;
        }
      }
      
      if (totalNotifications > 0 && notificationErrors === 0) {
        Alert.alert(
          "✅ Actualizado", 
          `Medicamento actualizado correctamente.\n\nSe programaron ${totalNotifications} notificaciones.`,
          [{ text: 'OK', onPress: () => nav.navigate("Lista") }]
        );
      } else if (totalNotifications > 0 && notificationErrors > 0) {
        Alert.alert(
          "⚠️ Actualizado con Advertencias", 
          `Medicamento actualizado correctamente.\n\nSe programaron ${totalNotifications} de ${item.times.length} notificaciones.\n\n${notificationErrors} notificaciones no se pudieron programar.`,
          [{ text: 'OK', onPress: () => nav.navigate("Lista") }]
        );
      } else {
        Alert.alert(
          "⚠️ Actualizado sin Notificaciones", 
          "Medicamento actualizado correctamente.\n\nNo se pudieron programar notificaciones. Revisa la configuración de alarmas en tu perfil.",
          [{ text: 'OK', onPress: () => nav.navigate("Lista") }]
        );
      }
    } catch (error) {
      console.error('[EditMedicine] Error al guardar:', error);
      Alert.alert(
        "❌ Error de Guardado", 
        "No se pudo actualizar el medicamento. Verifica tu conexión e intenta de nuevo.",
        [
          { text: 'Reintentar', onPress: onSave },
          { text: 'Cancelar', style: 'cancel' }
        ]
      );
    }
  };

  const onCancel = () => {
    Alert.alert(
      "Cancelar edición",
      "¿Estás seguro de que quieres cancelar? Se perderán los cambios no guardados.",
      [
        { text: "No", style: "cancel" },
        { text: "Sí", onPress: () => nav.goBack() }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[s.container, s.centerContent]}>
        <Text style={s.loadingText}>Cargando medicamento...</Text>
      </View>
    );
  }

  const primaryDarker = colors.primaryDark;
  const secondaryDarker = colors.secondary;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={s.container} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        <Text style={s.title}>Editar medicamento</Text>

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

        {/* Fechas */}
        <Text style={[s.label, { marginTop: 16 }]}>Fechas</Text>
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

        {/* Horarios */}
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
            value={new Date()}
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
            <Text style={s.btnText}>Actualizar medicamento</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.btn, { backgroundColor: secondaryDarker }]} onPress={onCancel}>
            <Text style={s.btnText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.btn, { backgroundColor: "#9ca3af" }]} onPress={() => nav.navigate("Lista")}>
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
  centerContent: { justifyContent: 'center', alignItems: 'center' },
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
    height: 50,
    justifyContent: "center",
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
