// App.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerItem } from "@react-navigation/drawer";
import * as WebBrowser from "expo-web-browser";
import { View, Alert, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { setAlarmModalCallback } from "../src/alarms/alarmService";
import { addNotificationReceivedListener } from "../src/notifications/notificationService";

import LoginScreen from "../app/login";
import AddMedicine from "../app/index";
import EditMedicine from "../app/editMedicine";
import Lista from "../app/lista";
import Historial from "../app/historial";
import Perfil from "../app/perfil";
import AlarmModal from "../app/alarmModal";
import { supabase } from "../src/lib/supabaseClient";

export const navigationRef = createNavigationContainerRef();

type AuthUser = null | { mode: "guest" } | { mode: "user"; name?: string | null };
type AuthCtx = { user: AuthUser; signInAsGuest: () => void; signOut: () => Promise<void> };

const AuthContext = createContext<AuthCtx | undefined>(undefined);
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

WebBrowser.maybeCompleteAuthSession();

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);
  const [alarmModal, setAlarmModal] = useState<{
    visible: boolean;
    medication: any | null;
  }>({ visible: false, medication: null });

  useEffect(() => {
    // Configurar callback del modal de alarma
    setAlarmModalCallback((medication) => {
      console.log('[App] Activando modal de alarma:', medication);
      setAlarmModal({
        visible: true,
        medication: medication
      });
    });

    // Configurar listener para notificaciones del sistema
    const notificationListener = addNotificationReceivedListener((notification) => {
      console.log('[App] Notificación recibida:', notification);
      
      // Si es una notificación de medicamento, mostrar el modal
      if (notification.request.content.data?.showModal && 
          notification.request.content.data?.medicationId) {
        
        console.log('[App] Mostrando modal de alarma desde notificación');
        setAlarmModal({
          visible: true,
          medication: {
            id: notification.request.content.data.medicationId,
            name: notification.request.content.data.medicationName,
            dose: notification.request.content.data.dose,
            scheduledTime: notification.request.content.data.scheduledTime,
          }
        });
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      if (s) setUser({ mode: "user", name: s.user?.user_metadata?.full_name });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[Auth] onAuthStateChange:", event);
      if (session) {
        setUser({ mode: "user", name: session.user?.user_metadata?.full_name });
        // Solo resetear si hay un navegador activo y no es el estado inicial
        if (navigationRef.isReady() && event !== 'INITIAL_SESSION') {
          setTimeout(() => {
            if (navigationRef.isReady()) {
              navigationRef.reset({ index: 0, routes: [{ name: "Agregar medicamento" as const }] });
            }
          }, 100);
        }
      } else {
        setUser(null);
        // Solo limpiar navegación si no es el estado inicial
        if (navigationRef.isReady() && event !== 'INITIAL_SESSION') {
          setTimeout(() => {
            if (navigationRef.isReady()) {
              navigationRef.reset({ index: 0, routes: [] });
            }
          }, 100);
        }
      }
    });

    return () => {
      sub.subscription.unsubscribe();
      notificationListener.remove();
    };
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      signInAsGuest: () => setUser({ mode: "guest" }),
      signOut: async () => {
        await supabase.auth.signOut();
        setUser(null);
      },
    }),
    [user]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AlarmModal
        visible={alarmModal.visible}
        medication={alarmModal.medication}
        onClose={() => setAlarmModal({ visible: false, medication: null })}
      />
    </AuthContext.Provider>
  );
}

const Drawer = createDrawerNavigator();

/** Drawer personalizado con botón "Cerrar sesión" al final */
function CustomDrawerContent(props: any) {
  const { signOut, user } = useAuth();
  const isGuest = user?.mode === "guest";

  return (
    <DrawerContentScrollView {...props}>
      {/* Mostrar estado del usuario */}
      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: isGuest ? '#ff9800' : '#4caf50' }}>
          {isGuest ? '👤 Modo Invitado' : `✅ ${user?.name || 'Usuario'}`}
        </Text>
        {!isGuest && user?.name && (
          <Text style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
            Usuario Autenticado
          </Text>
        )}
      </View>
      
      <DrawerItemList {...props} />
      <View style={{ height: 8 }} />
      <DrawerItem
        label="Cerrar sesión"
        labelStyle={{ color: '#d32f2f', fontWeight: 'bold' }}
        icon={({ color, size }) => (
          <Ionicons name="log-out-outline" size={size} color="#d32f2f" />
        )}
        onPress={async () => {
          await signOut(); // RootNavigator mostrará Login automáticamente
        }}
      />
    </DrawerContentScrollView>
  );
}

function RootNavigator() {
  const { user } = useAuth();

  if (!user) return <LoginScreen />;

  // Para usuarios invitados, solo mostrar Agregar medicamento y Lista
  const isGuest = user.mode === "guest";

  return (
    <Drawer.Navigator
      initialRouteName="Agregar medicamento"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        drawerActiveTintColor: '#4caf50',
        drawerInactiveTintColor: '#666',
        drawerStyle: {
          backgroundColor: '#fff',
        },
      }}
    >
      <Drawer.Screen 
        name="Agregar medicamento" 
        component={AddMedicine}
        options={{
          drawerIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen 
        name="Editar medicamento" 
        component={EditMedicine}
        options={{
          drawerItemStyle: { display: 'none' }, // Ocultar del sidebar
        }}
      />
      <Drawer.Screen 
        name="Lista" 
        component={Lista}
        options={{
          drawerIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
      {!isGuest && (
        <Drawer.Screen 
          name="Historial" 
          component={Historial}
          options={{
            drawerIcon: ({ color, size }) => (
              <Ionicons name="time-outline" size={size} color={color} />
            ),
          }}
        />
      )}
      {!isGuest && (
        <Drawer.Screen 
          name="Perfil" 
          component={Perfil}
          options={{
            drawerIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />
      )}
    </Drawer.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
