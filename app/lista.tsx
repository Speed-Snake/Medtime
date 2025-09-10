// app/lista.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { colors } from "../src/theme/colors";
import { getLocalMedicines, removeMedicineLocally, MedItem } from "../src/storage/localMedicines";
import { addHistoryFromMed } from "../src/storage/history";
import { saveHistoryEntryToSupabase } from "../src/storage/supabaseHistory";
import { cancelAllMedicationNotifications } from "../src/notifications/notificationService";
import { useAuth } from "./app";

/** 🎛️ Ajustes rápidos */
const UI = {
  SCREEN_PADDING: 16,
  CARD_RADIUS: 12,
  CARD_GAP: 10,
  DARKEN_PRIMARY: -20,
  EDIT_BTN_COLOR: "#3b82f6",
  DELETE_BTN_COLOR: "#e53935",
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

function fmtHour(iso: string) {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function ListaScreen() {
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const [items, setItems] = useState<MedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const primaryCardBorder = useMemo(() => shade(colors.primary, UI.DARKEN_PRIMARY), []);

  async function load() {
    setLoading(true);
    const list = await getLocalMedicines();
    list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    setItems(list);
    setLoading(false);
  }

  useEffect(() => {
    const unsubscribe = nav.addListener("focus", load);
    load();
    return unsubscribe;
  }, [nav]);

  const onEdit = (m: MedItem) => {
    // 👇 Usa el *name* EXACTO de tu Drawer.Screen (ver app.tsx)
    nav.navigate("Agregar medicamento" as never, { editId: m.id } as never);
  };

  const onDelete = (m: MedItem) => {
    Alert.alert("Eliminar", `¿Estás seguro que deseas eliminar "${m.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            // Cancelar notificaciones del medicamento
            await cancelAllMedicationNotifications(m);
            
            // Guardar en historial local
            await addHistoryFromMed(m, "Cancelado");
            
            // Si el usuario está autenticado, guardar también en Supabase
            if (user?.mode === "user") {
              await saveHistoryEntryToSupabase({
                med_name: m.name,
                dose: m.dose,
                scheduled_times: m.times,
                status: "Cancelado",
                taken_at: new Date().toISOString(),
              });
            }
            
            await removeMedicineLocally(m.id);
            await load();
            
            // Mostrar confirmación de que se guardó en historial
            Alert.alert('Medicamento eliminado', 'Se ha guardado en el historial como "Cancelado" y se cancelaron las notificaciones.');
          } catch (error) {
            console.error('[Lista] Error al eliminar medicamento:', error);
            Alert.alert('Error', 'No se pudo eliminar el medicamento');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: MedItem }) => {
    const horarios = item.times.map(fmtHour).join(" · ");
    return (
      <View style={[s.card, { borderColor: primaryCardBorder }]}>
        <View style={s.cardHeader}>
          <Text style={s.medName}>{item.name}</Text>
          <View style={s.actionsRow}>
            <TouchableOpacity
              style={[s.pillBtn, { backgroundColor: UI.EDIT_BTN_COLOR }]}
              onPress={() => onEdit(item)}
            >
              <AntDesign name="edit" size={16} color="#fff" />
              <Text style={s.pillText}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.pillBtn, { backgroundColor: UI.DELETE_BTN_COLOR }]}
              onPress={() => onDelete(item)}
            >
              <AntDesign name="delete" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={s.subText}>
          Dosis: <Text style={s.bold}>{item.dose}</Text>
        </Text>
        <Text style={s.subText}>
          Horarios: <Text style={s.bold}>{horarios || "—"}</Text>
        </Text>
      </View>
    );
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Lista de medicamentos</Text>

      {loading ? (
        <Text style={{ color: "#666" }}>Cargando…</Text>
      ) : items.length === 0 ? (
        <View style={{ marginTop: 16 }}>
          <Text style={{ color: "#666" }}>Aún no tienes medicamentos guardados.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: UI.CARD_GAP }} />}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: UI.SCREEN_PADDING, backgroundColor: "#f7f8fa" },
  title: { fontSize: 22, fontWeight: "900", color: colors.primaryDark, marginBottom: 10 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderRadius: UI.CARD_RADIUS,
    padding: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  medName: { fontSize: 18, fontWeight: "900", color: "#111827" },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillText: { color: "#fff", fontWeight: "900" },
  subText: { color: "#374151", marginTop: 2 },
  bold: { fontWeight: "700" },
});
