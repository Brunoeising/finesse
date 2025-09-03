// public/background.js
// Service Worker para extensão Chrome
class FinesseBackgroundService {
  constructor() {
    this.urls = [
      "https://sncfinesse1.totvs.com.br:8445/*",
      "https://sncfinesse2.totvs.com.br:8445/*"
    ];
    this.init();
  }

  init() {
    // Inicializar alarme ao instalar/atualizar extensão
    chrome.runtime.onInstalled.addListener(() => {
      this.startAlarm("checkAgentStatus");
    });

    // Listener para alarmes
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === "checkAgentStatus") {
        this.verifyTabsActive((isActiveTabFound) => {
          if (isActiveTabFound) {
            this.checkAgentStatus();
          }
        });
      }
    });

    // Listener para mensagens do popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessages(message, sender, sendResponse);
      return true; // Indica resposta assíncrona
    });
  }

  async startAlarm(nameAlarm) {
    try {
      const standardTimer = await this.getTimer("standardTimer") || 5;
      
      if (standardTimer) {
        console.log(`Alarme ${nameAlarm} iniciado com timer: ${standardTimer} minutos`);
        await chrome.alarms.create(nameAlarm, { periodInMinutes: standardTimer });
      } else {
        // Salvar valores padrão se não existirem
        await this.saveStandardTimer(5);
        await this.savePauseTimer(30);
        await chrome.alarms.create(nameAlarm, { periodInMinutes: 5 });
      }
    } catch (error) {
      console.error("Erro ao iniciar alarme:", error);
    }
  }

  async stopAlarm(nameAlarm) {
    try {
      const wasCleared = await chrome.alarms.clear(nameAlarm);
      console.log(wasCleared ? `Alarme ${nameAlarm} parado` : `Falha ao parar alarme ${nameAlarm}`);
    } catch (error) {
      console.error("Erro ao parar alarme:", error);
    }
  }

  handleMessages(message, sender, sendResponse) {
    switch (message.action) {
      case 'saveCredentials':
        this.saveUserCredential(message.data)
          .then((result) => sendResponse({ success: result }))
          .catch((error) => sendResponse({ success: false, error: error.message }));
        break;

      case 'saveTimer':
        this.saveTimer(message.data)
          .then((result) => {
            // Reiniciar alarme com novo timer
            this.stopAlarm("checkAgentStatus");
            this.startAlarm("checkAgentStatus");
            sendResponse({ success: result });
          })
          .catch((error) => sendResponse({ success: false, error: error.message }));
        break;

      case 'changeAgentState':
        this.changeAgentState(message.data)
          .then((result) => sendResponse({ success: result.success, data: result.data, error: result.error }))
          .catch((error) => sendResponse({ success: false, error: error.message }));
        break;

      case 'testNotification':
        this.sendNotification("Teste de notificação - Finesse Notifier funcionando!");
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: 'Ação não reconhecida' });
    }
  }

  verifyTabsActive(callback) {
    chrome.tabs.query({ url: this.urls }, (tabs) => {
      callback(tabs.length > 0);
    });
  }

  focusTab() {
    chrome.tabs.query({ url: this.urls }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, { active: true });
        chrome.windows.update(tabs[0].windowId, { focused: true });
      }
    });
  }

  async checkAgentStatus() {
    try {
      const credentials = await this.getUserCredentials();
      if (!credentials) {
        console.log("Credenciais não encontradas");
        return;
      }

      console.log("Verificando status do agente");
      const finesse = await this.connectApiFinesse(credentials);
      
      if (!finesse || finesse.error) {
        console.log("Erro na conexão com Finesse");
        this.sendNotification("Telefone Desconectado - Verifique a VPN / Cisco Jabber / Finesse");
        this.focusTab();
        return;
      }

      const reasonCodeId = finesse.reasonCodeId ? parseInt(finesse.reasonCodeId.text) : null;
      const finesseState = finesse.state ? finesse.state.text : null;
      const standardTimer = await this.getTimer("standardTimer") || 5;
      const pauseTimer = await this.getTimer("pauseTimer") || 30;
      const countTimer = (pauseTimer - standardTimer) * 60000;

      // Lógica de notificações baseada no status
      if (reasonCodeId === -1) {
        console.log(`Primeira condição ${reasonCodeId} - ${finesseState}`);
        this.sendNotification("Telefone Desconectado - Status Não Pronto");
        this.focusTab();
      } else if (reasonCodeId > 0 && reasonCodeId < 23) {
        await this.stopAlarm("checkAgentStatus");
        console.log(`Iniciando contador de pausa: ${countTimer}ms`);

        setTimeout(async () => {
          console.log(`Segunda condição ${reasonCodeId} - ${finesseState}`);
          this.sendNotification(`Você está há mais de ${pauseTimer} minutos com o telefone em pausa`);
          this.focusTab();
          await this.startAlarm("checkAgentStatus");
        }, countTimer);
      } else if ([28, 23].includes(reasonCodeId)) {
        console.log(`Terceira condição ${reasonCodeId} - ${finesseState}`);
        this.sendNotification("Telefone Desconectado - Verifique a VPN / Cisco Jabber / Finesse");
        this.focusTab();
      } else if (finesseState === "NOT_READY") {
        console.log(`Quarta condição ${reasonCodeId} - ${finesseState}`);
        this.sendNotification("Telefone Desconectado - Status Não Pronto");
        this.focusTab();
      }
    } catch (error) {
      console.error("Erro ao verificar status do Finesse:", error);
    }
  }

  async saveUserCredential(data) {
    try {
      const { username, password, agentId } = data;
      const finesse = await this.connectApiFinesse({ username, password, agentId });
      
      if (finesse?.error || finesse?.ApiErrors) {
        console.error("Erro ao conectar ao Finesse:", finesse.error || finesse.ApiErrors);
        return false;
      }

      if (finesse?.firstName) {
        return new Promise((resolve, reject) => {
          chrome.storage.local.set({ username, password, agentId }, () => {
            if (chrome.runtime.lastError) {
              console.error("Erro ao salvar credenciais:", chrome.runtime.lastError);
              reject(false);
            } else {
              console.log("Credenciais salvas com sucesso");
              resolve(true);
            }
          });
        });
      } else {
        console.error("Resposta inesperada do Finesse");
        return false;
      }
    } catch (error) {
      console.error("Erro na conexão com Finesse:", error);
      return false;
    }
  }

  async getUserCredentials() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['username', 'password', 'agentId'], (items) => {
        if (chrome.runtime.lastError || !items.username) {
          resolve(null);
        } else {
          resolve({
            username: items.username,
            password: items.password,
            agentId: items.agentId
          });
        }
      });
    });
  }

  async saveTimer(data) {
    const { timer, type } = data;
    return new Promise((resolve, reject) => {
      const key = type === "standardTimer" ? "standardTimer" : "pauseTimer";
      chrome.storage.local.set({ [key]: timer }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          console.log(`Timer ${type} salvo: ${timer}`);
          resolve(true);
        }
      });
    });
  }

  async saveStandardTimer(timer) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ standardTimer: timer }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          console.log(`Timer padrão salvo: ${timer}`);
          resolve(true);
        }
      });
    });
  }

  async savePauseTimer(timer) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ pauseTimer: timer }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          console.log(`Timer de pausa salvo: ${timer}`);
          resolve(true);
        }
      });
    });
  }

  async getTimer(type) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['standardTimer', 'pauseTimer'], (item) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          resolve(null);
          return;
        }

        const standardTimer = parseInt(item.standardTimer, 10);
        const pauseTimer = parseInt(item.pauseTimer, 10);

        if (type === "standardTimer") {
          resolve(isNaN(standardTimer) ? 5 : standardTimer);
        } else if (type === "pauseTimer") {
          resolve(isNaN(pauseTimer) ? 30 : pauseTimer);
        } else {
          resolve(null);
        }
      });
    });
  }

  async connectApiFinesse(credentials) {
    const { username, password, agentId } = credentials;
    const url = `https://sncfinesse1.totvs.com.br:8445/finesse/api/User/${agentId}/`;
    const authHeader = btoa(`${username}:${password}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/xml',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Tentar servidor de fallback
        return await this.connectApiFinesseWithFallback(credentials);
      }

      const data = await response.text();
      const finesse = this.xmlToJson(data);
      return finesse;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Erro na conexão:', error.message);
      return await this.connectApiFinesseWithFallback(credentials);
    }
  }

  async connectApiFinesseWithFallback(credentials) {
    const { username, password, agentId } = credentials;
    const url = `https://sncfinesse2.totvs.com.br:8445/finesse/api/User/${agentId}/`;
    const authHeader = btoa(`${username}:${password}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/xml',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { error: `HTTP error! status: ${response.status}` };
      }

      const data = await response.text();
      const finesse = this.xmlToJson(data);
      return finesse;
    } catch (error) {
      clearTimeout(timeoutId);
      return { error: 'Falha na conexão com ambos os servidores Finesse' };
    }
  }

  async changeAgentState(data) {
    const { credentials, state, reasonCodeId } = data;
    const { username, password, agentId } = credentials;
    const url = `https://sncfinesse1.totvs.com.br:8445/finesse/api/User/${agentId}/`;
    const authHeader = btoa(`${username}:${password}`);

    const stateXml = reasonCodeId 
      ? `<User><state>${state}</state><reasonCodeId>${reasonCodeId}</reasonCodeId></User>`
      : `<User><state>${state}</state></User>`;

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/xml',
        },
        body: stateXml,
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Erro ao alterar status: ${response.status}`,
        };
      }

      const xmlData = await response.text();
      const result = this.xmlToJson(xmlData);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Erro na comunicação com o servidor Finesse',
      };
    }
  }

  sendNotification(message) {
    chrome.notifications.clear('finesse-notification', () => {
      chrome.notifications.create('finesse-notification', {
        type: "basic",
        iconUrl: "./icons/icon48.png",
        title: "Notificação Finesse",
        message: message,
        requireInteraction: true,
      }, (notificationId) => {
        if (chrome.runtime.lastError) {
          console.error("Erro ao criar notificação:", chrome.runtime.lastError);
        }
      });
    });
  }

  xmlToJson(xmlString) {
    const parseNode = (xmlNode) => {
      const obj = {};

      const tagMatch = xmlNode.match(/<([\w:.-]+)([^>]*)>/);
      if (tagMatch) {
        const tagName = tagMatch[1];
        obj["tagName"] = tagName;

        const attrString = tagMatch[2];
        const attrPattern = /([\w:.-]+)="([^"]*)"/g;
        let match;
        while ((match = attrPattern.exec(attrString)) !== null) {
          obj[match[1]] = match[2];
        }

        const content = xmlNode.replace(/<[\w:.-]+[^>]*>|<\/[\w:.-]+>/g, '');

        if (content.trim()) {
          if (/<[\w:.-]+[^>]*>/.test(content)) {
            obj["children"] = this.parseXml(content);
          } else {
            obj["text"] = content.trim();
          }
        }
      } else {
        return xmlNode.trim();
      }

      return obj;
    };

    const parseXml = (xml) => {
      const obj = {};
      const tagPattern = /<([\w:.-]+)[^>]*>.*?<\/\1>/g;
      let match;
      while ((match = tagPattern.exec(xml)) !== null) {
        const node = parseNode(match[0]);
        const tagName = node.tagName;
        delete node.tagName;

        if (obj[tagName]) {
          if (!Array.isArray(obj[tagName])) {
            obj[tagName] = [obj[tagName]];
          }
          obj[tagName].push(node);
        } else {
          obj[tagName] = node;
        }
      }
      return obj;
    };

    return parseXml(xmlString);
  }
}

// Inicializar o service worker
new FinesseBackgroundService();