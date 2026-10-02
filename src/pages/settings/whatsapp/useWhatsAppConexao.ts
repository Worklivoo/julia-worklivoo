import { useEffect, useMemo, useRef, useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useSecureStorage } from '@/hooks/use-secure-storage';
import { getUserProfile } from '@/lib/supabase-utils';
import { CITY_BY_VALUE, CITY_OPTIONS, normalizeCitySearch, type WhatsAppCity } from './cities';

/**
 * Conexão do WhatsApp comum (UAZAPI): gera QR Code ou código de pareamento, acompanha o status da
 * instância, controla os temporizadores (validade e cooldown), guarda o estado por 30 minutos e desconecta.
 */
export const useWhatsAppConexao = () => {
  const { user } = useCRM();
  const { setSecureItem, getSecureItem, removeSecureItem } = useSecureStorage();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phoneCode, setPhoneCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [cityDialogOpen, setCityDialogOpen] = useState(false);
  const [cityDialogQuery, setCityDialogQuery] = useState<string>('');
  const [cityDialogSelected, setCityDialogSelected] = useState<WhatsAppCity | null>(null);
  const [userEmpresa, setUserEmpresa] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectedInfo, setConnectedInfo] = useState<{ owner?: string, name?: string, profilePicUrl?: string } | null>(null);
  const [connectedCity, setConnectedCity] = useState<{ label: string; value: string; state?: string; stateLabel?: string } | null>(null);
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
    CITY: 'whatsapp_selected_city',
    IS_CONNECTED: 'whatsapp_is_connected',
    ERROR: 'whatsapp_error',
    QR_CODE_TIMER: 'whatsapp_qr_code_timer',
    COOLDOWN_TIMER: 'whatsapp_cooldown_timer',
    CONNECTION_METHOD: 'whatsapp_connection_method',
    TIMESTAMP: 'whatsapp_timestamp'
  };

  const resolveBaseUserId = () => {
    const rawUser = user as any;
    const baseUserId = rawUser?.isMembro ? String(rawUser?.user_id_empresa || '').trim() : String(rawUser?.id || '').trim();
    return baseUserId;
  };

  useEffect(() => {
    const run = async () => {
      const baseUserId = resolveBaseUserId();
      if (!baseUserId) return;
      try {
        const profile = await getUserProfile(baseUserId);
        const empresa = String((profile as any)?.user_empresa ?? '').trim();
        if (empresa) setUserEmpresa(empresa);
      } catch {
        // noop
      }
    };
    run();
  }, [user?.id]);

  const resolveSystemName = async () => {
    const localEmpresa = String(userEmpresa || '').trim();
    if (localEmpresa) return `Worklivoo ${localEmpresa}`.trim();

    const baseUserId = resolveBaseUserId();
    if (baseUserId) {
      try {
        const profile = await getUserProfile(baseUserId);
        const empresa = String((profile as any)?.user_empresa ?? '').trim();
        if (empresa) {
          setUserEmpresa(empresa);
          return `Worklivoo ${empresa}`.trim();
        }
      } catch {
        // noop
      }
    }

    return 'Worklivoo';
  };

  const connectWhatsAppQR = async (city: string) => {
    if (!user?.token_instancia_uazapi) {
      setError('ERRO. Entre em contato com o suporte.');
      return;
    }
    
    // Verifica se está em cooldown
    if (cooldownTimer > 0) {
      return;
    }

    const cityValue = String(city || '').trim();
    if (!cityValue) {
      setError('Selecione a cidade antes de gerar o QR Code.');
      return;
    }
    const cityObj = CITY_BY_VALUE.get(cityValue) ?? null;
    if (!cityObj) {
      setError('Selecione uma cidade válida antes de gerar o QR Code.');
      return;
    }
    if (!String(cityObj.state || '').trim()) {
      setError('Selecione uma cidade válida antes de gerar o QR Code.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setQrCode(null);
    setPhoneCode(null);

    try {
      const systemName = await resolveSystemName();
      const response = await fetch(
        `https://worklivoo.uazapi.com/instance/connect`,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'token': user.token_instancia_uazapi,
          },
          body: JSON.stringify({
            browser: 'auto',
            systemName,
            proxy_managed_country: 'br',
            proxy_managed_state: cityObj.state,
            proxy_managed_city: cityObj.value,
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      const data = await response.json();
      
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
        setQrCode(qrCodeImage);
        
        // Inicia o temporizador de 20 segundos para o QR Code
        startTimer();
      } else {
        // Se não retornou QR Code, pode ser que já esteja conectando
        const isConnected = await checkConnectionStatus();
        if (isConnected) {
            setIsConnected(true);
            return;
        }
        throw new Error('QR Code não encontrado na resposta da API.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao conectar WhatsApp');
    } finally {
      setIsLoading(false);
    }
  };

  // Verificar status da conexão
  const checkConnectionStatus = async () => {
    if (!user?.token_instancia_uazapi) {
      return false;
    }

    try {
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
        return false;
      }

      const data = await response.json();
      
      // Verifica se está conectado (diferentes formatos possíveis)
      // Ajustando para UAZAPI (geralmente open ou connected)
      // IMPORTANTE: Garantir que 'connecting' não seja considerado conectado
      
      const status = data.instance?.status || data.status?.status || data.status;
      const state = data.instance?.state || data.state;
      const isConnectedBool = data.connected === true || data.status?.connected === true;

      // Lista de status que indicam conexão bem sucedida
      const connectedStatuses = ['connected', 'open'];
      
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

        const proxyCity = String(data.instance.proxy_managed_city ?? '').trim();
        const proxyState = String(data.instance.proxy_managed_state ?? '').trim();
        if (proxyCity) {
          const matched = CITY_BY_VALUE.get(proxyCity) ?? null;
          const label = matched?.label || proxyCity;
          const stateLabel = matched?.state_label || (proxyState ? proxyState.toUpperCase() : undefined);
          setConnectedCity({ label, value: proxyCity, state: proxyState || matched?.state, stateLabel });
        } else {
          setConnectedCity(null);
        }
      } else {
        setConnectedInfo(null);
        setConnectedCity(null);
      }

      return isConnectedStatus;
    } catch {
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
      setSecureItem(STORAGE_KEYS.CITY, selectedCity, false);
      setSecureItem(STORAGE_KEYS.IS_CONNECTED, JSON.stringify(isConnected), false);
      
      if (error) setSecureItem(STORAGE_KEYS.ERROR, error, false);
      else removeSecureItem(STORAGE_KEYS.ERROR);
      
      setSecureItem(STORAGE_KEYS.QR_CODE_TIMER, qrCodeTimer.toString(), false);
      setSecureItem(STORAGE_KEYS.COOLDOWN_TIMER, cooldownTimer.toString(), false);
      setSecureItem(STORAGE_KEYS.CONNECTION_METHOD, connectionMethod, false);
      setSecureItem(STORAGE_KEYS.TIMESTAMP, Date.now().toString(), false);
    } catch {
    }
  };

  // Função para limpar o localStorage
  const clearStoredState = () => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        removeSecureItem(key);
      });
    } catch {
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
      const storedCity = getSecureItem(STORAGE_KEYS.CITY, 30 * 60 * 1000);
      // Não restauramos o status de conexão do localStorage, pois já foi verificado pela API
      const storedError = getSecureItem(STORAGE_KEYS.ERROR, 30 * 60 * 1000);
      const storedQrCodeTimer = getSecureItem(STORAGE_KEYS.QR_CODE_TIMER, 30 * 60 * 1000);
      const storedCooldownTimer = getSecureItem(STORAGE_KEYS.COOLDOWN_TIMER, 30 * 60 * 1000);
      const storedConnectionMethod = getSecureItem(STORAGE_KEYS.CONNECTION_METHOD, 30 * 60 * 1000) as 'qrcode' | 'phone';
      
      // Restaura os estados
      if (storedQrCode && storedQrCode !== '') setQrCode(storedQrCode);
      if (storedPhoneCode && storedPhoneCode !== '') setPhoneCode(storedPhoneCode);
      if (storedPhoneNumber) setPhoneNumber(storedPhoneNumber);
      if (storedCity) {
        const rawCity = String(storedCity || '').trim();
        if (rawCity && CITY_BY_VALUE.has(rawCity)) {
          setSelectedCity(rawCity);
        } else {
          setSelectedCity('');
        }
      }
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
          startTimer();
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
    } catch {
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
        connected = await checkConnectionStatus();
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
      } catch {
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
  const startTimer = () => {
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
  const connectWhatsAppPhone = async (city: string) => {
    if (!user?.token_instancia_uazapi) {
      setError('ERRO. Entre em contato com o suporte.');
      return;
    }
    
    // Verifica se está em cooldown
    if (cooldownTimer > 0) {
      return;
    }

    const cityValue = String(city || '').trim();
    if (!cityValue) {
      setError('Selecione a cidade antes de gerar o código.');
      return;
    }
    const cityObj = CITY_BY_VALUE.get(cityValue) ?? null;
    if (!cityObj) {
      setError('Selecione uma cidade válida antes de gerar o código.');
      return;
    }
    if (!String(cityObj.state || '').trim()) {
      setError('Selecione uma cidade válida antes de gerar o código.');
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
      const systemName = await resolveSystemName();
      const response = await fetch(
        `https://worklivoo.uazapi.com/instance/connect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': user.token_instancia_uazapi,
          },
          body: JSON.stringify({
            browser: 'auto',
            systemName,
            proxy_managed_country: 'br',
            proxy_managed_state: cityObj.state,
            proxy_managed_city: cityObj.value,
            phone: `55${phoneNumber}`,
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      const data = await response.json();
      
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
        startTimer();
      } else {
        // Se não retornou código, pode ser um erro ou formato inesperado
        throw new Error('Código não encontrado na resposta da API.');
      }
    } catch (err) {
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
        const connected = await checkConnectionStatus();
        
        // Se o status mudou para conectado
        if (connected && !isConnected) {
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
          setIsConnected(false);
          setConnectedInfo(null);
          setConnectedCity(null);
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

      await response.json();

      // Se desconectou com sucesso ou já estava desconectado
      setIsConnected(false);
      setConnectedInfo(null);
      setConnectedCity(null);
      clearStoredState();
      
      // Força uma verificação de status após um breve delay para garantir
      setTimeout(() => {
        checkConnectionStatus();
      }, 1000);
      
    } catch {
      setError('Erro ao desconectar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const cityMatches = useMemo(() => {
    const q = normalizeCitySearch(cityDialogQuery);
    if (!q) return [];
    const matches: WhatsAppCity[] = [];
    for (const c of CITY_OPTIONS) {
      const key = normalizeCitySearch(c.label);
      if (key.includes(q)) {
        matches.push(c);
        if (matches.length >= 30) break;
      }
    }
    return matches;
  }, [cityDialogQuery]);

  const isCityQueryExactSelection = useMemo(() => {
    if (!cityDialogSelected) return false;
    const q = normalizeCitySearch(cityDialogQuery);
    if (!q) return false;
    return normalizeCitySearch(cityDialogSelected.label) === q;
  }, [cityDialogQuery, cityDialogSelected]);

  const openCityDialog = () => {
    const current = CITY_BY_VALUE.get(String(selectedCity || '').trim()) ?? null;
    setCityDialogSelected(current);
    setCityDialogQuery(current?.label ?? '');
    setCityDialogOpen(true);
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
        const connected = await checkConnectionStatus();
        
        if (connected) {
          // Se já estiver conectado, atualiza o estado
          setIsConnected(true);
          setError(null);
          setIsLoading(false);
          return;
        }
        
        // Se não estiver conectado, tenta conectar novamente
        setIsLoading(false);
        openCityDialog();
      } catch {
        setError('Erro ao verificar status da instância. Verifique sua conexão e tente novamente.');
        setIsLoading(false);
      }
      
      // Salva o estado atualizado
      saveStateToStorage();
    }
  };

  const handleConnect = () => {
    setError(null);
    openCityDialog();
    
    // Salva o estado atualizado
    saveStateToStorage();
  };

  const handleConfirmCityAndConnect = async () => {
    if (!cityDialogSelected) return;
    const city = cityDialogSelected.value;

    setSelectedCity(city);
    setCityDialogOpen(false);

    if (connectionMethod === 'qrcode') {
      await connectWhatsAppQR(city);
    } else {
      await connectWhatsAppPhone(city);
    }
  };

  // Salva o estado sempre que houver mudanças relevantes
  useEffect(() => {
    saveStateToStorage();
  }, [qrCode, phoneCode, phoneNumber, selectedCity, isConnected, error, qrCodeTimer, cooldownTimer, connectionMethod]);

  return {
    qrCode,
    setQrCode,
    phoneCode,
    setPhoneCode,
    phoneNumber,
    setPhoneNumber,
    selectedCity,
    setSelectedCity,
    cityDialogOpen,
    setCityDialogOpen,
    cityDialogQuery,
    setCityDialogQuery,
    cityDialogSelected,
    setCityDialogSelected,
    userEmpresa,
    setUserEmpresa,
    isConnected,
    setIsConnected,
    connectedInfo,
    setConnectedInfo,
    connectedCity,
    setConnectedCity,
    isLoading,
    setIsLoading,
    error,
    setError,
    qrCodeTimer,
    setQrCodeTimer,
    cooldownTimer,
    setCooldownTimer,
    connectionMethod,
    setConnectionMethod,
    timerRef,
    cooldownRef,
    STORAGE_KEYS,
    resolveSystemName,
    connectWhatsAppQR,
    checkConnectionStatus,
    saveStateToStorage,
    clearStoredState,
    restoreStateFromStorage,
    startTimer,
    connectWhatsAppPhone,
    disconnectWhatsApp,
    cityMatches,
    isCityQueryExactSelection,
    openCityDialog,
    handleRetry,
    handleConnect,
    handleConfirmCityAndConnect,
  };
};

export type WhatsAppConexaoCtx = ReturnType<typeof useWhatsAppConexao>;
