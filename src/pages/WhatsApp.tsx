import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useCRM } from '@/contexts/CRMContext';
import { Loader2, Check, AlertTriangle, RefreshCw, Clock, QrCode, Smartphone, CheckCircle2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSecureStorage } from '@/hooks/use-secure-storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getUserProfile } from '@/lib/supabase-utils';
import whatsappCitiesData from '@/constants/whatsappCities.json';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

type WhatsAppCity = {
  value: string;
  label: string;
  state?: string;
  state_label?: string;
  raw_city?: string;
};

const normalizeCitySearch = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const CITY_OPTIONS: WhatsAppCity[] = (() => {
  const raw: any = whatsappCitiesData as any;
  const cities = Array.isArray(raw) ? raw : Array.isArray(raw?.cities) ? raw.cities : [];
  return (cities || [])
    .map((c: any) => ({
      value: String(c?.value ?? '').trim(),
      label: String(c?.label ?? '').trim(),
      state: c?.state ? String(c.state).trim() : undefined,
      state_label: c?.state_label ? String(c.state_label).trim() : undefined,
      raw_city: c?.raw_city ? String(c.raw_city).trim() : undefined,
    }))
    .filter((c: WhatsAppCity) => c.value && c.label);
})();

const CITY_BY_VALUE = new Map(CITY_OPTIONS.map((c) => [c.value, c]));

