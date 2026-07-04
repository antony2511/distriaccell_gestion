import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC_ID = 'app-config';

export interface NotificationSettings {
  enabled: boolean;
  managerEmail?: string;
  managerName?: string;
  secondaryEmail?: string;
  secondaryName?: string;
}

export interface CategoryBudgets {
  [categoryId: string]: number; // presupuesto mensual en COP
}

export interface AppConfig {
  notifications: NotificationSettings;
  budgets?: CategoryBudgets;
  emailjs?: {
    serviceId: string;
    templateId: string;
    publicKey: string;
  };
}

const DEFAULT_CONFIG: AppConfig = {
  notifications: {
    enabled: true
  },
  budgets: {}
};

/**
 * Obtiene la configuración de la aplicación
 */
export const getAppConfig = async (): Promise<AppConfig> => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as AppConfig;
    }

    // Si no existe, retornar configuración por defecto
    return DEFAULT_CONFIG;
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    return DEFAULT_CONFIG;
  }
};

/**
 * Guarda la configuración de la aplicación
 */
export const saveAppConfig = async (config: Partial<AppConfig>): Promise<void> => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    await setDoc(docRef, config, { merge: true });
  } catch (error) {
    console.error('Error al guardar configuración:', error);
    throw error;
  }
};

/**
 * Actualiza solo la configuración de notificaciones
 */
export const updateNotificationSettings = async (
  settings: Partial<NotificationSettings>
): Promise<void> => {
  try {
    const currentConfig = await getAppConfig();
    const updatedConfig: AppConfig = {
      ...currentConfig,
      notifications: {
        ...currentConfig.notifications,
        ...settings
      }
    };
    await saveAppConfig(updatedConfig);
  } catch (error) {
    console.error('Error al actualizar configuración de notificaciones:', error);
    throw error;
  }
};

/**
 * Obtiene solo la configuración de notificaciones
 */
export const getNotificationSettings = async (): Promise<NotificationSettings> => {
  const config = await getAppConfig();
  return config.notifications;
};

/**
 * Obtiene los presupuestos por categoría
 */
export const getBudgetSettings = async (): Promise<CategoryBudgets> => {
  const config = await getAppConfig();
  return config.budgets || {};
};

/**
 * Guarda los presupuestos por categoría
 */
export const updateBudgetSettings = async (budgets: CategoryBudgets): Promise<void> => {
  await saveAppConfig({ budgets });
};
