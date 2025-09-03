// lib/services/storageService.ts
import { UserCredentials, TimerSettings, NotificationConfig } from '@/types/finesse';

class StorageService {
  private isExtension = typeof chrome !== 'undefined' && chrome.storage;

  async saveCredentials(credentials: UserCredentials): Promise<boolean> {
    try {
      if (this.isExtension) {
        return new Promise((resolve) => {
          chrome.storage.local.set(credentials, () => {
            resolve(!chrome.runtime.lastError);
          });
        });
      } else {
        // Fallback para localStorage em ambiente web
        Object.entries(credentials).forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });
        return true;
      }
    } catch (error) {
      console.error('Erro ao salvar credenciais:', error);
      return false;
    }
  }

  async getCredentials(): Promise<UserCredentials | null> {
    try {
      if (this.isExtension) {
        return new Promise((resolve) => {
          chrome.storage.local.get(['username', 'password', 'agentId'], (result) => {
            if (chrome.runtime.lastError || !result.username) {
              resolve(null);
              return;
            }
            resolve({
              username: result.username,
              password: result.password,
              agentId: result.agentId,
            });
          });
        });
      } else {
        // Fallback para localStorage
        const username = localStorage.getItem('username');
        const password = localStorage.getItem('password');
        const agentId = localStorage.getItem('agentId');

        if (!username || !password || !agentId) {
          return null;
        }

        return { username, password, agentId };
      }
    } catch (error) {
      console.error('Erro ao recuperar credenciais:', error);
      return null;
    }
  }

  async removeCredentials(): Promise<boolean> {
    try {
      if (this.isExtension) {
        return new Promise((resolve) => {
          chrome.storage.local.remove(['username', 'password', 'agentId'], () => {
            resolve(!chrome.runtime.lastError);
          });
        });
      } else {
        localStorage.removeItem('username');
        localStorage.removeItem('password');
        localStorage.removeItem('agentId');
        return true;
      }
    } catch (error) {
      console.error('Erro ao remover credenciais:', error);
      return false;
    }
  }

  async saveTimerSettings(settings: TimerSettings): Promise<boolean> {
    try {
      if (this.isExtension) {
        return new Promise((resolve) => {
          chrome.storage.local.set({
            standardTimer: settings.standardTimer,
            pauseTimer: settings.pauseTimer,
          }, () => {
            resolve(!chrome.runtime.lastError);
          });
        });
      } else {
        localStorage.setItem('standardTimer', settings.standardTimer.toString());
        localStorage.setItem('pauseTimer', settings.pauseTimer.toString());
        return true;
      }
    } catch (error) {
      console.error('Erro ao salvar configurações de timer:', error);
      return false;
    }
  }

  async getTimerSettings(): Promise<TimerSettings> {
    const defaultSettings: TimerSettings = {
      standardTimer: 5,
      pauseTimer: 30,
    };

    try {
      if (this.isExtension) {
        return new Promise((resolve) => {
          chrome.storage.local.get(['standardTimer', 'pauseTimer'], (result) => {
            if (chrome.runtime.lastError) {
              resolve(defaultSettings);
              return;
            }

            resolve({
              standardTimer: parseInt(result.standardTimer) || defaultSettings.standardTimer,
              pauseTimer: parseInt(result.pauseTimer) || defaultSettings.pauseTimer,
            });
          });
        });
      } else {
        const standardTimer = parseInt(localStorage.getItem('standardTimer') || '5');
        const pauseTimer = parseInt(localStorage.getItem('pauseTimer') || '30');

        return {
          standardTimer: isNaN(standardTimer) ? defaultSettings.standardTimer : standardTimer,
          pauseTimer: isNaN(pauseTimer) ? defaultSettings.pauseTimer : pauseTimer,
        };
      }
    } catch (error) {
      console.error('Erro ao recuperar configurações de timer:', error);
      return defaultSettings;
    }
  }

  async saveNotificationConfig(config: NotificationConfig): Promise<boolean> {
    try {
      if (this.isExtension) {
        return new Promise((resolve) => {
          chrome.storage.local.set({
            windowsNotification: config.windowsNotification,
            googleChatNotification: config.googleChatNotification,
            googleChatWebhook: config.googleChatWebhook,
          }, () => {
            resolve(!chrome.runtime.lastError);
          });
        });
      } else {
        localStorage.setItem('windowsNotification', config.windowsNotification.toString());
        localStorage.setItem('googleChatNotification', config.googleChatNotification.toString());
        if (config.googleChatWebhook) {
          localStorage.setItem('googleChatWebhook', config.googleChatWebhook);
        }
        return true;
      }
    } catch (error) {
      console.error('Erro ao salvar configurações de notificação:', error);
      return false;
    }
  }

  async getNotificationConfig(): Promise<NotificationConfig> {
    const defaultConfig: NotificationConfig = {
      windowsNotification: true,
      googleChatNotification: false,
    };

    try {
      if (this.isExtension) {
        return new Promise((resolve) => {
          chrome.storage.local.get([
            'windowsNotification',
            'googleChatNotification',
            'googleChatWebhook'
          ], (result) => {
            if (chrome.runtime.lastError) {
              resolve(defaultConfig);
              return;
            }

            resolve({
              windowsNotification: result.windowsNotification !== false,
              googleChatNotification: result.googleChatNotification === true,
              googleChatWebhook: result.googleChatWebhook,
            });
          });
        });
      } else {
        return {
          windowsNotification: localStorage.getItem('windowsNotification') !== 'false',
          googleChatNotification: localStorage.getItem('googleChatNotification') === 'true',
          googleChatWebhook: localStorage.getItem('googleChatWebhook') || undefined,
        };
      }
    } catch (error) {
      console.error('Erro ao recuperar configurações de notificação:', error);
      return defaultConfig;
    }
  }

  async saveAgentStatus(status: any): Promise<boolean> {
    try {
      if (this.isExtension) {
        return new Promise((resolve) => {
          chrome.storage.local.set({
            lastAgentStatus: JSON.stringify(status),
            lastStatusCheck: new Date().toISOString(),
          }, () => {
            resolve(!chrome.runtime.lastError);
          });
        });
      } else {
        localStorage.setItem('lastAgentStatus', JSON.stringify(status));
        localStorage.setItem('lastStatusCheck', new Date().toISOString());
        return true;
      }
    } catch (error) {
      console.error('Erro ao salvar status do agente:', error);
      return false;
    }
  }

  async getLastAgentStatus(): Promise<{ status: any; timestamp: Date } | null> {
    try {
      if (this.isExtension) {
        return new Promise((resolve) => {
          chrome.storage.local.get(['lastAgentStatus', 'lastStatusCheck'], (result) => {
            if (chrome.runtime.lastError || !result.lastAgentStatus) {
              resolve(null);
              return;
            }

            resolve({
              status: JSON.parse(result.lastAgentStatus),
              timestamp: new Date(result.lastStatusCheck),
            });
          });
        });
      } else {
        const statusStr = localStorage.getItem('lastAgentStatus');
        const timestampStr = localStorage.getItem('lastStatusCheck');

        if (!statusStr || !timestampStr) {
          return null;
        }

        return {
          status: JSON.parse(statusStr),
          timestamp: new Date(timestampStr),
        };
      }
    } catch (error) {
      console.error('Erro ao recuperar último status do agente:', error);
      return null;
    }
  }

  async clearAllData(): Promise<boolean> {
    try {
      if (this.isExtension) {
        return new Promise((resolve) => {
          chrome.storage.local.clear(() => {
            resolve(!chrome.runtime.lastError);
          });
        });
      } else {
        localStorage.clear();
        return true;
      }
    } catch (error) {
      console.error('Erro ao limpar dados:', error);
      return false;
    }
  }
}

export const storageService = new StorageService();