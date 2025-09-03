
// components/StateChanger.tsx
import React, { useState, useEffect } from 'react';
import { finesseService } from '@/lib/services/finesseService';
import { UserCredentials } from '@/types/finesse';

interface StateChangerProps {
  credentials: UserCredentials;
  currentState?: string;
  onStateChange: (state: 'READY' | 'NOT_READY', reasonCodeId?: string) => Promise<boolean>;
}

export const StateChanger: React.FC<StateChangerProps> = ({ 
  credentials, 
  currentState, 
  onStateChange 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [reasonCodes, setReasonCodes] = useState<any[]>([]);
  const [selectedReasonCode, setSelectedReasonCode] = useState<string>('');

  useEffect(() => {
    loadReasonCodes();
  }, [credentials]);

  const loadReasonCodes = async () => {
    try {
      const response = await finesseService.getReasonCodes(credentials);
      if (response.success && response.data?.ReasonCodes?.ReasonCode) {
        const codes = Array.isArray(response.data.ReasonCodes.ReasonCode) 
          ? response.data.ReasonCodes.ReasonCode 
          : [response.data.ReasonCodes.ReasonCode];
        setReasonCodes(codes);
      }
    } catch (error) {
      console.error('Erro ao carregar códigos de motivo:', error);
    }
  };

  const handleStateChange = async (newState: 'READY' | 'NOT_READY') => {
    setIsLoading(true);
    try {
      const success = await onStateChange(
        newState, 
        newState === 'NOT_READY' ? selectedReasonCode : undefined
      );
      
      if (success) {
        setSelectedReasonCode('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Alterar Status</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => handleStateChange('READY')}
          disabled={isLoading || currentState === 'READY'}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          {isLoading ? 'Alterando...' : 'Definir como Pronto'}
        </button>

        <div className="space-y-2">
          {reasonCodes.length > 0 && (
            <select
              value={selectedReasonCode}
              onChange={(e) => setSelectedReasonCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione um motivo</option>
              {reasonCodes.map((code, index) => (
                <option key={index} value={code.id?.text || code.id}>
                  {code.label?.text || code.label}
                </option>
              ))}
            </select>
          )}
          
          <button
            onClick={() => handleStateChange('NOT_READY')}
            disabled={isLoading || currentState === 'NOT_READY' || !selectedReasonCode}
            className="w-full bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            {isLoading ? 'Alterando...' : 'Definir como Não Pronto'}
          </button>
        </div>
      </div>
    </div>
  );
};

