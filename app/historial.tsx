// app/historial.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
} from "react-native";
import { AntDesign } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useFocusEffect } from "@react-navigation/native";

import { colors } from "../src/theme/colors";
import { getHistory, HistoryEntry, historyToCSV } from "../src/storage/history";
import { loadUserHistoryFromSupabase, supabaseHistoryToCSV, SupabaseHistoryEntry } from "../src/storage/supabaseHistory";
import { loadProfileFromSupabase } from "../src/storage/supabaseProfile";
import { useAuth } from "../src/contexts/AuthContext";
import { shade, fmtHour } from "../src/utils/helpers";

/** 🎛️ Ajustes */
const UI = {
  SCREEN_PADDING: 16,
  CARD_RADIUS: 12,
  DARKEN_PRIMARY: -20,
  BADGE_BLUE: "#2563eb",
  BADGE_RED: "#b91c1c",
};


type OrderBy = "fecha" | "az";

const HistorialScreen = React.memo(function HistorialScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<HistoryEntry[]>([]);
  const [supabaseRows, setSupabaseRows] = useState<SupabaseHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderBy, setOrderBy] = useState<OrderBy>("fecha");
  const [useSupabase, setUseSupabase] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name?: string; age?: number; gender?: string } | null>(null);

  const borderColor = useMemo(() => shade(colors.primary, UI.DARKEN_PRIMARY), []);

  async function load() {
    setLoading(true);
    try {
      // Cargar historial local
      const localHistory = await getHistory();
      setRows(localHistory);

      // Si el usuario está autenticado, cargar de Supabase y priorizarlo
      if (user?.mode === "user") {
        const supabaseHistory = await loadUserHistoryFromSupabase();
        setSupabaseRows(supabaseHistory);
        // Priorizar Supabase si el usuario está autenticado
        setUseSupabase(true);
        
        // Cargar perfil del usuario para incluir en el CSV
        const profile = await loadProfileFromSupabase();
        if (profile) {
          setUserProfile({
            name: profile.name,
            age: profile.age || undefined,
            gender: profile.gender || undefined
          });
        }
      } else {
        // Usuario no autenticado, usar solo datos locales
        setUseSupabase(false);
      }
    } catch (error) {
      console.error('[Historial] Error al cargar:', error);
      Alert.alert('Error', 'No se pudo cargar el historial');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Recargar historial cada vez que la pantalla reciba foco
  useFocusEffect(
    React.useCallback(() => {
      console.log('[Historial] Pantalla enfocada, recargando historial...');
      load();
    }, [])
  );

  const ordered = useMemo(() => {
    const dataToUse = useSupabase ? supabaseRows : rows;
    const copy = [...dataToUse];
    
    if (orderBy === "fecha") {
      copy.sort((a, b) => {
        const dateA = 'taken_at' in a ? a.taken_at : a.at;
        const dateB = 'taken_at' in b ? b.taken_at : b.at;
        return dateA < dateB ? 1 : -1; // desc
      });
    } else {
      copy.sort((a, b) => {
        const nameA = 'med_name' in a ? a.med_name : a.name;
        const nameB = 'med_name' in b ? b.med_name : b.name;
        return nameA.localeCompare(nameB, "es");
      });
    }
    return copy;
  }, [rows, supabaseRows, orderBy, useSupabase]);

  const onDownload = async () => {
    try {
      const dataToUse = useSupabase ? supabaseRows : rows;
      
      if (dataToUse.length === 0) {
        Alert.alert("Historial vacío", "No hay datos para exportar.");
        return;
      }

      // Usar el formato correcto según el tipo de datos
      const csv = useSupabase
        ? supabaseHistoryToCSV(dataToUse as SupabaseHistoryEntry[], userProfile || undefined)
        : historyToCSV(dataToUse as HistoryEntry[], userProfile || undefined);

      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `historial_medtime_${stamp}.csv`;
      
      // Mostrar diálogo para elegir acción
      Alert.alert(
        "📄 Guardar tu archivo",
        `El historial se ha preparado como:\n\n${fileName}\n\n¿Qué deseas hacer?`,
        [
          {
            text: "💾 Guardar archivo",
            onPress: async () => {
              try {
                // Intentar diferentes ubicaciones donde la app tiene permisos
                let fileUri = '';
                let saveLocation = '';
                
                // 1. Intentar carpeta de caché (más accesible)
                try {
                  const cacheDir = FileSystem.cacheDirectory!;
                  fileUri = cacheDir + fileName;
                  await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
                  saveLocation = 'Carpeta de caché (más accesible)';
                  // console.log('Guardado en caché:', fileUri);
                } catch (cacheError) {
                  // console.log('Caché falló, intentando documentos:', cacheError);
                  
                  // 2. Fallback: carpeta de documentos de la app
                  const appDocumentsDir = FileSystem.documentDirectory!;
                  fileUri = appDocumentsDir + fileName;
                  await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
                  saveLocation = 'Documentos de MedTime';
                  // console.log('Guardado en documentos:', fileUri);
                }
                
                // Verificar que se guardó correctamente
                const fileInfo = await FileSystem.getInfoAsync(fileUri);
                if (fileInfo.exists) {
                  // Abrir automáticamente el selector de compartir
                  const canShare = await Sharing.isAvailableAsync();
                  if (canShare) {
                    try {
                      await Sharing.shareAsync(fileUri, { 
                        mimeType: "text/csv", 
                        dialogTitle: "📧 Compartir Historial Médico - MedTime",
                        UTI: "public.comma-separated-values-text"
                      });
                    } catch (shareError) {
                      console.error('Error al compartir:', shareError);
                      Alert.alert(
                        "✅ Archivo guardado",
                        `El archivo se ha guardado en:\n\n📁 ${saveLocation}\n\n${fileName}\n\nPara acceder: Abre un administrador de archivos y busca la carpeta de MedTime.`
                      );
                    }
                  } else {
                    Alert.alert(
                      "✅ Archivo guardado",
                      `El archivo se ha guardado en:\n\n📁 ${saveLocation}\n\n${fileName}\n\nPara acceder: Abre un administrador de archivos y busca la carpeta de MedTime.`
                    );
                  }
                } else {
                  throw new Error('No se pudo crear el archivo');
                }
              } catch (error) {
                console.error('Error al guardar:', error);
                Alert.alert(
                  "❌ Error al guardar",
                  "No se pudo crear el archivo. Verifica que tengas espacio suficiente en el dispositivo.",
                  [
                    { text: "OK" },
                    { 
                      text: "Intentar de nuevo", 
                      onPress: () => onDownload()
                    }
                  ]
                );
              }
            }
          },
          {
            text: "❌ Cancelar",
            style: "cancel"
          }
        ]
      );
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "No se pudo exportar el historial.");
    }
  };

  const renderItem = ({ item }: { item: HistoryEntry | SupabaseHistoryEntry }) => {
    // Determinar si es un item de Supabase o local
    const isSupabaseItem = 'med_name' in item;
    
    const medName = isSupabaseItem ? (item as SupabaseHistoryEntry).med_name : (item as HistoryEntry).name;
    const dose = item.dose;
    const status = item.status;
    const scheduledTimes = isSupabaseItem ? (item as SupabaseHistoryEntry).scheduled_times : (item as HistoryEntry).scheduledTimes;
    const dateField = isSupabaseItem ? (item as SupabaseHistoryEntry).taken_at : (item as HistoryEntry).at;
    
    // Convertir scheduled_times a array si es string (Supabase) o mantener como array (local)
    const timesArray = Array.isArray(scheduledTimes) ? scheduledTimes : [scheduledTimes];
    const horarios = timesArray.map(fmtHour).join(" · ");
    
    // Formatear fechas seleccionadas si existen (ordenadas de menor a mayor)
    const selectedDates = isSupabaseItem ? (item as SupabaseHistoryEntry).selected_dates : (item as HistoryEntry).selectedDates;
    const fechasFormateadas = selectedDates?.sort((a: string, b: string) => new Date(a).getTime() - new Date(b).getTime())
      .map((dateString: string) => {
        const date = new Date(dateString);
        const dayName = date.toLocaleDateString('es-ES', { weekday: 'short' });
        const dayNumber = date.getDate();
        const monthName = date.toLocaleDateString('es-ES', { month: 'short' });
        return `${dayName} ${dayNumber} ${monthName}`;
      })
      .join(" · ") || "—";
    
    const badgeBg = status === "Tomado" ? UI.BADGE_BLUE : UI.BADGE_RED;

    return (
      <View style={[s.card, { borderColor }]}>
        <View style={s.rowBetween}>
          <Text style={s.medName}>{medName}</Text>
          <View style={[s.badge, { backgroundColor: badgeBg }]}>
            <Text style={s.badgeText}>{status}</Text>
          </View>
        </View>
        <Text style={s.subText}>{new Date(dateField).toLocaleString()}</Text>
        <Text style={s.subText}>Dosis: <Text style={s.bold}>{dose}</Text></Text>
        <Text style={s.subText}>Fechas: <Text style={s.bold}>{fechasFormateadas}</Text></Text>
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
          keyExtractor={(r) => r.id || `item-${Math.random()}`}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
        />
      )}
    </View>
  );
});

export default HistorialScreen;

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
