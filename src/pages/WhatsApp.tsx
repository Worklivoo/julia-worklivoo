import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useCRM } from '@/contexts/CRMContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Loader2, Check, AlertTriangle, RefreshCw, Clock, QrCode, Smartphone, CheckCircle2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSecureStorage } from '@/hooks/use-secure-storage';

const WhatsApp = () => {
  const { user } = useCRM();
  const { theme } = useTheme();
  const { setSecureItem, getSecureItem, removeSecureItem } = useSecureStorage();
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

  // Função para salvar o estado atual no localStorage com segurança
  const saveStateToStorage = () => {
    try {
      // Salva dados sensíveis com criptografia (QR codes e phone codes)
      if (qrCode) setSecureItem(STORAGE_KEYS.QR_CODE, qrCode, true);
      else removeSecureItem(STORAGE_KEYS.QR_CODE);
      
      if (phoneCode) setSecureItem(STORAGE_KEYS.PHONE_CODE, phoneCode, true);
      else removeSecureItem(STORAGE_KEYS.PHONE_CODE);
      
      // Dados menos sensíveis podem ser salvos sem criptografia
      setSecureItem(STORAGE_KEYS.PHONE_NUMBER, phoneNumber, false);
      setSecureItem(STORAGE_KEYS.IS_CONNECTED, JSON.stringify(isConnected), false);
      
      if (error) setSecureItem(STORAGE_KEYS.ERROR, error, false);
      else removeSecureItem(STORAGE_KEYS.ERROR);
      
      setSecureItem(STORAGE_KEYS.QR_CODE_TIMER, qrCodeTimer.toString(), false);
      setSecureItem(STORAGE_KEYS.COOLDOWN_TIMER, cooldownTimer.toString(), false);
      setSecureItem(STORAGE_KEYS.CONNECTION_METHOD, connectionMethod, false);
      setSecureItem(STORAGE_KEYS.TIMESTAMP, Date.now().toString(), false);
      
      console.log('Estado salvo no localStorage com segurança');
    } catch (err) {
      console.error('Erro ao salvar estado no localStorage:', err);
    }
  };

  // Função para limpar o localStorage
  const clearStoredState = () => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        removeSecureItem(key);
      });
      console.log('Estado do localStorage limpo');
    } catch (err) {
      console.error('Erro ao limpar localStorage:', err);
    }
  };

  // Função para restaurar o estado do localStorage
  const restoreStateFromStorage = () => {
    try {
      const storedTimestamp = getSecureItem(STORAGE_KEYS.TIMESTAMP, 30 * 60 * 1000); // 30 minutos
      
      // Se não houver timestamp ou se passaram mais de 30 minutos, limpa o localStorage e não restaura
      if (!storedTimestamp) {
        clearStoredState();
        return false;
      }
      
      const storedQrCode = getSecureItem(STORAGE_KEYS.QR_CODE, 30 * 60 * 1000);
      const storedPhoneCode = getSecureItem(STORAGE_KEYS.PHONE_CODE, 30 * 60 * 1000);
      const storedPhoneNumber = getSecureItem(STORAGE_KEYS.PHONE_NUMBER, 30 * 60 * 1000);
      // Não restauramos o status de conexão do localStorage, pois já foi verificado pela API
      const storedError = getSecureItem(STORAGE_KEYS.ERROR, 30 * 60 * 1000);
      const storedQrCodeTimer = getSecureItem(STORAGE_KEYS.QR_CODE_TIMER, 30 * 60 * 1000);
      const storedCooldownTimer = getSecureItem(STORAGE_KEYS.COOLDOWN_TIMER, 30 * 60 * 1000);
      const storedConnectionMethod = getSecureItem(STORAGE_KEYS.CONNECTION_METHOD, 30 * 60 * 1000) as 'qrcode' | 'phone';
      
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
          setSecureItem(STORAGE_KEYS.IS_CONNECTED, JSON.stringify(true), false);
          setSecureItem(STORAGE_KEYS.TIMESTAMP, Date.now().toString(), false);
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
          setSecureItem(STORAGE_KEYS.IS_CONNECTED, JSON.stringify(true), false);
          setSecureItem(STORAGE_KEYS.TIMESTAMP, Date.now().toString(), false);
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



  const handleRetry = async () => {
    // Só permite tentar novamente se não estiver em cooldown
    if (cooldownTimer === 0) {
      setError(null);
      setQrCode(null);
      setPhoneCode(null);
      setIsLoading(true);
      
      // Primeiro verifica se os dados da instância estão configurados
      if (!user?.id_instancia_zapi || !user?.token_instancia_zapi) {
        setError('Dados de instância do WhatsApp não configurados. Entre em contato com o suporte.');
        setIsLoading(false);
        return;
      }
      
      try {
        // Verifica o status atual da instância antes de tentar conectar
        console.log('Verificando status da instância antes de tentar novamente...');
        const connected = await checkConnectionStatus();
        
        if (connected) {
          // Se já estiver conectado, atualiza o estado
          setIsConnected(true);
          setError(null);
          setIsLoading(false);
          return;
        }
        
        // Se não estiver conectado, tenta conectar novamente
        if (connectionMethod === 'qrcode') {
          connectWhatsAppQR();
        } else {
          connectWhatsAppPhone();
        }
      } catch (err) {
        console.error('Erro ao verificar status durante retry:', err);
        setError('Erro ao verificar status da instância. Verifique sua conexão e tente novamente.');
        setIsLoading(false);
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
      <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 max-w-4xl w-full flex flex-col md:flex-row gap-12">
        
        {/* Left Side: Instructions */}
        <div className="flex-1 space-y-8">
            <div>
                <h2 className="text-2xl font-bold mb-2">Conectar WhatsApp</h2>
                <p className="text-gray-500">Escaneie o QR Code para conectar seu número e ativar o agente.</p>
            </div>

            <div className="space-y-6">
                <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold flex-shrink-0">1</div>
                    <div>
                        <h3 className="font-bold text-gray-900">Abra o WhatsApp</h3>
                        <p className="text-sm text-gray-500 mt-1">Abra o aplicativo no seu celular.</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold flex-shrink-0">2</div>
                    <div>
                        <h3 className="font-bold text-gray-900">Acesse o Menu</h3>
                        <p className="text-sm text-gray-500 mt-1">Toque em Configurações ou no menu de 3 pontos.</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold flex-shrink-0">3</div>
                    <div>
                        <h3 className="font-bold text-gray-900">Aparelhos Conectados</h3>
                        <p className="text-sm text-gray-500 mt-1">Selecione "Conectar um aparelho" e aponte a câmera.</p>
                    </div>
                </div>
            </div>

            <div className="bg-brand-bg p-4 rounded-xl flex items-start gap-3">
                <AlertCircle className="text-black flex-shrink-0 mt-0.5" size={20} />
                <p className="text-sm text-gray-600">
                    Mantenha o celular conectado à internet para que o agente possa responder automaticamente.
                </p>
            </div>
        </div>

        {/* Right Side: Action Area */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 rounded-2xl p-8 border-2 border-dashed border-gray-200 relative min-h-[400px]">
            
            {/* Tabs for switching method - Only show if not connected */}
            {!isConnected && (
              <div className="w-full mb-6">
                <Tabs defaultValue={connectionMethod} onValueChange={(v) => setConnectionMethod(v as 'qrcode' | 'phone')} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-white/50 p-1 rounded-xl">
                    <TabsTrigger value="qrcode" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">QR Code</TabsTrigger>
                    <TabsTrigger value="phone" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Telefone</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {/* Content based on State */}
            {isLoading ? (
               <div className="flex flex-col items-center gap-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                  <Loader2 className="w-12 h-12 animate-spin text-brand-primary" />
                  <p className="text-gray-500 font-medium">
                    {connectionMethod === 'qrcode' ? 'Gerando QR Code...' : 'Gerando código...'}
                  </p>
               </div>
            ) : isConnected ? (
               <div className="flex flex-col items-center gap-4 text-green-600 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-2">
                      <CheckCircle2 size={40} />
                  </div>
                  <span className="text-xl font-bold">Conectado com sucesso</span>
               </div>
            ) : error ? (
               <div className="flex flex-col items-center gap-4 text-center animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-2 text-red-500">
                      <AlertTriangle size={32} />
                  </div>
                  <p className="text-red-500 text-sm font-medium max-w-xs">{error}</p>
                  <Button 
                    onClick={handleRetry} 
                    disabled={cooldownTimer > 0}
                    className="bg-black text-white hover:bg-gray-800 rounded-xl px-6 py-2 h-auto"
                  >
                      <RefreshCw className={`mr-2 w-4 h-4 ${cooldownTimer > 0 ? 'animate-spin' : ''}`} /> 
                      {cooldownTimer > 0 ? `Aguarde ${cooldownTimer}s` : 'Tentar Novamente'}
                  </Button>
               </div>
            ) : (
               <div className="w-full animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                  {connectionMethod === 'qrcode' ? (
                      <div className="flex flex-col items-center w-full">
                          <div className="bg-white p-4 rounded-xl shadow-sm mb-6 relative group w-full max-w-[280px] aspect-square flex items-center justify-center">
                              <div className="w-full h-full bg-gray-900 rounded-lg flex items-center justify-center relative overflow-hidden">
                                  {qrCode ? (
                                      <img src={qrCode} alt="QR Code" className="w-full h-full object-cover" />
                                  ) : (
                                      <div className="absolute inset-0 bg-gray-100 flex items-center justify-center text-gray-400">
                                          <QrCode size={48} />
                                      </div>
                                  )}
                                  
                                  {/* Overlay for generation/regeneration */}
                                  {(!qrCode || qrCodeTimer <= 0) && (
                                      <div 
                                          className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center cursor-pointer hover:bg-white/90 transition-all z-10"
                                          onClick={handleConnect}
                                      >
                                          <RefreshCw className="text-black mb-2" size={32} />
                                          <span className="font-bold text-sm text-center px-4">
                                            {cooldownTimer > 0 ? `Aguarde ${cooldownTimer}s` : 'Gerar Novo Código'}
                                          </span>
                                      </div>
                                  )}
                              </div>
                          </div>
                          
                          {qrCode && (
                              <div className="flex items-center gap-2 text-orange-500 bg-orange-50 px-4 py-2 rounded-full">
                                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                                  <span className="text-sm font-bold">Expira em {qrCodeTimer}s</span>
                              </div>
                          )}
                          
                          {!qrCode && (
                             <div className="flex items-center gap-2 text-gray-400 bg-gray-100 px-4 py-2 rounded-full">
                                <span className="text-sm font-bold">Aguardando geração...</span>
                             </div>
                          )}
                      </div>
                  ) : (
                      <div className="w-full space-y-4">
                          {phoneCode ? (
                               <div className="bg-white p-6 rounded-xl shadow-sm text-center border border-gray-100">
                                  <p className="text-sm text-gray-500 mb-2 font-medium">Seu código de conexão</p>
                                  <div className="text-4xl font-black tracking-widest my-6 text-brand-primary bg-black py-4 rounded-xl">
                                      {phoneCode}
                                  </div>
                                  <div className="flex items-center justify-center gap-2 text-orange-500 text-sm font-bold bg-orange-50 py-2 rounded-lg">
                                      <Clock size={16} />
                                      <span>Expira em {qrCodeTimer}s</span>
                                  </div>
                                  <p className="text-xs text-gray-400 mt-4">Digite este código no seu WhatsApp</p>
                               </div>
                          ) : (
                              <div className="space-y-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                  <div className="space-y-2">
                                      <Label className="font-bold text-gray-700">Número de WhatsApp</Label>
                                      <div className="flex shadow-sm rounded-lg overflow-hidden">
                                          <div className="bg-gray-100 border-r border-gray-200 px-4 py-3 flex items-center text-gray-600 text-sm font-bold">+55</div>
                                          <Input 
                                              value={phoneNumber}
                                              onChange={(e) => {
                                                  const value = e.target.value.replace(/\D/g, '');
                                                  setPhoneNumber(value);
                                              }}
                                              placeholder="11999999999"
                                              className="rounded-l-none border-0 ring-1 ring-gray-200 focus-visible:ring-2 focus-visible:ring-brand-primary h-auto py-3"
                                              maxLength={11}
                                          />
                                      </div>
                                      <p className="text-xs text-gray-400 font-medium">DDD + Número (Ex: 11999999999)</p>
                                  </div>
                                  <Button 
                                      onClick={handleConnect} 
                                      disabled={!phoneNumber || phoneNumber.length < 10 || cooldownTimer > 0}
                                      className="w-full bg-black text-white hover:bg-gray-800 font-bold rounded-xl h-12 transition-all shadow-lg shadow-black/10"
                                  >
                                      {cooldownTimer > 0 ? `Aguarde ${cooldownTimer}s` : 'Obter Código'}
                                  </Button>
                              </div>
                          )}
                      </div>
                  )}
               </div>
            )}

        </div>

      </div>
    </div>
  );
};

export default WhatsApp;
