import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useCRM } from '@/contexts/CRMContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Loader2, Check, AlertTriangle, RefreshCw, Clock, QrCode, Smartphone, CheckCircle2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSecureStorage } from '@/hooks/use-secure-storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const WhatsApp = () => {
  const { user } = useCRM();
  const { theme } = useTheme();
  const { setSecureItem, getSecureItem, removeSecureItem } = useSecureStorage();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phoneCode, setPhoneCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectedInfo, setConnectedInfo] = useState<{ owner?: string, name?: string, profilePicUrl?: string } | null>(null);
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
    if (!user?.token_instancia_uazapi) {
      setError('ERRO. Entre em contato com o suporte.');
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
        `https://worklivoo.uazapi.com/instance/connect`,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'token': user.token_instancia_uazapi,
          },
          body: JSON.stringify({})
        }
      );

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      const data = await response.json();
      
      // Log da resposta completa para debug
      console.log('Resposta completa da API:', data);
      
      if (data.error) {
        throw new Error(data.error);
      }

      // A API retorna o QR code (base64)
      let qrCodeData = null;
      
      // Verifica se a resposta é uma string (base64 direto)
      if (typeof data === 'string') {
        qrCodeData = data;
      }
      // Verifica se tem propriedades conhecidas para QR code
      // Suporte para resposta UAZAPI onde o QR Code está dentro do objeto instance
      else if (data.instance?.qrcode) {
        qrCodeData = data.instance.qrcode;
      }
      // Outros formatos possíveis
      else if (data.qrcode || data.base64 || data.qr) {
        qrCodeData = data.qrcode || data.base64 || data.qr;
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
        // Se não retornou QR Code, pode ser que já esteja conectando
        console.log('Nenhum QR Code retornado. Verificando status...');
        const isConnected = await checkConnectionStatus();
        if (isConnected) {
            setIsConnected(true);
            return;
        }
        console.error('Estrutura da resposta não reconhecida:', data);
        throw new Error('QR Code não encontrado na resposta da API.');
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
    if (!user?.token_instancia_uazapi) {
      console.log('Erro');
      return false;
    }

    try {
      console.log(`Verificando status da instância...`);
      
      const response = await fetch(
        `https://worklivoo.uazapi.com/instance/status`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'token': user.token_instancia_uazapi,
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
      // Ajustando para UAZAPI (geralmente open ou connected)
      // IMPORTANTE: Garantir que 'connecting' não seja considerado conectado
      
      const status = data.instance?.status || data.status?.status || data.status;
      const state = data.instance?.state || data.state;
      const isConnectedBool = data.connected === true || data.status?.connected === true;

      // Lista de status que indicam conexão bem sucedida
      const connectedStatuses = ['connected', 'open'];
      
      // Lista de status que indicam que NÃO está conectado
      const disconnectedStatuses = ['connecting', 'disconnected', 'close', 'closed'];

      let isConnectedStatus = false;

      if (isConnectedBool) {
        isConnectedStatus = true;
      } else if (status && typeof status === 'string' && connectedStatuses.includes(status)) {
        isConnectedStatus = true;
      } else if (state && typeof state === 'string' && connectedStatuses.includes(state)) {
        isConnectedStatus = true;
      }

      // Salvaguarda explícita contra status de "conectando"
      if (status === 'connecting' || state === 'connecting') {
        isConnectedStatus = false;
      }
      
      if (isConnectedStatus && data.instance) {
        setConnectedInfo({
          owner: data.instance.owner,
          name: data.instance.profileName || data.instance.name,
          profilePicUrl: data.instance.profilePicUrl
        });
      }

      console.log('Status da conexão detectado:', isConnectedStatus ? 'Conectado' : 'Desconectado');
      console.log('Detalhes do status:', { status, state, isConnectedBool, isConnectedStatus });
      
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
      if (!user?.token_instancia_uazapi) {
        setError('ERRO. Entre em contato com o suporte.');
        return;
      }

      // Sempre verifica o status atual da API primeiro
      let connected = false;
      setIsLoading(true);
      
      try {
        console.log('Verificando status atual da instância UAZAPI...');
        connected = await checkConnectionStatus();
        console.log('Status da conexão:', connected ? 'Conectado' : 'Desconectado');
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
        console.log('Erro ao verificar status inicial:', err);
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
  }, [user?.token_instancia_uazapi]);

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
    if (!user?.token_instancia_uazapi) {
      setError('ERRO. Entre em contato com o suporte.');
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
        `https://worklivoo.uazapi.com/instance/connect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': user.token_instancia_uazapi,
          },
          body: JSON.stringify({
            phone: `55${phoneNumber}`
          })
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

      // Extrai o código da resposta
      // A documentação diz: "Gera código de pareamento se passar o o campo phone"
      // Assumindo que o código vem em 'code', 'pairingCode' ou similar
      let code = null;
      if (data.instance?.paircode) {
        code = data.instance.paircode;
      } else if (data.code || data.pairingCode || data.pairing_code || data.value) {
        code = data.code || data.pairingCode || data.pairing_code || data.value;
      }
      
      if (code) {
        setPhoneCode(code.toString());
        // Inicia o temporizador de 20 segundos para o código
        startTimer('Código expirado. Aguarde para solicitar um novo.');
      } else {
        // Se não retornou código, pode ser um erro ou formato inesperado
        console.error('Código não encontrado na resposta:', data);
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
    if (user?.token_instancia_uazapi) {
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
  }, [user?.token_instancia_uazapi, isConnected]);
  
  // Limpa os temporizadores quando o componente é desmontado
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);



  // Função para desconectar o WhatsApp
  const disconnectWhatsApp = async () => {
    if (!user?.token_instancia_uazapi) {
      setError('ERRO. Entre em contato com o suporte.');
      return;
    }

    if (!window.confirm('Tem certeza que deseja desconectar o WhatsApp?')) {
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch(
        `https://worklivoo.uazapi.com/instance/disconnect`,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'token': user.token_instancia_uazapi,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      const data = await response.json();
      console.log('Resultado da desconexão:', data);
      
      // Se desconectou com sucesso ou já estava desconectado
      setIsConnected(false);
      setConnectedInfo(null);
      clearStoredState();
      
      // Força uma verificação de status após um breve delay para garantir
      setTimeout(() => {
        checkConnectionStatus();
      }, 1000);
      
    } catch (err) {
      console.error('Erro ao desconectar:', err);
      setError('Erro ao desconectar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    // Só permite tentar novamente se não estiver em cooldown
    if (cooldownTimer === 0) {
      setError(null);
      setQrCode(null);
      setPhoneCode(null);
      setIsLoading(true);
      
      // Primeiro verifica se os dados da instância estão configurados
      if (!user?.token_instancia_uazapi) {
        setError('ERRO. Entre em contato com o suporte.');
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
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold">Conectar WhatsApp</CardTitle>
        <CardDescription>Escaneie o QR Code para conectar seu número e ativar o agente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Left Side: Instructions */}
          <div className="flex-1 space-y-8">
            <div className="space-y-6">
                <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0 text-sm">1</div>
                    <div>
                        <h3 className="font-bold text-foreground">Abra o WhatsApp</h3>
                        <p className="text-sm text-muted-foreground mt-1">Abra o aplicativo no seu celular.</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0 text-sm">2</div>
                    <div>
                        <h3 className="font-bold text-foreground">Acesse o Menu</h3>
                        <p className="text-sm text-muted-foreground mt-1">Toque em Configurações ou no menu de 3 pontos.</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0 text-sm">3</div>
                    <div>
                        <h3 className="font-bold text-foreground">Aparelhos Conectados</h3>
                        <p className="text-sm text-muted-foreground mt-1">Selecione "Conectar um aparelho" e aponte a câmera.</p>
                    </div>
                </div>
            </div>

            <div className="bg-muted p-4 rounded-xl flex items-start gap-3">
                <AlertCircle className="text-muted-foreground flex-shrink-0 mt-0.5" size={20} />
                <p className="text-sm text-muted-foreground">
                    Se por algum motivo você não estiver conseguindo conectar por QR Code, selecione a opção por Código.
                </p>
            </div>
          </div>

          {/* Right Side: Action Area */}
          <div className="flex-1 flex flex-col items-center justify-center bg-muted/20 rounded-2xl p-6 border-2 border-dashed border-border relative min-h-[400px]">
              
              {/* Tabs for switching method - Only show if not connected */}
              {!isConnected && (
                <div className="w-full mb-6 max-w-sm">
                  <Tabs defaultValue={connectionMethod} onValueChange={(v) => setConnectionMethod(v as 'qrcode' | 'phone')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="qrcode">QR Code</TabsTrigger>
                      <TabsTrigger value="phone">Código</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              )}

              {/* Content based on State */}
              {isLoading ? (
                 <div className="flex flex-col items-center gap-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                    <Loader2 className="w-12 h-12 animate-spin text-primary" />
                    <p className="text-muted-foreground font-medium">
                      {connectionMethod === 'qrcode' ? 'Gerando QR Code...' : 'Gerando código...'}
                    </p>
                 </div>
              ) : isConnected ? (
                 <div className="flex flex-col items-center gap-4 text-green-600 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-2 overflow-hidden relative shadow-sm border-2 border-green-200">
                        {connectedInfo?.profilePicUrl ? (
                            <img src={connectedInfo.profilePicUrl} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <CheckCircle2 size={48} />
                        )}
                    </div>
                    <div className="text-center">
                      <span className="text-xl font-bold block text-foreground">Conectado com sucesso</span>
                      {connectedInfo?.name && (
                          <p className="text-foreground font-medium mt-2">{connectedInfo.name}</p>
                      )}
                      {connectedInfo?.owner && (
                          <p className="text-sm text-muted-foreground font-mono mt-1">
                              {connectedInfo.owner.replace(/^55/, '')}
                          </p>
                      )}
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={disconnectWhatsApp}
                        disabled={isLoading}
                        className="mt-6"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Desconectando...
                          </>
                        ) : (
                          'Desconectar'
                        )}
                      </Button>
                    </div>
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
                      className="px-6"
                    >
                        <RefreshCw className={`mr-2 w-4 h-4 ${cooldownTimer > 0 ? 'animate-spin' : ''}`} /> 
                        {cooldownTimer > 0 ? `Aguarde ${cooldownTimer}s` : 'Tentar Novamente'}
                    </Button>
                 </div>
              ) : (
                 <div className="w-full animate-in fade-in-0 slide-in-from-bottom-2 duration-300 flex flex-col items-center">
                    {connectionMethod === 'qrcode' ? (
                        <div className="flex flex-col items-center w-full">
                            <div className="bg-white p-4 rounded-xl shadow-sm mb-6 relative group w-full max-w-[260px] aspect-square flex items-center justify-center border border-border">
                                <div className="w-full h-full bg-muted/50 rounded-lg flex items-center justify-center relative overflow-hidden">
                                    {qrCode ? (
                                        <img src={qrCode} alt="QR Code" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                            <QrCode size={48} />
                                        </div>
                                    )}
                                    
                                    {/* Overlay for generation/regeneration */}
                                    {(!qrCode || qrCodeTimer <= 0) && (
                                        <div 
                                            className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center cursor-pointer hover:bg-background/90 transition-all z-10"
                                            onClick={handleConnect}
                                        >
                                            <RefreshCw className="text-primary mb-2" size={32} />
                                            <span className="font-bold text-sm text-center px-4 text-foreground">
                                              {cooldownTimer > 0 ? `Aguarde ${cooldownTimer}s` : 'Gerar Novo Código'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {qrCode && (
                                <div className="flex items-center gap-2 text-orange-600 bg-orange-50 border border-orange-100 px-4 py-2 rounded-full">
                                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                                    <span className="text-sm font-bold">Expira em {qrCodeTimer}s</span>
                                </div>
                            )}
                            
                            {!qrCode && (
                               <div className="flex items-center gap-2 text-muted-foreground bg-muted px-4 py-2 rounded-full">
                                  <span className="text-sm font-medium">Aguardando geração...</span>
                               </div>
                            )}
                        </div>
                    ) : (
                        <div className="w-full max-w-sm space-y-4">
                            {phoneCode ? (
                                 <div className="bg-card p-6 rounded-xl shadow-sm text-center border border-border">
                                    <p className="text-sm text-muted-foreground mb-2 font-medium">Seu código de conexão</p>
                                    <div className="text-4xl font-black tracking-widest my-6 text-primary bg-muted/50 py-4 rounded-xl">
                                        {phoneCode}
                                    </div>
                                    <div className="flex items-center justify-center gap-2 text-orange-600 text-sm font-bold bg-orange-50 border border-orange-100 py-2 rounded-lg">
                                        <Clock size={16} />
                                        <span>Expira em {qrCodeTimer}s</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-4">Digite este código no seu WhatsApp</p>
                                 </div>
                            ) : (
                                <div className="space-y-4 bg-card p-6 rounded-xl shadow-sm border border-border">
                                    <div className="space-y-2">
                                        <Label>Número de WhatsApp</Label>
                                        <div className="flex shadow-sm rounded-lg overflow-hidden border border-input focus-within:ring-2 focus-within:ring-ring">
                                            <div className="bg-muted px-4 py-2 flex items-center text-muted-foreground text-sm font-medium border-r border-input">+55</div>
                                            <Input 
                                                value={phoneNumber}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/\D/g, '');
                                                    setPhoneNumber(value);
                                                }}
                                                placeholder="11999999999"
                                                className="rounded-l-none border-0 focus-visible:ring-0 h-auto py-2"
                                                maxLength={11}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">DDD + Número (Ex: 11999999999)</p>
                                    </div>
                                    <Button 
                                        onClick={handleConnect} 
                                        disabled={!phoneNumber || phoneNumber.length < 10 || cooldownTimer > 0}
                                        className="w-full h-10"
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
      </CardContent>
    </Card>
  );
};

export default WhatsApp;
