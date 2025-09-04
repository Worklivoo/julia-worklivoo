import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useCRM } from '@/contexts/CRMContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Loader2, Check, AlertTriangle, RefreshCw, Clock, QrCode, Smartphone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const WhatsApp = () => {
  const { user } = useCRM();
  const { theme } = useTheme();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phoneCode, setPhoneCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeTimer, setQrCodeTimer] = useState<number>(20);
  const [cooldownTimer, setCooldownTimer] = useState<number>(0);
  const [isCooldown, setIsCooldown] = useState<boolean>(false);
  const [connectionMethod, setConnectionMethod] = useState<'qrcode' | 'phone'>('qrcode');


  const connectWhatsAppViaQR = async () => {
    if (!user?.id_instancia_zapi || !user?.token_instancia_zapi) {
      setError('Dados de instância do WhatsApp não configurados. Entre em contato com o suporte.');
      return;
    }
    
    // Verifica se está em cooldown
    if (isCooldown) {
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
        setQrCodeTimer(20); // Inicia o temporizador de 20 segundos
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
      if (!user?.id_instancia_zapi || !user?.token_instancia_zapi) {
        setError('Dados de instância do WhatsApp não configurados. Entre em contato com o suporte.');
        return;
      }

      setIsLoading(true);
      setError(null);
      
      try {
        const connected = await checkConnectionStatus();
        setIsConnected(connected);
        
        if (!connected) {
          // Se não estiver conectado, não mostra erro, apenas deixa pronto para conectar
          setQrCode(null);
        }
      } catch (err) {
        console.error('Erro ao verificar status inicial:', err);
        // Em caso de erro na verificação, assume como desconectado
        setIsConnected(false);
      } finally {
        setIsLoading(false);
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
          setQrCodeTimer(20);
        }
      }, 3000); // Verifica a cada 3 segundos
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [qrCode, isConnected, error]);
  
  // Conectar via código de telefone
  const connectWhatsAppViaPhone = async () => {
    if (!user?.id_instancia_zapi || !user?.token_instancia_zapi) {
      setError('Dados de instância do WhatsApp não configurados. Entre em contato com o suporte.');
      return;
    }
    
    // Verifica se está em cooldown
    if (isCooldown) {
      return;
    }

    // Validar número de telefone
    if (!phoneNumber || phoneNumber.length < 10 || phoneNumber.length > 11) {
      setError('Por favor, insira um número de telefone válido com DDD (ex: 11999999999)');
      return;
    }

    setIsLoading(true);
    setError(null);
    setPhoneCode(null);

    try {
      const response = await fetch(
        `https://api.z-api.io/instances/${user.id_instancia_zapi}/token/${user.token_instancia_zapi}/phone-code/${phoneNumber}`,
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
      console.log('Resposta completa da API Z-API (código telefone):', data);
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Extrair o código da resposta
      let code = null;
      
      if (data.code || data.phoneCode || data.value) {
        code = data.code || data.phoneCode || data.value;
      } else if (typeof data === 'string') {
        code = data;
      } else if (data.data) {
        code = data.data;
      }
      
      if (code) {
        console.log('Código de telefone processado com sucesso');
        setPhoneCode(code);
        setQrCodeTimer(20); // Inicia o temporizador de 20 segundos
      } else {
        console.error('Estrutura da resposta não reconhecida:', data);
        throw new Error('Código de telefone não encontrado na resposta da API. Verifique os logs do console para mais detalhes.');
      }
    } catch (err) {
      console.error('Erro ao conectar WhatsApp via telefone:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao conectar WhatsApp');
    } finally {
      setIsLoading(false);
    }
  };

  // Temporizador para o QR Code ou código de telefone
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if ((qrCode || phoneCode) && qrCodeTimer > 0) {
      timer = setInterval(() => {
        setQrCodeTimer(prev => prev - 1);
      }, 1000);
    } else if ((qrCode || phoneCode) && qrCodeTimer === 0) {
      // Código expirou
      setQrCode(null);
      setPhoneCode(null);
      setError(`${connectionMethod === 'qrcode' ? 'QR Code' : 'Código'} expirou. Aguarde para solicitar um novo.`);
      setIsCooldown(true);
      setCooldownTimer(15);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [qrCode, phoneCode, qrCodeTimer, connectionMethod]);
  
  // Temporizador para o cooldown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (isCooldown && cooldownTimer > 0) {
      timer = setInterval(() => {
        setCooldownTimer(prev => prev - 1);
      }, 1000);
    } else if (isCooldown && cooldownTimer === 0) {
      setIsCooldown(false);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isCooldown, cooldownTimer]);



  const handleRetry = () => {
    if (isCooldown) return;
    
    setError(null);
    setQrCode(null);
    setPhoneCode(null);
    
    // Após expirar o QR Code, retorna para a tela de seleção
    // em vez de tentar gerar um novo código automaticamente
  };
  
  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Permitir apenas números
    const value = e.target.value.replace(/[^0-9]/g, '');
    // Limitar a 11 dígitos (DDD + número)
    if (value.length <= 11) {
      setPhoneNumber(value);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className={`flex flex-col items-center justify-center gap-8 max-w-md mx-auto ${
        theme === 'dark' ? 'text-white' : 'text-black'
      }`}>
        
        {/* Estado Inicial - Desconectado */}
        {!isConnected && !qrCode && !phoneCode && !isLoading && !error && (
          <div className="flex flex-col items-center gap-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 w-full">
            <h1 className={`text-2xl font-light text-center ${
              theme === 'dark' ? 'text-white' : 'text-black'
            }`}>Conectar WhatsApp</h1>
            
            <Tabs defaultValue="qrcode" className="w-full" onValueChange={(value) => setConnectionMethod(value as 'qrcode' | 'phone')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="qrcode" className="flex items-center gap-2">
                  <QrCode className="w-4 h-4" />
                  QR Code
                </TabsTrigger>
                <TabsTrigger value="phone" className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  Código por Telefone
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="qrcode" className="mt-4">
                <div className="flex flex-col items-center">
                  <Button 
                    onClick={connectWhatsAppViaQR}
                    disabled={isCooldown}
                    className={`px-8 py-3 ${isCooldown ? 'bg-gray-400 cursor-not-allowed' : 'bg-[hsl(60,85%,73%)] hover:bg-[hsl(60,85%,68%)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_-2px_hsl(60,85%,73%,0.3)] active:translate-y-0 active:shadow-[0_2px_8px_-2px_hsl(60,85%,73%,0.2)]'} text-black font-medium rounded-lg transition-all duration-300`}
                  >
                    {isCooldown ? `Aguarde (${cooldownTimer}s)` : 'Gerar QR Code'}
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="phone" className="mt-4">
                <div className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone-number">Número de telefone (com DDD)</Label>
                    <div className="flex items-center">
                      <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-l-md border-r-0 border border-gray-300 dark:border-gray-700">
                        +55
                      </div>
                      <Input 
                        id="phone-number" 
                        placeholder="11999999999" 
                        value={phoneNumber} 
                        onChange={handlePhoneNumberChange} 
                        className="rounded-l-none" 
                        maxLength={11}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Digite apenas números, incluindo o DDD</p>
                  </div>
                  <Button 
                    onClick={connectWhatsAppViaPhone}
                    disabled={isCooldown || !phoneNumber || phoneNumber.length < 10}
                    className={`px-8 py-3 ${isCooldown || !phoneNumber || phoneNumber.length < 10 ? 'bg-gray-400 cursor-not-allowed' : 'bg-[hsl(60,85%,73%)] hover:bg-[hsl(60,85%,68%)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_-2px_hsl(60,85%,73%,0.3)] active:translate-y-0 active:shadow-[0_2px_8px_-2px_hsl(60,85%,73%,0.2)]'} text-black font-medium rounded-lg transition-all duration-300`}
                  >
                    {isCooldown ? `Aguarde (${cooldownTimer}s)` : 'Gerar Código'}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
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
              {connectionMethod === 'qrcode' ? 'Gerando QR Code...' : 'Gerando código...'}
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
            <div className="flex flex-col items-center gap-2">
              <div className={`flex items-center gap-2 text-sm ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Aguardando escaneamento...</span>
              </div>
              <div className={`flex items-center gap-2 text-sm mt-2 ${
                qrCodeTimer <= 5 ? 'text-red-500' : theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
                <Clock className="w-4 h-4" />
                <span>Expira em: {qrCodeTimer}s</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Estado de Exibição do Código de Telefone */}
        {phoneCode && !isConnected && !error && (
          <div className="flex flex-col items-center gap-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            <div className={`p-6 rounded-lg shadow-[0_10px_30px_-10px_hsl(0,0%,0%,0.3)] ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            } flex flex-col items-center`}>
              <h2 className="text-lg font-medium mb-2">Seu código</h2>
              <div className="text-3xl font-bold tracking-wider py-4 px-6 bg-gray-100 dark:bg-gray-700 rounded-md">
                {phoneCode}
              </div>
              <p className="text-sm mt-4 text-center max-w-xs">
                Abra o WhatsApp no seu celular e insira este código quando solicitado
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className={`flex items-center gap-2 text-sm ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Aguardando confirmação...</span>
              </div>
              <div className={`flex items-center gap-2 text-sm mt-2 ${
                qrCodeTimer <= 5 ? 'text-red-500' : theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
                <Clock className="w-4 h-4" />
                <span>Expira em: {qrCodeTimer}s</span>
              </div>
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
