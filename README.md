# 💊 MedTime - Gestor de Medicamentos

Una aplicación móvil desarrollada con React Native y Expo para ayudar a los usuarios a gestionar sus medicamentos y recordatorios de dosis.

## 📱 Características

- **Gestión de Medicamentos**: Agrega, edita y elimina medicamentos fácilmente
- **Recordatorios Inteligentes**: Sistema de alarmas y notificaciones para no olvidar tomar medicamentos
- **Historial Completo**: Registro detallado de todas las tomas de medicamentos
- **Autenticación**: Login con Google o modo invitado
- **Sincronización en la Nube**: Datos respaldados en Supabase
- **Exportación de Datos**: Descarga tu historial en formato CSV
- **Interfaz Intuitiva**: Diseño moderno y fácil de usar

## 🚀 Tecnologías Utilizadas

- **React Native** - Framework de desarrollo móvil
- **Expo** - Plataforma de desarrollo y despliegue
- **TypeScript** - Tipado estático para JavaScript
- **Supabase** - Backend como servicio (BaaS)
- **React Navigation** - Navegación entre pantallas
- **Expo Notifications** - Sistema de notificaciones
- **AsyncStorage** - Almacenamiento local

## 📦 Instalación

### Prerrequisitos

- Node.js (versión 16 o superior)
- npm o yarn
- Expo CLI
- Dispositivo móvil con Expo Go o emulador

### Pasos de Instalación

1. **Clona el repositorio**
   ```bash
   git clone https://github.com/tu-usuario/medtime.git
   cd medtime
   ```

2. **Instala las dependencias**
   ```bash
   npm install
   # o
   yarn install
   ```

3. **Configura las variables de entorno**
   - Crea un archivo `.env` en la raíz del proyecto
   - Configura las credenciales de Supabase:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=tu_url_de_supabase
   EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
   ```

4. **Inicia el servidor de desarrollo**
   ```bash
   npm start
   # o
   yarn start
   ```

5. **Ejecuta en tu dispositivo**
   - Escanea el código QR con Expo Go (Android/iOS)
   - O presiona `a` para Android o `i` para iOS en el emulador

## 🏗️ Estructura del Proyecto

```
medtime/
├── app/                    # Pantallas principales
│   ├── _layout.tsx        # Layout principal
│   ├── app.tsx            # Componente raíz
│   ├── index.tsx          # Pantalla de agregar/editar medicamentos
│   ├── lista.tsx          # Lista de medicamentos
│   ├── historial.tsx      # Historial de tomas
│   ├── perfil.tsx         # Perfil de usuario
│   ├── login.tsx          # Pantalla de login
│   └── alarmModal.tsx     # Modal de alarma
├── src/
│   ├── alarms/            # Servicio de alarmas
│   ├── lib/               # Configuraciones (auth, supabase)
│   ├── notifications/     # Servicio de notificaciones
│   ├── storage/           # Gestión de datos locales y remotos
│   ├── theme/             # Tema y colores
│   └── utils/             # Utilidades compartidas
├── assets/                # Imágenes y recursos
└── package.json
```

## 🔧 Configuración de Supabase

1. **Crea un proyecto en Supabase**
   - Ve a [supabase.com](https://supabase.com)
   - Crea una nueva cuenta o inicia sesión
   - Crea un nuevo proyecto

2. **Configura la autenticación**
   - Ve a Authentication > Providers
   - Habilita Google OAuth
   - Configura las credenciales de Google

3. **Crea las tablas necesarias**
   ```sql
   -- Tabla de perfiles de usuario
   CREATE TABLE profiles (
     id UUID REFERENCES auth.users ON DELETE CASCADE,
     name TEXT,
     age INTEGER,
     gender TEXT,
     avatar_url TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     PRIMARY KEY (id)
   );

   -- Tabla de medicamentos
   CREATE TABLE medications (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     doses TEXT[] NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Tabla de historial
   CREATE TABLE medication_history (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     med_name TEXT NOT NULL,
     dose TEXT NOT NULL,
     scheduled_times TEXT[] NOT NULL,
     status TEXT NOT NULL,
     taken_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

## 📱 Funcionalidades Detalladas

### Gestión de Medicamentos
- Agregar medicamentos con nombre, dosis y horarios
- Editar medicamentos existentes
- Eliminar medicamentos
- Búsqueda inteligente en catálogo de medicamentos

### Sistema de Recordatorios
- Alarmas programables para cada medicamento
- Notificaciones push en segundo plano
- Modal de alarma con opciones de acción
- Aplazamiento de recordatorios

### Historial y Exportación
- Registro automático de todas las tomas
- Historial local y sincronizado en la nube
- Exportación a CSV
- Estadísticas de adherencia

### Autenticación
- Login con Google OAuth
- Modo invitado para uso sin registro
- Sincronización automática de datos

## 🎨 Personalización

### Colores del Tema
Los colores se pueden personalizar en `src/theme/colors.ts`:

```typescript
export const colors = {
  primary: "#40cfff",
  secondary: "#3fcefe", 
  primaryDark: "#157793",
  accent: "#00517d",
  purple: "#44439f",
} as const;
```

### Configuración de Alarmas
Las configuraciones de alarmas se pueden ajustar en `src/storage/alarmSettings.ts`.

## 🚀 Despliegue

### Android
```bash
# Generar APK
expo build:android

# O usar EAS Build
eas build --platform android
```

### iOS
```bash
# Generar para iOS
expo build:ios

# O usar EAS Build
eas build --platform ios
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 👥 Autores

- **Tu Nombre** - *Desarrollo inicial* - [tu-github](https://github.com/tu-usuario)

## 🙏 Agradecimientos

- Expo por la excelente plataforma de desarrollo
- Supabase por el backend robusto
- React Native por el framework móvil
- La comunidad de desarrolladores por las librerías utilizadas

## 📞 Soporte

Si tienes problemas o preguntas:

1. Revisa la documentación
2. Busca en los issues existentes
3. Crea un nuevo issue con detalles del problema

## 🔄 Changelog

### v1.0.0
- ✅ Gestión básica de medicamentos
- ✅ Sistema de recordatorios
- ✅ Autenticación con Google
- ✅ Historial de tomas
- ✅ Exportación de datos
- ✅ Interfaz de usuario optimizada

---

**¡Gracias por usar MedTime! 💊✨**
