import React, { useState, useEffect, useRef } from 'react';
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
  const [connectionMethod, setConnectionMethod] = useState<'qrcode' | 'phone'>('qrcode');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);
  
  // Chaves para localStorage
  const STORAGE_KEYS = {
    QR_CODE: 'whatsapp_qr_code',
    PHONE_CODE: 'whatsapp_phone_code',
    PHONE_NUMBER: 'whatsapp_phone_number',
    IS_CONNECTED: 'whatsapp_is_connected',
    ERROR: 'whatsapp_error',
    QR_CODE_TIMER: 'whatsapp_qr_code_timer',
    COOLDOWN_TIMER: 'whatsapp_cooldown_timer',
    CONNECTION_METHOD: 'whatsapp_connection_method',
    TIMESTAMP: 'whatsapp_timestamp'
  };


  const connectWhatsAppQR = async () => {
    if (!user?.id_instancia_zapi || !user?.token_instancia_zapi) {
      setError('Dados de instância do WhatsApp não configurados. Entre em contato com o suporte.');
      return;
    }
    
    // Verifica se está em cooldown
    if (cooldownTimer > 0) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setQrCode(null);
    setPhoneCode(null);

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
        
        // Inicia o temporizador de 20 segundos para o QR Code
        startTimer('QR Code expirado. Aguarde para solicitar um novo.');
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
      console.log('Dados de instância Z-API não configurados');
      return false;
    }

    try {
      console.log(`Verificando status da instância ${user.id_instancia_zapi}...`);
      
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
        console.error(`Erro na resposta da API: ${response.status} ${response.statusText}`);
        return false;
      }

      const data = await response.json();
      console.log('Resposta completa do status da conexão:', data);
      
      // Verifica se está conectado (diferentes formatos possíveis)
      const isConnectedStatus = data.connected || data.status === 'connected' || 
                               data.state === 'connected' || data.instance?.status === 'connected';
      
      console.log('Status da conexão detectado:', isConnectedStatus ? 'Conectado' : 'Desconectado');
      console.log('Detalhes do status:', {
        connected: data.connected,
        status: data.status,
        state: data.state,
        instanceStatus: data.instance?.status
      });
      
      return isConnectedStatus;
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      return false;
    }
  };

  // Função para salvar o estado atual no localStorage
  const saveStateToStorage = () => {
    try {
      // Salva o estado atual
      if (qrCode) localStorage.setItem(STORAGE_KEYS.QR_CODE, qrCode);
      else localStorage.removeItem(STORAGE_KEYS.QR_CODE);
      
      if (phoneCode) localStorage.setItem(STORAGE_KEYS.PHONE_CODE, phoneCode);
      else localStorage.removeItem(STORAGE_KEYS.PHONE_CODE);
      
      localStorage.setItem(STORAGE_KEYS.PHONE_NUMBER, phoneNumber);
      localStorage.setItem(STORAGE_KEYS.IS_CONNECTED, JSON.stringify(isConnected));
      
      if (error) localStorage.setItem(STORAGE_KEYS.ERROR, error);
      else localStorage.removeItem(STORAGE_KEYS.ERROR);
      
      localStorage.setItem(STORAGE_KEYS.QR_CODE_TIMER, qrCodeTimer.toString());
      localStorage.setItem(STORAGE_KEYS.COOLDOWN_TIMER, cooldownTimer.toString());
      localStorage.setItem(STORAGE_KEYS.CONNECTION_METHOD, connectionMethod);
      localStorage.setItem(STORAGE_KEYS.TIMESTAMP, Date.now().toString());
      
      console.log('Estado salvo no localStorage');
    } catch (err) {
      console.error('Erro ao salvar estado no localStorage:', err);
    }
  };

  // Função para limpar o localStorage
  const clearStoredState = () => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      console.log('Estado do localStorage limpo');
    } catch (err) {
      console.error('Erro ao limpar localStorage:', err);
    }
  };

  // Função para restaurar o estado do localStorage
  const restoreStateFromStorage = () => {
    try {
      const storedTimestamp = localStorage.getItem(STORAGE_KEYS.TIMESTAMP);
      
      // Se não houver timestamp ou se passaram mais de 30 minutos, limpa o localStorage e não restaura
      if (!storedTimestamp || Date.now() - parseInt(storedTimestamp) > 30 * 60 * 1000) {
        clearStoredState();
        return false;
      }
      
      const storedQrCode = localStorage.getItem(STORAGE_KEYS.QR_CODE);
      const storedPhoneCode = localStorage.getItem(STORAGE_KEYS.PHONE_CODE);
      const storedPhoneNumber = localStorage.getItem(STORAGE_KEYS.PHONE_NUMBER);
      // Não restauramos o status de conexão do localStorage, pois já foi verificado pela API
      const storedError = localStorage.getItem(STORAGE_KEYS.ERROR);
      const storedQrCodeTimer = localStorage.getItem(STORAGE_KEYS.QR_CODE_TIMER);
      const storedCooldownTimer = localStorage.getItem(STORAGE_KEYS.COOLDOWN_TIMER);
      const storedConnectionMethod = localStorage.getItem(STORAGE_KEYS.CONNECTION_METHOD) as 'qrcode' | 'phone';
      
      console.log('Restaurando estado do localStorage');
      
      // Restaura os estados
      if (storedQrCode && storedQrCode !== '') setQrCode(storedQrCode);
      if (storedPhoneCode && storedPhoneCode !== '') setPhoneCode(storedPhoneCode);
      if (storedPhoneNumber) setPhoneNumber(storedPhoneNumber);
      // Não restauramos o status de conexão, pois já foi verificado pela API
      if (storedError && storedError !== '') setError(storedError);
      if (storedQrCodeTimer) setQrCodeTimer(parseInt(storedQrCodeTimer));
      if (storedCooldownTimer) setCooldownTimer(parseInt(storedCooldownTimer));
      if (storedConnectionMethod) setConnectionMethod(storedConnectionMethod);
      
      // Se tiver um QR code ou código de telefone ativo e o timer ainda não expirou, reinicia o timer
      if ((storedQrCode || storedPhoneCode) && parseInt(storedQrCodeTimer) > 0) {
        // Calcula quanto tempo já passou desde que o estado foi salvo
        const elapsedTime = Math.floor((Date.now() - parseInt(storedTimestamp)) / 1000);
        const remainingTime = Math.max(0, parseInt(storedQrCodeTimer) - elapsedTime);
        
        if (remainingTime > 0) {
          setQrCodeTimer(remainingTime);
          startTimer('Código expirado. Aguarde para solicitar um novo.');
        } else {
          // Se o tempo já expirou, limpa os códigos
          setQrCode(null);
          setPhoneCode(null);
        }
      }
      
      // Se estiver em cooldown, reinicia o timer de cooldown
      if (parseInt(storedCooldownTimer) > 0) {
        const elapsedTime = Math.floor((Date.now() - parseInt(storedTimestamp)) / 1000);
        const remainingCooldown = Math.max(0, parseInt(storedCooldownTimer) - elapsedTime);
        
        if (remainingCooldown > 0) {
          setCooldownTimer(remainingCooldown);
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          cooldownRef.current = setInterval(() => {
            setCooldownTimer(prev => {
              if (prev <= 1) {
                if (cooldownRef.current) clearInterval(cooldownRef.current);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
      }
      
      return true;
    } catch (err) {
      console.error('Erro ao restaurar estado do localStorage:', err);
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

      // Sempre verifica o status atual da API primeiro
      let connected = false;
      setIsLoading(true);
      
      try {
        console.log('Verificando status atual da instância Z-API...');
        connected = await checkConnectionStatus();
        console.log('Status da conexão Z-API:', connected ? 'Conectado' : 'Desconectado');
        setIsConnected(connected);
        
        // Se estiver conectado, não precisamos restaurar o estado
        if (connected) {
          setQrCode(null);
          setPhoneCode(null);
          setError(null);
          // Salva apenas o estado de conexão
          localStorage.setItem(STORAGE_KEYS.IS_CONNECTED, JSON.stringify(true));
          localStorage.setItem(STORAGE_KEYS.TIMESTAMP, Date.now().toString());
          return;
        }
      } catch (err) {
        console.error('Erro ao verificar status inicial:', err);
        // Em caso de erro na verificação, assume como desconectado
        setIsConnected(false);
      } finally {
        setIsLoading(false);
      }
      
      // Se não estiver conectado, tenta restaurar o estado do localStorage
      // para manter a experiência do usuário (QR code, código de telefone, etc.)
      if (!connected) {
        restoreStateFromStorage();
      }
    };

    verifyInitialStatus();
  }, [user?.id_instancia_zapi, user?.token_instancia_zapi]);

  // Função para iniciar o temporizador (usado tanto para QR Code quanto para código de telefone)
  const startTimer = (expirationMessage: string) => {
    setQrCodeTimer(20);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(() => {
      setQrCodeTimer(prev => {
        if (prev <= 1) {
          // Quando o timer chega a zero, limpa o código e inicia o cooldown
          if (timerRef.current) clearInterval(timerRef.current);
          setQrCode(null);
          setPhoneCode(null);
          setError(null); // Não mostra mensagem de erro, apenas retorna para a tela de seleção
          
          // Inicia o cooldown de 15 segundos
          setCooldownTimer(15);
          if (cooldownRef.current) {
            clearInterval(cooldownRef.current);
          }
          cooldownRef.current = setInterval(() => {
            setCooldownTimer(prev => {
              if (prev <= 1) {
                if (cooldownRef.current) clearInterval(cooldownRef.current);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
          
          // Salva o estado atualizado
          saveStateToStorage();
          
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Salva o estado quando inicia o timer
    saveStateToStorage();
  };

  // Função para conectar via código de telefone
  const connectWhatsAppPhone = async () => {
    if (!user?.id_instancia_zapi || !user?.token_instancia_zapi) {
      setError('Dados de instância do WhatsApp não configurados. Entre em contato com o suporte.');
      return;
    }
    
    // Verifica se está em cooldown
    if (cooldownTimer > 0) {
      return;
    }

    // Validação do número de telefone
    if (!phoneNumber || phoneNumber.length < 10 || phoneNumber.length > 11) {
      setError('Por favor, insira um número de telefone válido com DDD (ex: 11999999999)');
      return;
    }

    setIsLoading(true);
    setError(null);
    setPhoneCode(null);
    setQrCode(null);

    try {
      const response = await fetch(
        `https://api.z-api.io/instances/${user.id_instancia_zapi}/token/${user.token_instancia_zapi}/phone-code/55${phoneNumber}`,
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
      
      console.log('Resposta da API de código por telefone:', data);
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Extrai o código da resposta (pode variar dependendo da estrutura da resposta)
      let code = null;
      if (data.code || data.phoneCode || data.value) {
        code = data.code || data.phoneCode || data.value;
      } else if (data.data) {
        code = data.data;
      }
      
      if (code) {
        setPhoneCode(code.toString());
        // Inicia o temporizador de 20 segundos para o código
        startTimer('Código expirado. Aguarde para solicitar um novo.');
      } else {
        throw new Error('Código não encontrado na resposta da API.');
      }
    } catch (err) {
      console.error('Erro ao obter código por telefone:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao obter código');
    } finally {
      setIsLoading(false);
    }
  };

  // Polling para verificar o status da conexão do WhatsApp (tanto para conectar quanto para detectar desconexões)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    // Sempre verifica o status, independentemente do estado atual
    // Isso permite detectar tanto conexões quanto desconexões
    if (user?.id_instancia_zapi && user?.token_instancia_zapi) {
      interval = setInterval(async () => {
        console.log('Verificando status da conexão...');
        const connected = await checkConnectionStatus();
        console.log('Status atual:', connected ? 'Conectado' : 'Desconectado');
        
        // Se o status mudou para conectado
        if (connected && !isConnected) {
          console.log('WhatsApp conectado com sucesso!');
          setIsConnected(true);
          setQrCode(null);
          setPhoneCode(null);
          setError(null);
          setIsLoading(false);
          
          // Limpa os temporizadores quando conectado
          if (timerRef.current) clearInterval(timerRef.current);
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          
          // Quando conectado com sucesso, limpa o localStorage pois não precisamos mais do estado
          clearStoredState();
          
          // Salva apenas o estado de conexão
          localStorage.setItem(STORAGE_KEYS.IS_CONNECTED, JSON.stringify(true));
          localStorage.setItem(STORAGE_KEYS.TIMESTAMP, Date.now().toString());
        }
        // Se o status mudou para desconectado
        else if (!connected && isConnected) {
          console.log('WhatsApp desconectado!');
          setIsConnected(false);
          clearStoredState(); // Limpa o estado armazenado
        }
      }, 5000); // Verifica a cada 5 segundos
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [user?.id_instancia_zapi, user?.token_instancia_zapi, isConnected]);
  
  // Limpa os temporizadores quando o componente é desmontado
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);



  const handleRetry = () => {
    // Só permite tentar novamente se não estiver em cooldown
    if (cooldownTimer === 0) {
      setError(null);
      setQrCode(null);
      setPhoneCode(null);
      
      if (connectionMethod === 'qrcode') {
        connectWhatsAppQR();
      } else {
        connectWhatsAppPhone();
      }
      
      // Salva o estado atualizado
      saveStateToStorage();
    }
  };
  
  const handleConnect = () => {
    if (connectionMethod === 'qrcode') {
      connectWhatsAppQR();
    } else {
      connectWhatsAppPhone();
    }
    
    // Salva o estado atualizado
    saveStateToStorage();
  };
  
  // Salva o estado sempre que houver mudanças relevantes
  useEffect(() => {
    saveStateToStorage();
  }, [qrCode, phoneCode, phoneNumber, isConnected, error, qrCodeTimer, cooldownTimer, connectionMethod]);

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
            
            <Tabs 
              defaultValue="qrcode" 
              className="w-full" 
              onValueChange={(value) => setConnectionMethod(value as 'qrcode' | 'phone')}
            >
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
                    onClick={handleConnect}
                    disabled={cooldownTimer > 0}
                    className={`px-8 py-3 bg-[hsl(60,85%,73%)] hover:bg-[hsl(60,85%,68%)] text-black font-medium rounded-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_-2px_hsl(60,85%,73%,0.3)] active:translate-y-0 active:shadow-[0_2px_8px_-2px_hsl(60,85%,73%,0.2)] ${cooldownTimer > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {cooldownTimer > 0 ? `Aguarde ${cooldownTimer}s` : 'Gerar QR Code'}
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="phone" className="mt-4">
                <div className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone-number">Número de telefone (apenas DDD + número)</Label>
                    <div className="flex items-center">
                      <div className="bg-muted px-3 py-2 rounded-l-md border border-r-0 border-input">
                        +55
                      </div>
                      <Input 
                        id="phone-number" 
                        type="tel" 
                        placeholder="11999999999" 
                        className="rounded-l-none" 
                        value={phoneNumber}
                        onChange={(e) => {
                          // Permite apenas números
                          const value = e.target.value.replace(/\D/g, '');
                          setPhoneNumber(value);
                        }}
                        maxLength={11}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Ex: 11999999999 (sem o +55)</p>
                  </div>
                  
                  <Button 
                    onClick={handleConnect}
                    disabled={cooldownTimer > 0 || !phoneNumber || phoneNumber.length < 10}
                    className={`px-8 py-3 bg-[hsl(60,85%,73%)] hover:bg-[hsl(60,85%,68%)] text-black font-medium rounded-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_-2px_hsl(60,85%,73%,0.3)] active:translate-y-0 active:shadow-[0_2px_8px_-2px_hsl(60,85%,73%,0.2)] ${(cooldownTimer > 0 || !phoneNumber || phoneNumber.length < 10) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {cooldownTimer > 0 ? `Aguarde ${cooldownTimer}s` : 'Obter Código'}
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
              {connectionMethod === 'qrcode' ? 'Gerando QR Code...' : 'Gerando código por telefone...'}
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
              <div className="mt-2 flex items-center justify-center gap-2 text-sm font-medium">
                <Clock className="w-4 h-4" />
                <span className={`${qrCodeTimer <= 5 ? 'text-red-500' : ''}`}>
                  Expira em {qrCodeTimer}s
                </span>
              </div>
            </div>
            <div className={`flex items-center gap-2 text-sm ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Aguardando escaneamento...</span>
            </div>
          </div>
        )}
        
        {/* Estado de Exibição do Código por Telefone */}
        {phoneCode && !isConnected && !error && (
          <div className="flex flex-col items-center gap-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            <div className={`p-6 rounded-lg shadow-[0_10px_30px_-10px_hsl(0,0%,0%,0.3)] ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            } text-center`}>
              <h2 className="text-lg font-medium mb-2">Seu código de conexão</h2>
              <div className="text-4xl font-bold tracking-wider my-4 bg-muted/30 py-4 px-6 rounded-md">
                {phoneCode}
              </div>
              <p className="text-sm mb-4">Digite este código no seu WhatsApp</p>
              <div className="flex items-center justify-center gap-2 text-sm font-medium">
                <Clock className="w-4 h-4" />
                <span className={`${qrCodeTimer <= 5 ? 'text-red-500' : ''}`}>
                  Expira em {qrCodeTimer}s
                </span>
              </div>
            </div>
            <div className={`flex items-center gap-2 text-sm ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Aguardando confirmação...</span>
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
              disabled={cooldownTimer > 0}
              className={`px-6 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white rounded-lg transition-all duration-300 flex items-center gap-2 ${cooldownTimer > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <RefreshCw className="w-4 h-4" />
              {cooldownTimer > 0 ? `Aguarde ${cooldownTimer}s` : 'Tentar Novamente'}
            </Button>
          </div>
        )}


      </div>
    </div>
  );
};

export default WhatsApp;