const WhatsApp = () => {
  const { user } = useCRM();
  const { toast } = useToast();
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
  const [apiOfficialPhoto, setApiOfficialPhoto] = useState<File | null>(null);
  const [apiOfficialCategory, setApiOfficialCategory] = useState<string>('');
  const [apiOfficialAbout, setApiOfficialAbout] = useState<string>('');
  const [apiOfficialDescription, setApiOfficialDescription] = useState<string>('');
  const [apiOfficialAddress, setApiOfficialAddress] = useState<string>('');
  const [apiOfficialEmail, setApiOfficialEmail] = useState<string>('');
  const [apiOfficialWebsite, setApiOfficialWebsite] = useState<string>('');
  const [apiOfficialWebsite2, setApiOfficialWebsite2] = useState<string>('');
  const [apiOfficialProfilePictureUrl, setApiOfficialProfilePictureUrl] = useState<string>('');
  const [loadingApiOfficialProfile, setLoadingApiOfficialProfile] = useState<boolean>(false);
  const [apiOfficialEditMode, setApiOfficialEditMode] = useState<boolean>(false);
  const [apiOfficialDialogOpen, setApiOfficialDialogOpen] = useState(false);
  const [apiOfficialPreferredDdd, setApiOfficialPreferredDdd] = useState('');
  const [sendingApiOfficialWebhook, setSendingApiOfficialWebhook] = useState(false);
  const [startingCreateApiOfficialFlow, setStartingCreateApiOfficialFlow] = useState(false);
  const [loadingSalvyAreaCodes, setLoadingSalvyAreaCodes] = useState(false);
  const [salvyAreaCodes, setSalvyAreaCodes] = useState<string[]>([]);
  const [apiOfficialSnapshot, setApiOfficialSnapshot] = useState<{
    about: string;
    description: string;
    address: string;
    email: string;
    website1: string;
    website2: string;
    vertical: string;
    profile_picture_url: string;
    verified_name: string;
    display_phone_number: string;
  } | null>(null);
  const [savingApiOfficialProfile, setSavingApiOfficialProfile] = useState<boolean>(false);
  const [resolvedApiWhatsappId, setResolvedApiWhatsappId] = useState<string>('');
  const [loadingResolvedApiWhatsappId, setLoadingResolvedApiWhatsappId] = useState<boolean>(false);
  const [sendingIntegrateApiOfficialWebhook, setSendingIntegrateApiOfficialWebhook] = useState(false);
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
        startTimer('QR Code expirado. Aguarde para solicitar um novo.');
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
    } catch (error) {
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
    } catch (err) {
    }
  };

  // Função para limpar o localStorage
  const clearStoredState = () => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        removeSecureItem(key);
      });
    } catch (err) {
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
      } catch (err) {
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
        startTimer('Código expirado. Aguarde para solicitar um novo.');
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

      const data = await response.json();
      
      // Se desconectou com sucesso ou já estava desconectado
      setIsConnected(false);
      setConnectedInfo(null);
      setConnectedCity(null);
      clearStoredState();
      
      // Força uma verificação de status após um breve delay para garantir
      setTimeout(() => {
        checkConnectionStatus();
      }, 1000);
      
    } catch (err) {
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

  const resolveSalvyProxyEndpoint = () => {
    const fromEnv = (import.meta as any)?.env?.VITE_SALVY_PROXY_ENDPOINT;
    if (fromEnv) return String(fromEnv);
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0'
    ) {
      return '/api/salvy-proxy';
    }
    if ((import.meta as any)?.env?.DEV) return '/api/salvy-proxy';
    return '/salvy-proxy.php';
  };

  const loadSalvyAreaCodes = async () => {
    const proxyEndpoint = resolveSalvyProxyEndpoint();
    const url = new URL(proxyEndpoint, window.location.origin);
    url.searchParams.set('path', 'virtual-phone-accounts/area-codes');
    url.searchParams.set('available', 'true');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text().catch(() => '');
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const message = payload?.error?.message || payload?.error || text || `Status ${response.status}`;
      throw new Error(String(message));
    }


    const rawAreaCodes = Array.isArray(payload?.areaCodes)
      ? payload.areaCodes
      : Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data?.areaCodes)
          ? payload.data.areaCodes
          : [];
    const uniqueAreaCodes = new Set<string>();

    for (const item of rawAreaCodes) {
      if (item?.available !== true) continue;
      const normalized = String(item?.areaCode ?? '').replace(/\D/g, '').slice(0, 2);
      if (normalized.length === 2) uniqueAreaCodes.add(normalized);
    }
    const normalizedAreaCodes = Array.from(uniqueAreaCodes).sort((a, b) => Number(a) - Number(b));
    return normalizedAreaCodes;
  };

  const handleOpenApiOfficialDialog = async () => {
    setApiOfficialPreferredDdd('');
    setLoadingSalvyAreaCodes(true);
    try {
      const availableAreaCodes = await loadSalvyAreaCodes();
      if (!availableAreaCodes.length) {
        toast({ title: 'Nenhum DDD disponivel', description: 'Nao encontramos DDDs disponiveis no momento.' });
        return;
      }
      setSalvyAreaCodes(availableAreaCodes);
      setApiOfficialDialogOpen(true);
    } catch (err) {
      toast({
        title: 'Erro ao carregar DDDs',
        description: 'Nao foi possivel consultar os DDDs disponiveis agora. Tente novamente.',
      });
    } finally {
      setLoadingSalvyAreaCodes(false);
    }
  };

  const handleStartCreateApiOfficial = () => {
    void handleOpenApiOfficialDialog();
  };

  const hasSalvyId = String(user?.salvy_id ?? '').trim() !== '';
  const hasWabaId = String(user?.waba_id ?? '').trim() !== '';

  const handleSubmitApiOfficialWebhook = async () => {
    const ddd = String(apiOfficialPreferredDdd || '').replace(/\D/g, '').slice(0, 2);
    if (ddd.length !== 2) {
      toast({ title: 'Atenção', description: 'Digite um DDD válido com 2 números.' });
      return;
    }

    const baseUserId = resolveBaseUserId();
    if (!baseUserId) {
      toast({ title: 'Erro', description: 'Não foi possível identificar o usuário.' });
      return;
    }

    setSendingApiOfficialWebhook(true);
    try {
      const profile = await getUserProfile(baseUserId);
      const userEmpresaValue = String((profile as any)?.user_empresa ?? '').trim();
      const userIdValue = String((profile as any)?.user_id ?? '').trim();

      if (!userEmpresaValue || !userIdValue) {
        toast({ title: 'Erro', description: 'Não foi possível carregar os dados do usuário.' });
        return;
      }

      const response = await fetch('https://primary-production-d442.up.railway.app/webhook/08a65c05-5d19-41ff-b8fb-a740fdbd9096', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ddd,
          user_empresa: userEmpresaValue,
          user_id: userIdValue,
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook retornou status ${response.status}`);
      }

      setApiOfficialDialogOpen(false);
      setApiOfficialPreferredDdd('');
      setStartingCreateApiOfficialFlow(true);
      toast({
        title: 'Solicitação enviada',
        description: 'Aguarde, em poucos minutos a conexão será realizada.',
      });
    } catch (err) {
      toast({
        title: 'Erro ao conectar',
        description: 'Não foi possível enviar a solicitação agora. Tente novamente.',
      });
    } finally {
      setSendingApiOfficialWebhook(false);
    }
  };

  const apiOfficialDddDialog = (
    <Dialog open={apiOfficialDialogOpen} onOpenChange={setApiOfficialDialogOpen}>
      <DialogContent className="max-w-lg overflow-hidden border-border/60 p-0">
        <DialogHeader className="border-b border-border/60 bg-gradient-to-br from-[#25D366]/10 via-background to-background px-6 py-5 text-left">
          <DialogTitle>Conectar API Oficial</DialogTitle>
          <DialogDescription>
            Escolha um DDD disponivel para continuar a criacao da sua API Oficial.
          </DialogDescription>
          <div className="mt-3 inline-flex w-fit items-center rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
            {apiOfficialPreferredDdd ? `DDD selecionado: ${apiOfficialPreferredDdd}` : 'Nenhum DDD selecionado'}
          </div>
        </DialogHeader>
        <div className="px-6 py-5">
          <div className="space-y-3">
            <Label className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              DDD disponivel
            </Label>
            <div className="max-h-[320px] overflow-y-auto pr-1">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {salvyAreaCodes.map((ddd) => {
                  const isSelected = apiOfficialPreferredDdd === ddd;

                  return (
                    <button
                      key={ddd}
                      type="button"
                      onClick={() => setApiOfficialPreferredDdd(ddd)}
                      className={`rounded-2xl border px-3 py-4 text-center transition-all ${
                        isSelected
                          ? 'border-[#25D366] bg-[#25D366]/10 text-foreground shadow-sm shadow-[#25D366]/10'
                          : 'border-border/60 bg-background hover:border-[#25D366]/40 hover:bg-muted/40'
                      }`}
                    >
                      <div className="text-lg font-semibold">{ddd}</div>
                      <div className={`mt-1 flex items-center justify-center gap-1 text-[11px] ${
                        isSelected ? 'text-[#1EBE5D]' : 'text-muted-foreground'
                      }`}>
                        {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                        <span>{isSelected ? 'Selecionado' : 'Selecionar'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="border-t border-border/60 bg-muted/20 px-6 py-4">
          <Button variant="outline" onClick={() => setApiOfficialDialogOpen(false)} disabled={sendingApiOfficialWebhook}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmitApiOfficialWebhook} disabled={sendingApiOfficialWebhook || apiOfficialPreferredDdd.length !== 2}>
            {sendingApiOfficialWebhook ? 'Enviando...' : 'Conectar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const handleIntegrateApiOfficial = async () => {
    const baseUserId = resolveBaseUserId();
    if (!baseUserId) {
      toast({ title: 'Erro', description: 'Não foi possível identificar o usuário.' });
      return;
    }

    setSendingIntegrateApiOfficialWebhook(true);
    try {
      const profile = await getUserProfile(baseUserId);
      const userIdValue = String((profile as any)?.user_id ?? '').trim();
      const salvyIdValue = String((profile as any)?.salvy_id ?? '').trim();
      const idApiWhatsappValue = String((profile as any)?.id_api_whatsapp ?? '').trim();
      const wabaIdValue = String((profile as any)?.waba_id ?? '').trim();

      if (!userIdValue || !salvyIdValue || !idApiWhatsappValue || !wabaIdValue) {
        toast({ title: 'Erro', description: 'Não foi possível carregar os dados necessários para a integração.' });
        return;
      }

      const response = await fetch('https://primary-production-d442.up.railway.app/webhook/2fdc78c8-a2f1-4ac0-98ab-1dd6bcddae34', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userIdValue,
          salvy_id: salvyIdValue,
          id_api_whatsapp: idApiWhatsappValue,
          waba_id: wabaIdValue,
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook retornou status ${response.status}`);
      }

      toast({
        title: 'Solicitação enviada',
        description: 'A integração da API Oficial foi solicitada com sucesso.',
      });
    } catch (err) {
      toast({
        title: 'Erro ao integrar',
        description: 'Não foi possível enviar a solicitação agora. Tente novamente.',
      });
    } finally {
      setSendingIntegrateApiOfficialWebhook(false);
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
      } catch (err) {
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

  useEffect(() => {
    const run = async () => {
      if (!user?.api_oficial) return;
      const rawUser = user as any;
      const baseUserId = rawUser?.isMembro ? String(rawUser?.user_id_empresa || '').trim() : String(rawUser?.id || '').trim();
      if (!baseUserId) return;

      setResolvedApiWhatsappId(String((rawUser?.id_api_whatsapp ?? '') as any));
      setLoadingResolvedApiWhatsappId(true);
      try {
        const profile = await getUserProfile(baseUserId);
        const idFromDb = String((profile as any)?.id_api_whatsapp ?? '').trim();
        if (idFromDb) {
          setResolvedApiWhatsappId(idFromDb);
        }
      } catch (e) {
        // noop
      } finally {
        setLoadingResolvedApiWhatsappId(false);
      }
    };
    run();
  }, [user?.api_oficial, user?.id]);

  const META_GRAPH_VERSION = 'v21.0';
  const EMPTY_VERTICAL = '__EMPTY__';
  const verticalLabel = (value: string) => {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return '-';
    if (raw === EMPTY_VERTICAL) return 'Sem categoria';
    const map: Record<string, string> = {
      ALCOHOL: 'Bebidas alcoólicas',
      APPAREL: 'Vestuário',
      AUTO: 'Automotivo',
      BEAUTY: 'Beleza',
      EDU: 'Educação',
      ENTERTAIN: 'Entretenimento',
      EVENT_PLAN: 'Eventos',
      FINANCE: 'Finanças',
      GOVT: 'Governo',
      GROCERY: 'Mercado',
      HEALTH: 'Saúde',
      HOTEL: 'Hotelaria',
      MATRIMONY_SERVICE: 'Serviço de matrimônio',
      NONPROFIT: 'Sem fins lucrativos',
      ONLINE_GAMBLING: 'Apostas online',
      OTC_DRUGS: 'Medicamentos OTC',
      OTHER: 'Outro',
      PHYSICAL_GAMBLING: 'Apostas físicas',
      PROF_SERVICES: 'Serviços profissionais',
      RESTAURANT: 'Restaurante',
      RETAIL: 'Varejo',
      TRAVEL: 'Viagens',
    };
    return map[raw] || raw;
  };

  const resolveMetaProxyEndpoint = () => {
    const fromEnv = (import.meta as any)?.env?.VITE_META_PROXY_ENDPOINT;
    if (fromEnv) return String(fromEnv);
    try {
      const host = String(window.location.hostname || '').toLowerCase();
      if (host.endsWith('.vercel.app') || host === 'vercel.app' || host.includes('vercel')) {
        return '/api/meta-proxy';
      }
    } catch {
      // ignore
    }
    return '/meta-proxy.php';
  };

  const postMetaProxy = async (params: { path: string; method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; query?: Record<string, string>; headers?: Record<string, string>; body?: BodyInit | null }) => {
    const proxyEndpoint = resolveMetaProxyEndpoint();
    const url = new URL(proxyEndpoint, window.location.origin);
    url.searchParams.set('path', params.path);
    if (params.query) {
      for (const [k, v] of Object.entries(params.query)) {
        url.searchParams.set(k, v);
      }
    }
    const method = params.method || 'POST';

    try {
      const doFetch = async (targetUrl: string) => {
        const res = await fetch(targetUrl, {
          method,
          headers: params.headers,
          body: method === 'GET' ? undefined : (params.body ?? null),
        });
        const text = await res.text().catch(() => '');
        let json: any = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = null;
        }
        return { res, text, json };
      };

      let { res, text, json } = await doFetch(url.toString());

      const contentType = String(res.headers.get('content-type') || '');
      const looksLikePhpFile =
        contentType.includes('application/x-httpd-php') ||
        contentType.includes('text/x-php') ||
        /^\s*<\?php\b/i.test(text);

      if (res.ok && looksLikePhpFile && proxyEndpoint.includes('meta-proxy.php')) {
        const fallbackUrl = new URL('/api/meta-proxy', window.location.origin);
        fallbackUrl.searchParams.set('path', params.path);
        if (params.query) {
          for (const [k, v] of Object.entries(params.query)) {
            fallbackUrl.searchParams.set(k, v);
          }
        }

        ({ res, text, json } = await doFetch(fallbackUrl.toString()));
      }

      return { ok: res.ok, status: res.status, text, json, headers: res.headers };
    } catch (e: any) {
      throw e;
    }
  };

  const uploadProfilePictureToMeta = async (file: File) => {
    const startRes = await postMetaProxy({
      path: `${META_GRAPH_VERSION}/uploads`,
      query: {
        file_name: file.name,
        file_length: String(file.size),
        file_type: file.type || 'image/jpeg',
      },
    });
    const sessionId = String(startRes?.json?.id || '').trim();
    if (!startRes.ok || !sessionId) {
      const msg = startRes?.json?.error?.message || startRes.text || `Status ${startRes.status}`;
      throw new Error(msg);
    }

    const uploadRes = await postMetaProxy({
      path: `${META_GRAPH_VERSION}/${sessionId}`,
      headers: {
        file_offset: '0',
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });

    const handle = String(uploadRes?.json?.h || '').trim();
    if (!uploadRes.ok || !handle) {
      const msg = uploadRes?.json?.error?.message || uploadRes.text || `Status ${uploadRes.status}`;
      throw new Error(msg);
    }
    return handle;
  };

  const applyLoadedApiOfficialProfile = (profile: any, phoneInfo?: any) => {
    const about = String(profile?.about ?? '').trim();
    const description = String(profile?.description ?? '').trim();
    const address = String(profile?.address ?? '').trim();
    const email = String(profile?.email ?? '').trim();
    const websites = Array.isArray(profile?.websites) ? profile.websites : [];
    const website1 = String(websites?.[0] ?? '').trim();
    const website2 = String(websites?.[1] ?? '').trim();
    const vertical = String(profile?.vertical ?? '').trim().toUpperCase();
    const profilePictureUrl = String(profile?.profile_picture_url ?? '').trim();
    const verifiedName = String(phoneInfo?.verified_name ?? '').trim();
    const displayPhoneNumber = String(phoneInfo?.display_phone_number ?? '').trim();

    setApiOfficialAbout(about);
    setApiOfficialDescription(description);
    setApiOfficialAddress(address);
    setApiOfficialEmail(email);
    setApiOfficialWebsite(website1);
    setApiOfficialWebsite2(website2);
    setApiOfficialCategory(vertical ? vertical : EMPTY_VERTICAL);
    setApiOfficialProfilePictureUrl(profilePictureUrl);
    setApiOfficialPhoto(null);
    setApiOfficialEditMode(false);
    setApiOfficialSnapshot({
      about,
      description,
      address,
      email,
      website1,
      website2,
      vertical,
      profile_picture_url: profilePictureUrl,
      verified_name: verifiedName,
      display_phone_number: displayPhoneNumber,
    });
  };

  const loadApiOfficialProfile = async (apiWhatsappId: string) => {
    if (!apiWhatsappId) return;
    setLoadingApiOfficialProfile(true);
    try {
      const [res, phoneRes] = await Promise.all([
        postMetaProxy({
          method: 'GET',
          path: `${META_GRAPH_VERSION}/${apiWhatsappId}/whatsapp_business_profile`,
          query: {
            fields: 'about,address,description,email,profile_picture_url,websites,vertical',
          },
        }),
        postMetaProxy({
          method: 'GET',
          path: `${META_GRAPH_VERSION}/${apiWhatsappId}`,
          query: {
            fields: 'verified_name,display_phone_number',
          },
        }),
      ]);

      if (!res.ok) {
        const msg = res?.json?.error?.message || res.text || `Status ${res.status}`;
        throw new Error(msg);
      }

      const payload = res?.json;
      let profile: any = null;

      if (Array.isArray(payload?.data)) {
        profile = payload.data[0] ?? null;
      } else if (payload?.data && typeof payload.data === 'object') {
        profile = payload.data;
      } else if (payload && typeof payload === 'object') {
        profile = payload;
      }

      const phonePayload = phoneRes?.ok ? phoneRes?.json : null;

      if (!profile) {
        applyLoadedApiOfficialProfile({}, phonePayload);
        return;
      }
      applyLoadedApiOfficialProfile(profile, phonePayload);
    } catch (e: any) {
      toast({ title: 'Erro', description: 'Não foi possível carregar o perfil da API Oficial.' });
    } finally {
      setLoadingApiOfficialProfile(false);
    }
  };

  useEffect(() => {
    if (!user?.api_oficial) return;
    if (loadingResolvedApiWhatsappId) return;
    const apiWhatsappId = String(resolvedApiWhatsappId || '').trim();
    if (!apiWhatsappId) return;
    loadApiOfficialProfile(apiWhatsappId);
  }, [user?.api_oficial, resolvedApiWhatsappId, loadingResolvedApiWhatsappId]);

  const cancelApiOfficialEdit = () => {
    const snap = apiOfficialSnapshot;
    if (!snap) {
      setApiOfficialEditMode(false);
      return;
    }
    setApiOfficialAbout(snap.about);
    setApiOfficialDescription(snap.description);
    setApiOfficialAddress(snap.address);
    setApiOfficialEmail(snap.email);
    setApiOfficialWebsite(snap.website1);
    setApiOfficialWebsite2(snap.website2);
    setApiOfficialCategory(snap.vertical ? snap.vertical : EMPTY_VERTICAL);
    setApiOfficialProfilePictureUrl(snap.profile_picture_url);
    setApiOfficialPhoto(null);
    setApiOfficialEditMode(false);
  };

  const handleSaveApiOfficialProfile = async () => {
    if (savingApiOfficialProfile) return;
    const apiWhatsappId = String(resolvedApiWhatsappId || '').trim();
    if (!apiWhatsappId) {
      toast({ title: 'Erro', description: 'ID da API do WhatsApp não configurado para este usuário.' });
      return;
    }

    const snap = apiOfficialSnapshot;
    if (!snap) {
      toast({ title: 'Erro', description: 'Perfil ainda não foi carregado. Tente novamente.' });
      return;
    }

    const ALLOWED_VERTICALS = new Set([
      'ALCOHOL',
      'AUTO',
      'BEAUTY',
      'APPAREL',
      'EDU',
      'ENTERTAIN',
      'EVENT_PLAN',
      'FINANCE',
      'GROCERY',
      'GOVT',
      'HOTEL',
      'HEALTH',
      'NONPROFIT',
      'ONLINE_GAMBLING',
      'OTC_DRUGS',
      'PHYSICAL_GAMBLING',
      'PROF_SERVICES',
      'RETAIL',
      'TRAVEL',
      'RESTAURANT',
      'OTHER',
      'MATRIMONY_SERVICE',
    ]);

    const normalizeVertical = (v: string) => {
      const raw = String(v || '').trim().toUpperCase();
      if (raw === EMPTY_VERTICAL) return '';
      if (raw === 'EDUCATION') return 'EDU';
      if (raw === 'ENTERTAINMENT') return 'ENTERTAIN';
      return raw;
    };

    const about = apiOfficialAbout.trim();
    const description = apiOfficialDescription.trim();
    const address = apiOfficialAddress.trim();
    const email = apiOfficialEmail.trim();
    const website1 = apiOfficialWebsite.trim();
    const website2 = apiOfficialWebsite2.trim();
    const category = normalizeVertical(apiOfficialCategory);

    const emailLooksValid = (value: string) => /^\S+@\S+\.\S+$/.test(value);
    if (email && !emailLooksValid(email)) {
      toast({ title: 'Atenção', description: 'E-mail inválido.' });
      return;
    }

    const normalizeWebsite = (value: string) => value.trim();
    const websites: string[] = [];
    const w1 = normalizeWebsite(website1);
    const w2 = normalizeWebsite(website2);
    if (w1) websites.push(w1);
    if (w2) websites.push(w2);
    const urlLooksValid = (value: string) => /^https?:\/\//i.test(value);
    for (const w of websites) {
      if (!urlLooksValid(w)) {
        toast({ title: 'Atenção', description: 'O site deve começar com http:// ou https://.' });
        return;
      }
      if (w.length > 256) {
        toast({ title: 'Atenção', description: 'O site pode ter no máximo 256 caracteres.' });
        return;
      }
    }

    if (category && !ALLOWED_VERTICALS.has(category)) {
      toast({ title: 'Atenção', description: 'Categoria inválida. Selecione uma opção da lista.' });
      return;
    }

    setSavingApiOfficialProfile(true);
    try {
      const endpointPath = `${META_GRAPH_VERSION}/${apiWhatsappId}/whatsapp_business_profile`;

      if (apiOfficialPhoto) {
        const profilePictureHandle = await uploadProfilePictureToMeta(apiOfficialPhoto);
        const photoPayload: any = {
          messaging_product: 'whatsapp',
          profile_picture_handle: profilePictureHandle,
        };

        const photoRes = await postMetaProxy({
          path: endpointPath,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(photoPayload),
        });

        if (!photoRes.ok) {
          throw new Error('Falha ao atualizar a foto na Meta.');
        }
      }

      const infoPayload: any = { messaging_product: 'whatsapp' };

      if (about !== snap.about) {
        if (!about) {
          toast({ title: 'Atenção', description: 'O campo "Sobre" não pode ficar vazio.' });
          setSavingApiOfficialProfile(false);
          return;
        }
        if (about.length > 139) {
          toast({ title: 'Atenção', description: 'O campo "Sobre" pode ter no máximo 139 caracteres.' });
          setSavingApiOfficialProfile(false);
          return;
        }
        infoPayload.about = about;
      }

      if (description !== snap.description) infoPayload.description = description;
      if (address !== snap.address) infoPayload.address = address;
      if (email !== snap.email) infoPayload.email = email;

      const websitesChanged = website1 !== snap.website1 || website2 !== snap.website2;
      if (websitesChanged) infoPayload.websites = websites;

      if (category !== snap.vertical) infoPayload.vertical = category;

      const hasAnyInfoField = Object.keys(infoPayload).length > 1;
      if (hasAnyInfoField) {
        const infoRes = await postMetaProxy({
          path: endpointPath,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(infoPayload),
        });

        if (!infoRes.ok) {
          throw new Error('Falha ao atualizar as informações na Meta.');
        }
      }

      toast({ title: 'Salvo', description: 'Perfil da API Oficial atualizado com sucesso.' });
      await loadApiOfficialProfile(apiWhatsappId);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: 'Não foi possível atualizar o perfil.' });
    } finally {
      setSavingApiOfficialProfile(false);
    }
  };

  if (user?.api_oficial !== true && user?.recomendar_api_oficial === true) {
    return (
      <Card className="border-border bg-card shadow-sm rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold">API Oficial do WhatsApp</CardTitle>
          <CardDescription>Gerencie a ativação da sua API Oficial em um fluxo dedicado.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[480px] items-center justify-center">
            {!hasSalvyId && !startingCreateApiOfficialFlow ? (
              <div className="w-full max-w-2xl rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/20 p-8 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border/60 bg-[#25D366]/10 text-[#25D366]">
                  <WhatsAppIcon sx={{ fontSize: 28, display: 'block' }} />
                </div>
                <h2 className="mt-6 text-2xl font-semibold text-foreground">Criar uma nova API Oficial</h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                  Inicie o processo de criacao da sua API Oficial do WhatsApp.
                </p>
                <div className="mt-8 flex justify-center">
                  <Button
                    type="button"
                    size="lg"
                    className="rounded-2xl bg-[#25D366] px-8 text-white hover:bg-[#1EBE5D] shadow-lg shadow-[#25D366]/20"
                    onClick={handleStartCreateApiOfficial}
                    disabled={loadingSalvyAreaCodes}
                  >
                    {loadingSalvyAreaCodes ? 'Carregando DDDs...' : 'Criar uma nova API Oficial'}
                  </Button>
                </div>
              </div>
            ) : hasSalvyId && !hasWabaId ? (
              <div className="w-full max-w-2xl rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/20 p-8 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border/60 bg-amber-500/10 text-amber-600">
                  <Clock size={28} />
                </div>
                <h2 className="mt-6 text-2xl font-semibold text-foreground">Análise em andamento</h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                  Nossa equipe interna esta analisando os dados e a API Oficial sera liberada o quanto antes!
                </p>
              </div>
            ) : hasWabaId ? (
              <div className="w-full max-w-2xl rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/20 p-8 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border/60 bg-[#25D366]/10 text-[#25D366]">
                  <WhatsAppIcon sx={{ fontSize: 28, display: 'block' }} />
                </div>
                <h2 className="mt-6 text-2xl font-semibold text-foreground">Integrar API Oficial</h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                  Sua API Oficial ja avançou para a próxima etapa. Continue a integração por este botão.
                </p>
                <div className="mt-8 flex justify-center">
                  <Button
                    type="button"
                    size="lg"
                    className="rounded-2xl bg-[#25D366] px-8 text-white hover:bg-[#1EBE5D] shadow-lg shadow-[#25D366]/20"
                    onClick={handleIntegrateApiOfficial}
                    disabled={sendingIntegrateApiOfficialWebhook}
                  >
                    {sendingIntegrateApiOfficialWebhook ? 'Enviando...' : 'Integrar API Oficial'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-2xl rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/20 p-8 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border/60 bg-primary/10 text-primary">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
                <h2 className="mt-6 text-2xl font-semibold text-foreground">Carregando</h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                  Estamos preparando o proximo passo da sua API Oficial.
                </p>
              </div>
            )}
          </div>

          {apiOfficialDddDialog}
        </CardContent>
      </Card>
    );
  }

  if (user?.api_oficial === true) {
    return (
      <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl border border-border/60 bg-muted/30 p-2">
                <WhatsAppIcon sx={{ width: 18, height: 18, display: 'block' }} className="text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">API Oficial do WhatsApp</CardTitle>
                <div className="mt-1 text-xs text-muted-foreground">Configure as informações do seu perfil exibidas no WhatsApp.</div>
              </div>
            </div>
            {!apiOfficialEditMode && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setApiOfficialEditMode(true)}
                className="rounded-xl"
                disabled={loadingApiOfficialProfile || loadingResolvedApiWhatsappId || !String(resolvedApiWhatsappId || '').trim() || !apiOfficialSnapshot}
              >
                Editar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingResolvedApiWhatsappId ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : !String(resolvedApiWhatsappId || '').trim() ? (
            <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4 text-sm text-muted-foreground">
              ID da API do WhatsApp não encontrado para este usuário. Preencha a coluna <span className="font-medium">id_api_whatsapp</span> na tabela <span className="font-medium">usuarios_v2</span>.
            </div>
          ) : loadingApiOfficialProfile || !apiOfficialSnapshot ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : apiOfficialEditMode ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <div className="text-xs text-muted-foreground">Foto</div>
                  <div className="flex items-center gap-3">
                    {apiOfficialProfilePictureUrl ? (
                      <img
                        src={apiOfficialProfilePictureUrl}
                        alt="Foto do perfil"
                        className="h-12 w-12 rounded-xl object-cover border border-border/60 bg-background"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-xl border border-border/60 bg-background" />
                    )}
                    <Input
                      type="file"
                      accept="image/*"
                      className="bg-background border-border rounded-2xl"
                      onChange={(e) => setApiOfficialPhoto(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  {apiOfficialPhoto?.name ? <div className="text-xs text-muted-foreground break-words">{apiOfficialPhoto.name}</div> : null}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <div className="text-xs text-muted-foreground">Categoria da empresa</div>
                  <Select value={apiOfficialCategory} onValueChange={setApiOfficialCategory}>
                    <SelectTrigger className="bg-background border-border rounded-2xl">
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_VERTICAL}>Sem categoria</SelectItem>
                      <SelectItem value="ALCOHOL">Bebidas alcoólicas</SelectItem>
                      <SelectItem value="AUTO">Automotivo</SelectItem>
                      <SelectItem value="BEAUTY">Beleza</SelectItem>
                      <SelectItem value="APPAREL">Vestuário</SelectItem>
                      <SelectItem value="EDU">Educação</SelectItem>
                      <SelectItem value="ENTERTAIN">Entretenimento</SelectItem>
                      <SelectItem value="EVENT_PLAN">Eventos</SelectItem>
                      <SelectItem value="FINANCE">Finanças</SelectItem>
                      <SelectItem value="GROCERY">Mercado</SelectItem>
                      <SelectItem value="GOVT">Governo</SelectItem>
                      <SelectItem value="HOTEL">Hotelaria</SelectItem>
                      <SelectItem value="HEALTH">Saúde</SelectItem>
                      <SelectItem value="NONPROFIT">Sem fins lucrativos</SelectItem>
                      <SelectItem value="ONLINE_GAMBLING">Apostas online</SelectItem>
                      <SelectItem value="OTC_DRUGS">Medicamentos OTC</SelectItem>
                      <SelectItem value="PHYSICAL_GAMBLING">Apostas físicas</SelectItem>
                      <SelectItem value="PROF_SERVICES">Serviços profissionais</SelectItem>
                      <SelectItem value="RETAIL">Varejo</SelectItem>
                      <SelectItem value="TRAVEL">Viagens</SelectItem>
                      <SelectItem value="RESTAURANT">Restaurante</SelectItem>
                      <SelectItem value="OTHER">Outro</SelectItem>
                      <SelectItem value="MATRIMONY_SERVICE">Serviço de matrimônio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <div className="text-xs text-muted-foreground">Sobre (1 a 139)</div>
                  <Textarea
                    value={apiOfficialAbout}
                    onChange={(e) => setApiOfficialAbout(e.target.value)}
                    placeholder="Opcional"
                    className="bg-background border-border rounded-2xl min-h-[90px]"
                    maxLength={139}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <div className="text-xs text-muted-foreground">Descrição</div>
                  <Textarea
                    value={apiOfficialDescription}
                    onChange={(e) => setApiOfficialDescription(e.target.value)}
                    placeholder="Opcional"
                    className="bg-background border-border rounded-2xl min-h-[110px]"
                    maxLength={512}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Endereço</div>
                  <Input
                    value={apiOfficialAddress}
                    onChange={(e) => setApiOfficialAddress(e.target.value)}
                    placeholder="Opcional"
                    className="bg-background border-border rounded-2xl"
                    maxLength={256}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">E-mail</div>
                  <Input
                    type="email"
                    value={apiOfficialEmail}
                    onChange={(e) => setApiOfficialEmail(e.target.value)}
                    placeholder="Opcional"
                    className="bg-background border-border rounded-2xl"
                    maxLength={128}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Site 1</div>
                  <Input
                    value={apiOfficialWebsite}
                    onChange={(e) => setApiOfficialWebsite(e.target.value)}
                    placeholder="https://..."
                    className="bg-background border-border rounded-2xl"
                    maxLength={256}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Site 2</div>
                  <Input
                    value={apiOfficialWebsite2}
                    onChange={(e) => setApiOfficialWebsite2(e.target.value)}
                    placeholder="https://..."
                    className="bg-background border-border rounded-2xl"
                    maxLength={256}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={cancelApiOfficialEdit} className="rounded-xl" disabled={savingApiOfficialProfile}>
                  Cancelar
                </Button>
                <Button type="button" onClick={handleSaveApiOfficialProfile} className="rounded-xl" disabled={savingApiOfficialProfile}>
                  {savingApiOfficialProfile ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4">
                <div className="text-xs text-muted-foreground">Status</div>
                <div className="mt-2">
                  <Badge variant="outline" className="font-normal bg-background/60">
                    Conectada
                  </Badge>
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4">
                <div className="text-xs text-muted-foreground">Categoria</div>
                <div className="mt-2">
                  <Badge variant="outline" className="font-normal bg-background/60">
                    {verticalLabel(apiOfficialSnapshot.vertical ? apiOfficialSnapshot.vertical : EMPTY_VERTICAL)}
                  </Badge>
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4">
                <div className="text-xs text-muted-foreground">Nome</div>
                <div className="mt-2 text-sm text-foreground whitespace-pre-wrap break-words">{apiOfficialSnapshot.verified_name || '-'}</div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4">
                <div className="text-xs text-muted-foreground">Número</div>
                <div className="mt-2 text-sm text-foreground whitespace-pre-wrap break-words">{apiOfficialSnapshot.display_phone_number || '-'}</div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4 sm:col-span-2">
                <div className="text-xs text-muted-foreground">Foto</div>
                <div className="mt-3 flex items-center gap-3">
                  {apiOfficialProfilePictureUrl ? (
                    <img
                      src={apiOfficialProfilePictureUrl}
                      alt="Foto do perfil"
                      className="h-12 w-12 rounded-xl object-cover border border-border/60 bg-background"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-xl border border-border/60 bg-background" />
                  )}
                  <div className="text-xs text-muted-foreground">{apiOfficialProfilePictureUrl ? 'Foto atual' : 'Sem foto configurada'}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4 sm:col-span-2">
                <div className="text-xs text-muted-foreground">Sobre</div>
                <div className="mt-2 text-sm text-foreground whitespace-pre-wrap break-words">{apiOfficialSnapshot.about || '-'}</div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4 sm:col-span-2">
                <div className="text-xs text-muted-foreground">Descrição</div>
                <div className="mt-2 text-sm text-foreground whitespace-pre-wrap break-words">{apiOfficialSnapshot.description || '-'}</div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4">
                <div className="text-xs text-muted-foreground">Endereço</div>
                <div className="mt-2 text-sm text-foreground whitespace-pre-wrap break-words">{apiOfficialSnapshot.address || '-'}</div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4">
                <div className="text-xs text-muted-foreground">E-mail</div>
                <div className="mt-2 text-sm text-foreground whitespace-pre-wrap break-words">{apiOfficialSnapshot.email || '-'}</div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4 sm:col-span-2">
                <div className="text-xs text-muted-foreground">Links</div>
                <div className="mt-2 text-sm text-foreground whitespace-pre-wrap break-words">
                  {[apiOfficialSnapshot.website1, apiOfficialSnapshot.website2].filter(Boolean).join('\n') || '-'}
                </div>
              </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card shadow-sm rounded-2xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold">Conectar WhatsApp</CardTitle>
        <CardDescription>Escaneie o QR Code para conectar seu número e ativar o agente.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-muted/20 p-6">
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0 text-sm">
                  1
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Abra o WhatsApp</h3>
                  <p className="text-sm text-muted-foreground mt-1">Abra o aplicativo no seu celular.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0 text-sm">
                  2
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Acesse o Menu</h3>
                  <p className="text-sm text-muted-foreground mt-1">Toque em Configurações ou no menu de 3 pontos.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0 text-sm">
                  3
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Aparelhos Conectados</h3>
                  <p className="text-sm text-muted-foreground mt-1">Selecione "Conectar um aparelho" e aponte a câmera.</p>
                </div>
              </div>
            </div>

            <div className="mt-8 bg-muted p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="text-muted-foreground flex-shrink-0 mt-0.5" size={20} />
              <p className="text-sm text-muted-foreground">
                Se por algum motivo você não estiver conseguindo conectar por QR Code, selecione a opção por Código.
              </p>
            </div>

          </div>

          <div className="lg:col-span-3 rounded-2xl border border-border/60 bg-muted/10 p-6">
            {!isConnected && (
              <Tabs value={connectionMethod} onValueChange={(v) => setConnectionMethod(v as 'qrcode' | 'phone')} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="qrcode">QR Code</TabsTrigger>
                  <TabsTrigger value="phone">Código</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            <div className={`${!isConnected ? 'mt-6' : ''} min-h-[360px] flex items-center justify-center`}>
              {isLoading ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-12 h-12 animate-spin text-primary" />
                  <p className="text-muted-foreground font-medium">
                    {connectionMethod === 'qrcode' ? 'Gerando QR Code...' : 'Gerando código...'}
                  </p>
                </div>
              ) : isConnected ? (
                <div className="flex flex-col items-center gap-4 text-green-600">
                  <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-2 overflow-hidden relative shadow-sm border-2 border-green-200">
                    {connectedInfo?.profilePicUrl ? (
                      <img src={connectedInfo.profilePicUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <CheckCircle2 size={48} />
                    )}
                  </div>
                  <div className="text-center">
                    <span className="text-xl font-bold block text-foreground">Conectado com sucesso</span>
                    {connectedInfo?.name && <p className="text-foreground font-medium mt-2">{connectedInfo.name}</p>}
                    {connectedInfo?.owner && (
                      <p className="text-sm text-muted-foreground font-mono mt-1">{connectedInfo.owner.replace(/^55/, '')}</p>
                    )}
                    {connectedCity?.label && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {connectedCity.label}
                        {connectedCity.state ? ` - ${String(connectedCity.state).toUpperCase()}` : ''}
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
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-2 text-red-500">
                    <AlertTriangle size={32} />
                  </div>
                  <p className="text-red-500 text-sm font-medium max-w-xs">{error}</p>
                  <Button onClick={handleRetry} disabled={cooldownTimer > 0} className="px-6">
                    <RefreshCw className={`mr-2 w-4 h-4 ${cooldownTimer > 0 ? 'animate-spin' : ''}`} />
                    {cooldownTimer > 0 ? `Aguarde ${cooldownTimer}s` : 'Tentar Novamente'}
                  </Button>
                </div>
              ) : connectionMethod === 'qrcode' ? (
                <div className="w-full flex flex-col items-center">
                  <div className="bg-white p-4 rounded-xl shadow-sm mb-6 relative group w-full max-w-[280px] aspect-square flex items-center justify-center border border-border">
                    <div className="w-full h-full bg-muted/50 rounded-lg flex items-center justify-center relative overflow-hidden">
                      {qrCode ? (
                        <img src={qrCode} alt="QR Code" className="w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                          <QrCode size={48} />
                        </div>
                      )}
                    </div>
                  </div>

                  {qrCode && (
                    <div className="flex items-center gap-2 text-orange-600 bg-orange-50 border border-orange-100 px-4 py-2 rounded-full mb-6">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-bold">Expira em {qrCodeTimer}s</span>
                    </div>
                  )}

                  {!qrCode && (
                    <div className="flex items-center gap-2 text-muted-foreground bg-muted px-4 py-2 rounded-full mb-6">
                      <span className="text-sm font-medium">Aguardando geração...</span>
                    </div>
                  )}

                  <div className="w-full flex justify-center">
                    <Button onClick={handleConnect} disabled={cooldownTimer > 0} className="w-full max-w-[280px]">
                      <RefreshCw className="mr-2 w-4 h-4" />
                      {cooldownTimer > 0 ? `Aguarde ${cooldownTimer}s` : 'Gerar Novo Código'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-sm space-y-4">
                  {phoneCode ? (
                    <div className="bg-card p-6 rounded-xl shadow-sm text-center border border-border">
                      <p className="text-sm text-muted-foreground mb-2 font-medium">Seu código de conexão</p>
                      <div className="text-4xl font-black tracking-widest my-6 text-foreground bg-muted/50 py-4 rounded-xl">
                        {phoneCode}
                      </div>
                      <div className="flex items-center justify-center gap-2 text-orange-600 text-sm font-bold bg-orange-50 border border-orange-100 py-2 rounded-lg">
                        <Clock size={16} />
                        <span>Expira em {qrCodeTimer}s</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-4">Digite este código no seu WhatsApp</p>
                      <div className="mt-6 flex justify-center">
                        <Button onClick={handleConnect} disabled={cooldownTimer > 0} className="px-6">
                          <RefreshCw className="mr-2 w-4 h-4" />
                          {cooldownTimer > 0 ? `Aguarde ${cooldownTimer}s` : 'Obter Código'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 bg-card p-6 rounded-xl shadow-sm border border-border">
                      <div className="space-y-2">
                        <Label>Número de WhatsApp</Label>
                        <div className="flex shadow-sm rounded-lg overflow-hidden border border-input focus-within:ring-2 focus-within:ring-ring">
                          <div className="bg-muted px-4 py-2 flex items-center text-muted-foreground text-sm font-medium border-r border-input">
                            +55
                          </div>
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

            <Dialog open={cityDialogOpen} onOpenChange={setCityDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Selecione a cidade</DialogTitle>
                  <DialogDescription>Informe de qual cidade você está hoje para gerar o {connectionMethod === 'qrcode' ? 'QR Code' : 'código'}.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    value={cityDialogQuery}
                    onChange={(e) => {
                      const next = e.target.value;
                      setCityDialogQuery(next);
                      const normalized = normalizeCitySearch(next);
                      if (!normalized) {
                        setCityDialogSelected(null);
                        return;
                      }
                      let match: WhatsAppCity | null = null;
                      for (const c of CITY_OPTIONS) {
                        if (normalizeCitySearch(c.label) === normalized) {
                          if (match) {
                            match = null;
                            break;
                          }
                          match = c;
                        }
                      }
                      setCityDialogSelected(match);
                    }}
                    placeholder="Digite a cidade"
                    className="bg-background border-border rounded-2xl"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && cityDialogSelected) {
                        e.preventDefault();
                        handleConfirmCityAndConnect();
                      }
                    }}
                  />
                  {normalizeCitySearch(cityDialogQuery) && !isCityQueryExactSelection ? (
                    <div className="max-h-64 overflow-auto rounded-2xl border border-border/60 bg-background">
                      {cityMatches.length ? (
                        <div className="p-1">
                          {cityMatches.map((c) => {
                            const isActive = cityDialogSelected?.value === c.value;
                            return (
                              <button
                                key={c.value}
                                type="button"
                                onClick={() => {
                                  setCityDialogSelected(c);
                                  setCityDialogQuery(c.label);
                                }}
                                className={`w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted ${isActive ? 'bg-muted' : ''}`}
                              >
                                <div className="font-medium text-foreground">{c.label}</div>
                                {c.state_label ? <div className="text-xs text-muted-foreground">{c.state_label}</div> : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 text-sm text-muted-foreground">Nenhuma cidade encontrada.</div>
                      )}
                    </div>
                  ) : null}
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => setCityDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleConfirmCityAndConnect} disabled={!cityDialogSelected}>
                    Gerar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {apiOfficialDddDialog}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsApp;
