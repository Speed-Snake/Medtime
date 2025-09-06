// app/historial.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
} from "react-native";
import { AntDesign } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

import { colors } from "../src/theme/colors";
import { getHistory, HistoryEntry, historyToCSV } from "../src/storage/history";

/** 🎛️ Ajustes */
const UI = {
  SCREEN_PADDING: 16,
  CARD_RADIUS: 12,
  DARKEN_PRIMARY: -20,
  BADGE_BLUE: "#2563eb",
  BADGE_RED: "#b91c1c",
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

type OrderBy = "fecha" | "az";

export default function HistorialScreen() {
  const [rows, setRows] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderBy, setOrderBy] = useState<OrderBy>("fecha");

  const borderColor = useMemo(() => shade(colors.primary, UI.DARKEN_PRIMARY), []);

  async function load() {
    setLoading(true);
    const list = await getHistory();
    setRows(list);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const ordered = useMemo(() => {
    const copy = [...rows];
    if (orderBy === "fecha") {
      copy.sort((a, b) => (a.at < b.at ? 1 : -1)); // desc
    } else {
      copy.sort((a, b) => a.name.localeCompare(b.name, "es"));
    }
    return copy;
  }, [rows, orderBy]);

  const onDownload = async () => {
    try {
      if (rows.length === 0) {
        Alert.alert("Historial vacío", "No hay datos para exportar.");
        return;
      }
      const csv = historyToCSV(rows);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileUri = FileSystem.documentDirectory! + `historial_medtime_${stamp}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: "Compartir historial" });
      } else {
        Alert.alert("Archivo generado", `Guardado en: ${fileUri}`);
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "No se pudo exportar el historial.");
    }
  };

  const renderItem = ({ item }: { item: HistoryEntry }) => {
    const horarios = item.scheduledTimes.map(fmtHour).join(" · ");
    const badgeBg = item.status === "Tomado" ? UI.BADGE_BLUE : UI.BADGE_RED;

    return (
      <View style={[s.card, { borderColor }]}>
        <View style={s.rowBetween}>
          <Text style={s.medName}>{item.name}</Text>
          <View style={[s.badge, { backgroundColor: badgeBg }]}>
            <Text style={s.badgeText}>{item.status}</Text>
          </View>
        </View>
        <Text style={s.subText}>{new Date(item.at).toLocaleString()}</Text>
        <Text style={s.subText}>Dosis: <Text style={s.bold}>{item.dose}</Text></Text>
        <Text style={s.subText}>Horarios: <Text style={s.bold}>{horarios || "—"}</Text></Text>
      </View>
    );
  };

  return (
    <View style={s.container}>
      <View style={s.headerRow}>
        <TouchableOpacity style={s.downloadBtn} onPress={onDownload}>
          <AntDesign name="download" size={16} color="#fff" />
          <Text style={s.downloadText}>Descargar historial</Text>
        </TouchableOpacity>

        <View style={s.orderWrap}>
          <Text style={s.orderLabel}>Ordenar por:</Text>
          <TouchableOpacity
            style={s.orderBtn}
            onPress={() => setOrderBy((p) => (p === "fecha" ? "az" : "fecha"))}
          >
            <Text style={s.orderBtnText}>{orderBy === "fecha" ? "Fecha" : "A-Z"}</Text>
            <AntDesign name="caretdown" size={12} color="#111" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <Text style={{ color: "#666" }}>Cargando…</Text>
      ) : ordered.length === 0 ? (
        <Text style={{ color: "#666", marginTop: 10 }}>Tu historial está vacío.</Text>
      ) : (
        <FlatList
          data={ordered}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: UI.SCREEN_PADDING, backgroundColor: "#fff" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  downloadBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#111827", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  downloadText: { color: "#fff", fontWeight: "800" },
  orderWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  orderLabel: { color: "#374151" },
  orderBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: "#f3f4f6" },
  orderBtnText: { fontWeight: "800", color: "#111" },

  card: { borderWidth: 1, borderRadius: UI.CARD_RADIUS, padding: 12, backgroundColor: "#fff" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  medName: { fontSize: 18, fontWeight: "900", color: "#111827" },
  subText: { color: "#374151", marginTop: 2 },
  bold: { fontWeight: "700" },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { color: "#fff", fontWeight: "900" },
});
