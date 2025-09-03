// lib/services/finesseService.ts
import { FinesseApiResponse, UserCredentials, ApiResponse } from '@/types/finesse';

class FinesseService {
  private baseUrl = 'https://sncfinesse1.totvs.com.br:8445/finesse/api';
  private fallbackUrl = 'https://sncfinesse2.totvs.com.br:8445/finesse/api';

  private createAuthHeader(username: string, password: string): string {
    return btoa(`${username}:${password}`);
  }

  private parseXmlToJson(xmlString: string): any {
    const parseNode = (xmlNode: string): any => {
      const obj: any = {};
      
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

    return this.parseXml(xmlString);
  }

  private parseXml(xml: string): any {
    const obj: any = {};
    const tagPattern = /<([\w:.-]+)[^>]*>.*?<\/\1>/g;
    let match;
    while ((match = tagPattern.exec(xml)) !== null) {
      const node = this.parseNode(match[0]);
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
  }

  private parseNode(xmlNode: string): any {
    const obj: any = {};
    
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
  }

  async connectApi(credentials: UserCredentials): Promise<ApiResponse<FinesseApiResponse>> {
    const { username, password, agentId } = credentials;
    const url = `${this.baseUrl}/User/${agentId}/`;
    const authHeader = this.createAuthHeader(username, password);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authHeader}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Tentar com URL de fallback
        return this.connectApiWithFallback(credentials);
      }

      const xmlData = await response.text();
      const finesse = this.parseXmlToJson(xmlData);

      return {
        success: true,
        data: finesse,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Erro na conexão com Finesse:', error);
      
      // Tentar com URL de fallback
      return this.connectApiWithFallback(credentials);
    }
  }

  private async connectApiWithFallback(credentials: UserCredentials): Promise<ApiResponse<FinesseApiResponse>> {
    const { username, password, agentId } = credentials;
    const url = `${this.fallbackUrl}/User/${agentId}/`;
    const authHeader = this.createAuthHeader(username, password);

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
        return {
          success: false,
          error: `HTTP error! status: ${response.status}`,
        };
      }

      const xmlData = await response.text();
      const finesse = this.parseXmlToJson(xmlData);

      return {
        success: true,
        data: finesse,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      return {
        success: false,
        error: 'Falha na conexão com ambos os servidores Finesse',
      };
    }
  }

  async changeAgentState(
    credentials: UserCredentials,
    state: 'READY' | 'NOT_READY',
    reasonCodeId?: string
  ): Promise<ApiResponse<any>> {
    const { username, password, agentId } = credentials;
    const url = `${this.baseUrl}/User/${agentId}/`;
    const authHeader = this.createAuthHeader(username, password);

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
      const result = this.parseXmlToJson(xmlData);

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

  async getReasonCodes(credentials: UserCredentials): Promise<ApiResponse<any>> {
    const { username, password } = credentials;
    const url = `${this.baseUrl}/ReasonCodes?category=NOT_READY`;
    const authHeader = this.createAuthHeader(username, password);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/xml',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Erro ao buscar códigos de motivo: ${response.status}`,
        };
      }

      const xmlData = await response.text();
      const reasonCodes = this.parseXmlToJson(xmlData);

      return {
        success: true,
        data: reasonCodes,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Erro ao buscar códigos de motivo',
      };
    }
  }
}

export const finesseService = new FinesseService();