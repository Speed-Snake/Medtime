// App.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerItem } from "@react-navigation/drawer";
import * as WebBrowser from "expo-web-browser";
import { View, Alert } from "react-native";
import { requestNotificationPermissions, addNotificationReceivedListener } from "../src/notifications/notificationService";

import LoginScreen from "../app/login";
import AddOrEdit from "../app/index";
import Lista from "../app/lista";
import Historial from "../app/historial";
import Perfil from "../app/perfil";
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

  useEffect(() => {
    // Configurar notificaciones al iniciar la app
    const setupNotifications = async () => {
      const hasPermission = await requestNotificationPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Notificaciones',
          'Para recibir recordatorios de medicamentos, por favor activa las notificaciones en la configuración de la app.',
          [{ text: 'Entendido' }]
        );
      }
    };

    setupNotifications();

    // Configurar listener para notificaciones recibidas
    const notificationListener = addNotificationReceivedListener((notification) => {
      console.log('[App] Notificación recibida:', notification);
      Alert.alert(
        notification.request.content.title || 'Notificación',
        notification.request.content.body || 'Nueva notificación',
        [{ text: 'OK' }]
      );
    });

    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      if (s) setUser({ mode: "user", name: s.user?.user_metadata?.full_name });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[Auth] onAuthStateChange:", event);
      if (session) {
        setUser({ mode: "user", name: session.user?.user_metadata?.full_name });
        // Opcional: resetear al agregar medicamento
        if (navigationRef.isReady()) {
          navigationRef.reset({ index: 0, routes: [{ name: "Agregar medicamento" as const }] });
        }
      } else {
        setUser(null);
        // Opcional: limpiar navegación para que no vuelva atrás
        if (navigationRef.isReady()) navigationRef.reset({ index: 0, routes: [] });
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const Drawer = createDrawerNavigator();

/** Drawer personalizado con botón "Cerrar sesión" al final */
function CustomDrawerContent(props: any) {
  const { signOut } = useAuth();

  return (
    <DrawerContentScrollView {...props}>
      <DrawerItemList {...props} />
      <View style={{ height: 8 }} />
      <DrawerItem
        label="Cerrar sesión"
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

  return (
    <Drawer.Navigator
      initialRouteName="Agregar medicamento"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
    >
      <Drawer.Screen name="Agregar medicamento" component={AddOrEdit} />
      <Drawer.Screen name="Lista" component={Lista} />
      <Drawer.Screen name="Historial" component={Historial} />
      <Drawer.Screen name="Perfil" component={Perfil} />
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
