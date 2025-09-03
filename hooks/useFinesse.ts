// hooks/useFinesse.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { finesseService } from '@/lib/services/finesseService';
import { storageService } from '@/lib/services/storageService';
import { notificationService } from '@/lib/services/notificationService';
import { UserCredentials, FinesseApiResponse, TimerSettings, NotificationConfig } from '@/types/finesse';
import { NotificationType } from '@/types/notifications';

interface UseFinesseReturn {
  agentStatus: FinesseApiResponse | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  credentials: UserCredentials | null;
  timerSettings: TimerSettings;
  notificationConfig: NotificationConfig;
  login: (credentials: UserCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  changeAgentState: (state: 'READY' | 'NOT_READY', reasonCodeId?: string) => Promise<boolean>;
  updateTimerSettings: (settings: TimerSettings) => Promise<boolean>;
  updateNotificationConfig: (config: NotificationConfig) => Promise<boolean>;
  testNotification: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

export const useFinesse = (): UseFinesseReturn => {
  const [agentStatus, setAgentStatus] = useState<FinesseApiResponse | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<UserCredentials | null>(null);
  const [timerSettings, setTimerSettings] = useState<TimerSettings>({
    standardTimer: 5,
    pauseTimer: 30,
  });
  const [notificationConfig, setNotificationConfig] = useState<NotificationConfig>({
    windowsNotification: true,
    googleChatNotification: false,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkAgentStatus = useCallback(async (creds?: UserCredentials) => {
    const currentCredentials = creds || credentials;
    if (!currentCredentials) return;

    try {
      const response = await finesseService.connectApi(currentCredentials);
      
      if (response.success && response.data) {
        setAgentStatus(response.data);
        setIsConnected(true);
        setError(null);
        await storageService.saveAgentStatus(response.data);
        
        // Verificar condições para notificações
        await handleStatusNotifications(response.data);
      } else {
        setIsConnected(false);
        setError(response.error || 'Erro na conexão com Finesse');
        
        // Notificar sobre erro de conexão
        await sendNotification(NotificationType.DEVICE_ERROR);
      }
    } catch (err) {
      setIsConnected(false);
      setError('Erro na verificação do status');
    }
  }, [credentials]);

  const handleStatusNotifications = async (status: FinesseApiResponse) => {
    const reasonCodeId = status.reasonCodeId ? parseInt(status.reasonCodeId.text) : null;
    const finesseState = status.state ? status.state.text : null;

    if (reasonCodeId === -1) {
      await sendNotification(NotificationType.NOT_READY);
      focusFinesseTab();
    } else if (reasonCodeId && reasonCodeId > 0 && reasonCodeId < 23) {
      // Parar verificações e iniciar contador de pausa
      stopStatusCheck();
      const countTimer = (timerSettings.pauseTimer - timerSettings.standardTimer) * 60000;
      
      pauseTimeoutRef.current = setTimeout(async () => {
        await sendNotification(NotificationType.TIME_EXCEEDED, timerSettings.pauseTimer);
        focusFinesseTab();
        startStatusCheck();
      }, countTimer);
    } else if ([28, 23].includes(reasonCodeId || 0)) {
      await sendNotification(NotificationType.DEVICE_ERROR);
      focusFinesseTab();
    } else if (finesseState === "NOT_READY") {
      await sendNotification(NotificationType.NOT_READY);
      focusFinesseTab();
    }
  };

  const sendNotification = async (type: NotificationType, additionalParam?: number) => {
    const message = notificationService.getMessage(type, additionalParam);
    const payload = {
      type,
      message,
      timestamp: new Date(),
      agentId: credentials?.agentId,
    };

    if (notificationConfig.windowsNotification) {
      await notificationService.sendWindowsNotification(payload);
    }

    if (notificationConfig.googleChatNotification && notificationConfig.googleChatWebhook) {
      await notificationService.sendGoogleChatNotification(
        notificationConfig.googleChatWebhook,
        payload
      );
    }
  };

  const focusFinesseTab = () => {
    if (typeof window !== 'undefined' && window.focus) {
      window.focus();
    }
  };

  const startStatusCheck = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      checkAgentStatus();
    }, timerSettings.standardTimer * 60 * 1000);
  }, [checkAgentStatus, timerSettings.standardTimer]);

  const stopStatusCheck = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
  };

  const login = async (loginCredentials: UserCredentials): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await finesseService.connectApi(loginCredentials);
      
      if (response.success && response.data && response.data.firstName) {
        await storageService.saveCredentials(loginCredentials);
        setCredentials(loginCredentials);
        setAgentStatus(response.data);
        setIsConnected(true);
        startStatusCheck();
        return true;
      } else {
        setError('Credenciais inválidas ou erro na conexão');
        return false;
      }
    } catch (err) {
      setError('Erro na tentativa de login');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    stopStatusCheck();
    await storageService.removeCredentials();
    setCredentials(null);
    setAgentStatus(null);
    setIsConnected(false);
    setError(null);
  };

  const changeAgentState = async (state: 'READY' | 'NOT_READY', reasonCodeId?: string): Promise<boolean> => {
    if (!credentials) return false;

    try {
      const response = await finesseService.changeAgentState(credentials, state, reasonCodeId);
      
      if (response.success) {
        // Atualizar status imediatamente
        await checkAgentStatus();
        return true;
      } else {
        setError(response.error || 'Erro ao alterar status');
        return false;
      }
    } catch (err) {
      setError('Erro na alteração do status');
      return false;
    }
  };

  const updateTimerSettings = async (settings: TimerSettings): Promise<boolean> => {
    const success = await storageService.saveTimerSettings(settings);
    if (success) {
      setTimerSettings(settings);
      // Reiniciar verificações com novo timer
      if (isConnected) {
        stopStatusCheck();
        startStatusCheck();
      }
    }
    return success;
  };

  const updateNotificationConfig = async (config: NotificationConfig): Promise<boolean> => {
    const success = await storageService.saveNotificationConfig(config);
    if (success) {
      setNotificationConfig(config);
    }
    return success;
  };

  const testNotification = async (): Promise<void> => {
    await sendNotification(NotificationType.NOT_READY);
  };

  const refreshStatus = async (): Promise<void> => {
    if (credentials) {
      await checkAgentStatus();
    }
  };

  // Inicialização
  useEffect(() => {
    const initializeApp = async () => {
      setIsLoading(true);

      try {
        // Carregar configurações
        const [savedCredentials, savedTimerSettings, savedNotificationConfig] = await Promise.all([
          storageService.getCredentials(),
          storageService.getTimerSettings(),
          storageService.getNotificationConfig(),
        ]);

        setTimerSettings(savedTimerSettings);
        setNotificationConfig(savedNotificationConfig);

        if (savedCredentials) {
          setCredentials(savedCredentials);
          await checkAgentStatus(savedCredentials);
          startStatusCheck();
        }
      } catch (err) {
        setError('Erro na inicialização da aplicação');
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();

    return () => {
      stopStatusCheck();
    };
  }, []);

  // Atualizar interval quando timer settings mudam
  useEffect(() => {
    if (isConnected && credentials) {
      stopStatusCheck();
      startStatusCheck();
    }
  }, [timerSettings.standardTimer, isConnected, credentials, startStatusCheck]);

  return {
    agentStatus,
    isConnected,
    isLoading,
    error,
    credentials,
    timerSettings,
    notificationConfig,
    login,
    logout,
    changeAgentState,
    updateTimerSettings,
    updateNotificationConfig,
    testNotification,
    refreshStatus,
  };
};

