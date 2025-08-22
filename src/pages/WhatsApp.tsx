import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useCRM } from '@/contexts/CRMContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Loader2, Check, AlertTriangle, RefreshCw } from 'lucide-react';

const WhatsApp = () => {
  const { user } = useCRM();
  const { theme } = useTheme();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const connectWhatsApp = async () => {
    if (!user?.id_instancia_zapi || !user?.token_instancia_zapi) {
      setError('Dados de instância do WhatsApp não configurados. Entre em contato com o suporte.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setQrCode(null);

    try {
      const response = await fetch(
        `https://api.z-api.io/instances/${user.id_instancia_zapi}/token/${user.token_instancia_zapi}/qr-code/image`,
        {
          method: 'GET',
          headers: {
            'Client-Token': 'F1096638c0ef44b2f87649958def457ebS',
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      const data = await response.json();
      
      // Log da resposta completa para debug
      console.log('Resposta completa da API Z-API:', data);
      
      if (data.error) {
        throw new Error(data.error);
      }

      // A Z-API pode retornar o QR code em diferentes formatos:
      // 1. Diretamente como string base64
      // 2. Em um objeto com propriedade 'base64', 'qrcode', 'image', etc.
      // 3. Como resposta de bytes que precisa ser convertida
      
      let qrCodeData = null;
      
      // Verifica se a resposta é uma string (base64 direto)
      if (typeof data === 'string') {
        qrCodeData = data;
      }
      // Verifica se tem propriedades conhecidas para QR code
       else if (data.qrcode || data.image || data.base64 || data.qr || data.qr_code || data.value) {
         qrCodeData = data.qrcode || data.image || data.base64 || data.qr || data.qr_code || data.value;
       }
       // Se a resposta tem uma propriedade 'data'
       else if (data.data) {
         qrCodeData = data.data;
       }
      
      if (qrCodeData) {
        // Remove possíveis prefixos se já existirem
        let cleanBase64 = qrCodeData;
        if (typeof cleanBase64 === 'string') {
          cleanBase64 = cleanBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        }
        
        // Adiciona o prefixo correto
        const qrCodeImage = `data:image/png;base64,${cleanBase64}`;
        console.log('QR Code processado com sucesso');
        setQrCode(qrCodeImage);
      } else {
        console.error('Estrutura da resposta não reconhecida:', data);
        throw new Error('QR Code não encontrado na resposta da API. Verifique os logs do console para mais detalhes.');
      }
    } catch (err) {
      console.error('Erro ao conectar WhatsApp:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao conectar WhatsApp');
    } finally {
      setIsLoading(false);
    }
  };

  // Verificar status da conexão
  const checkConnectionStatus = async () => {
    if (!user?.id_instancia_zapi || !user?.token_instancia_zapi) {
      return false;
    }

    try {
      const response = await fetch(
        `https://api.z-api.io/instances/${user.id_instancia_zapi}/token/${user.token_instancia_zapi}/status`,
        {
          method: 'GET',
          headers: {
            'Client-Token': 'F1096638c0ef44b2f87649958def457ebS',
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      console.log('Status da conexão:', data);
      
      // Verifica se está conectado (diferentes formatos possíveis)
      const isConnectedStatus = data.connected || data.status === 'connected' || 
                               data.state === 'connected' || data.instance?.status === 'connected';
      
      return isConnectedStatus;
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      return false;
    }
  };

  // Verificação automática de status ao carregar o componente
  useEffect(() => {
    const verifyInitialStatus = async () => {
      const connected = await checkConnectionStatus();
      if (connected) {
        setIsConnected(true);
        setQrCode(null);
        setError(null);
      }
    };

    verifyInitialStatus();
  }, [user?.id_instancia_zapi, user?.token_instancia_zapi]);

  // Polling para verificar se o QR code foi escaneado
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (qrCode && !isConnected && !error) {
      interval = setInterval(async () => {
        const connected = await checkConnectionStatus();
        if (connected) {
          setIsConnected(true);
          setQrCode(null);
          setError(null);
          setIsLoading(false);
        }
      }, 3000); // Verifica a cada 3 segundos
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [qrCode, isConnected, error]);

  const handleVerifyStatus = async () => {
    setIsVerifying(true);
    const connected = await checkConnectionStatus();
    setIsConnected(connected);
    setIsVerifying(false);
  };

  const handleRetry = () => {
    setError(null);
    setQrCode(null);
    connectWhatsApp();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className={`flex flex-col items-center justify-center gap-8 max-w-md mx-auto ${
        theme === 'dark' ? 'text-white' : 'text-black'
      }`}>
        
        {/* Estado Inicial - Desconectado */}
        {!isConnected && !qrCode && !isLoading && !error && (
          <div className="flex flex-col items-center gap-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            <h1 className={`text-2xl font-light text-center ${
              theme === 'dark' ? 'text-white' : 'text-black'
            }`}>Conectar WhatsApp</h1>
            <Button 
              onClick={connectWhatsApp}
              className="px-8 py-3 bg-[hsl(60,85%,73%)] hover:bg-[hsl(60,85%,68%)] text-black font-medium rounded-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_-2px_hsl(60,85%,73%,0.3)] active:translate-y-0 active:shadow-[0_2px_8px_-2px_hsl(60,85%,73%,0.2)]"
            >
              Gerar QR Code
            </Button>
          </div>
        )}

        {/* Estado de Carregamento */}
        {isLoading && (
          <div className="flex flex-col items-center gap-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            <Loader2 className={`w-12 h-12 animate-spin ${
              theme === 'dark' ? 'text-white' : 'text-black'
            }`} />
            <p className={`text-sm ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              Gerando QR Code...
            </p>
          </div>
        )}

        {/* Estado de Exibição do QR Code */}
        {qrCode && !isConnected && !error && (
          <div className="flex flex-col items-center gap-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            <div className={`p-4 rounded-lg shadow-[0_10px_30px_-10px_hsl(0,0%,0%,0.3)] ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            }`}>
              <img 
                src={qrCode} 
                alt="QR Code WhatsApp" 
                className="w-64 h-64 rounded"
              />
            </div>
            <div className={`flex items-center gap-2 text-sm ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Aguardando escaneamento...</span>
            </div>
          </div>
        )}

        {/* Estado de Sucesso - Conectado */}
        {isConnected && (
          <div className="flex flex-col items-center gap-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            <Check 
              className="w-16 h-16 text-[hsl(120,100%,50%)]" 
              style={{ filter: 'drop-shadow(0 0 10px hsl(120, 100%, 50%, 0.3))' }}
            />
            <p className={`text-xl font-medium text-center ${
              theme === 'dark' ? 'text-white' : 'text-black'
            }`}>
              WhatsApp Conectado
            </p>
            <Button 
              onClick={handleVerifyStatus}
              disabled={isVerifying}
              className="px-6 py-2 bg-[hsl(0,0%,12%)] hover:bg-[hsl(0,0%,18%)] border border-[hsl(0,0%,25%)] text-white rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Verificar Status'
              )}
            </Button>
          </div>
        )}

        {/* Estado de Erro */}
        {error && (
          <div className="flex flex-col items-center gap-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-3 text-[hsl(0,84%,60%)]">
              <AlertTriangle className="w-6 h-6" />
              <span className="text-base">Erro ao conectar</span>
            </div>
            <div className={`text-center text-sm max-w-sm ${
              theme === 'dark' ? 'text-red-400' : 'text-red-600'
            }`}>
              {error}
            </div>
            <Button 
              onClick={handleRetry}
              className="px-6 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white rounded-lg transition-all duration-300 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar Novamente
            </Button>
          </div>
        )}


      </div>
    </div>
  );
};

export default WhatsApp;
