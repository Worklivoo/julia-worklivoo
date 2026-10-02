import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase-utils';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { asaasFetch, getAsaasApiKey, shouldRequireAsaasApiKey } from '@/utils/asaas';
import type { Payment, ViaCepResponse } from './types';

/**
 * Assinatura do cliente (Asaas): cadastro de faturamento, pagamento por PIX ou cartão, cupom,
 * faturas, uso do plano e antecipação de fatura. Toda a lógica de cobrança fica aqui.
 */
export const useAssinatura = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isCardSaved, setIsCardSaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [asaasCustomerId, setAsaasCustomerId] = useState<string | null>(null);
  const [asaasSubscriptionId, setAsaasSubscriptionId] = useState<string | null>(null);
  const [savedCardToken, setSavedCardToken] = useState<string | null>(null);
  const [cardFinal, setCardFinal] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CREDIT_CARD' | 'PIX' | null>(null);
  
  const [invoices, setInvoices] = useState<Payment[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  const [renewalDays, setRenewalDays] = useState<number | null>(null);
  const [userPlanValue, setUserPlanValue] = useState<number>(0); // Valor mensal do plano (user_valor_mensal)
  const [userPlanLimit, setUserPlanLimit] = useState<number>(2000); // Limite de leads (user_plano)
  const [userPlanName, setUserPlanName] = useState<string>('');
  const [planStatus, setPlanStatus] = useState<string>('');
  const [currentMonthLeads, setCurrentMonthLeads] = useState<number>(0);
  const [usagePeriodLabel, setUsagePeriodLabel] = useState<string>('');
  const [usageHistory, setUsageHistory] = useState<any[]>([]);

  const [formData, setFormData] = usePersistentState('assinatura-novo-form', {
    nome: '',
    documento: '',
    email: '',
    celular: '',
    cep: '',
    endereco: '',
    bairro: '',
    cidade: '',
    estado: '',
    complemento: '',
    emailNf: '',
    telefoneFaturamento: '',
    numero: ''
  });

  // Estado persistente do formulário de cartão
  const [cardData, setCardData] = usePersistentState('assinatura-cartao-form', {
    holderName: '',
    number: '',
    expiryMonth: '',
    expiryYear: '',
    ccv: ''
  });

  // Estado para pagamento PIX (Persistente)
  const [pixPaymentData, setPixPaymentData] = usePersistentState('assinatura-pix-data', null);
  const [couponCode, setCouponCode] = useState<string>('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponMessage, setCouponMessage] = useState<string>('');
  const [couponStatus, setCouponStatus] = useState<'success' | 'error' | null>(null);
  const [hasUsedCoupon, setHasUsedCoupon] = useState(false);
  const [showCardChargeConfirm, setShowCardChargeConfirm] = useState(false);
  const [showAdvanceInvoiceConfirm, setShowAdvanceInvoiceConfirm] = useState(false);
  const [showAdvancePixQr, setShowAdvancePixQr] = useState(false);
  const [isAdvancingInvoice, setIsAdvancingInvoice] = useState(false);
  const [advanceInvoicePayment, setAdvanceInvoicePayment] = useState<any | null>(null);
  const [advancePixQrData, setAdvancePixQrData] = useState<{ encodedImage: string; payload: string; paymentId: string; value: number } | null>(null);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const lastCepLookupRef = useRef('');

  const formatLocalYmd = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatLocalDmy = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getCycleRangeByDueDay = (dueDayRaw: number, now: Date) => {
    const dueDay = Number(dueDayRaw);
    if (!Number.isFinite(dueDay) || dueDay <= 0) return null;

    const clampToMonth = (year: number, monthIndex: number, day: number) => {
      const lastDay = new Date(year, monthIndex + 1, 0).getDate();
      const safeDay = Math.min(Math.max(1, day), lastDay);
      return new Date(year, monthIndex, safeDay);
    };

    const year = now.getFullYear();
    const month = now.getMonth();
    const todayNoTime = new Date(year, month, now.getDate());

    const startThisMonth = clampToMonth(year, month, dueDay);
    let cycleStart: Date;
    if (startThisMonth <= todayNoTime) {
      cycleStart = startThisMonth;
    } else {
      const prevMonthDate = new Date(year, month - 1, 1);
      cycleStart = clampToMonth(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), dueDay);
    }

    const nextMonthDate = new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, 1);
    const cycleEnd = clampToMonth(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), dueDay);

    return { cycleStart, cycleEnd };
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (asaasCustomerId) {
      fetchInvoices();
    }
  }, [asaasCustomerId]);

  useEffect(() => {
    if (invoices.length > 0 && userId) {
      const fetchHistory = async () => {
        // Mostrar todas as faturas, não apenas as pagas
        const historyPromises = invoices.map(async (inv) => {
          // Usa o valor da coluna user_valor_mensal como base (userPlanValue)
          const planBasePrice = userPlanValue > 0 ? userPlanValue : 0; 
          
          const totalPaid = inv.value;
          // Custo Adicional: A diferença entre o valor da cobrança com o valor em "user_valor_mensal"
          const extraPaid = planBasePrice > 0 ? Math.max(0, totalPaid - planBasePrice) : 0;
          
          // Leads Excedidos: Calculado pegando o extraPaid e dividindo por 2 (custo por lead)
          const leadsExceededCount = extraPaid > 0 ? Math.floor(extraPaid / 2) : 0;
          
          const date = new Date(inv.clientPaymentDate || inv.dateCreated);
          const monthName = date.toLocaleString('pt-BR', { month: 'long' });
          
          // Calcular range de datas para buscar leads do mês da fatura
          const year = date.getFullYear();
          const month = date.getMonth();
          const startDate = new Date(year, month, 1).toISOString().split('T')[0];
          const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

          // Buscar contagem de leads (Total de Leads)
          const { count } = await supabase
            .from('leads_v2')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', `${startDate}T00:00:00`)
            .lte('created_at', `${endDate}T23:59:59`)
            .not('TRIAL', 'eq', 'SIM')
            .or('lead_canal_origem.is.null,lead_canal_origem.not.ilike.%worklivoo-%');
            
          const leadsCount = count || 0;
          
          return {
            month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
            year: date.getFullYear().toString(),
            planValue: planBasePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            leadsCount: leadsCount,
            leadsExceededCount: leadsExceededCount,
            exceeded: extraPaid > 0 ? 1 : 0, // Flag para indicar que houve excedente
            extraValue: extraPaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            status: inv.status,
            totalValue: totalPaid
          };
        });
        
        const history = await Promise.all(historyPromises);
        setUsageHistory(history);
      };
      
      fetchHistory();
    }
  }, [invoices, userPlanValue, userId]);

  const fetchInvoices = async () => {
    if (!asaasCustomerId) return;
    
    setIsLoadingInvoices(true);
    try {
      const apiKey = getAsaasApiKey();
      if (!apiKey && shouldRequireAsaasApiKey()) {
        console.error('API Key não encontrada');
        return;
      }

      console.log('[Asaas] Buscando faturas:', { customer: asaasCustomerId, hasApiKey: Boolean(apiKey) });
      const response = await asaasFetch(`/payments?customer=${asaasCustomerId}&limit=12&sort=dateCreated&order=desc`, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          ...(apiKey ? { access_token: apiKey } : {})
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Faturas recebidas:', data);
        if (data.data && Array.isArray(data.data)) {
          setInvoices(data.data);
        }
      } else {
        console.error('Erro ao buscar faturas:', await response.text());
      }
    } catch (error) {
      console.error('Erro ao buscar faturas:', error);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const user = await getCurrentUser();
      if (!user) return;
      setUserId(user.id);

      // Buscar dados do usuário no banco
      const { data: userData, error } = await supabase
        .from('usuarios_v2')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (userData) {
        // Se já tiver ID Asaas, marcamos como salvo
        if (userData.id_cliente_asaas) {
          setAsaasCustomerId(userData.id_cliente_asaas);
          setIsSaved(true);
        }

        const existingSubscriptionId = (userData as any).id_assinatura_asaas;
        if (existingSubscriptionId) {
          setAsaasSubscriptionId(existingSubscriptionId);
        }
        
        // Se já tiver token do cartão, consideramos a assinatura configurada para liberar a visualização completa da página.
        if (userData.cartao_token) {
          const token = String(userData.cartao_token);
          setSavedCardToken(token);
          setIsCardSaved(true);
        }

        // Se já tiver final do cartão, carregamos
        if (userData.cartao_final) {
          setCardFinal(userData.cartao_final);
        }

        // Definir valor do plano do usuário (user_valor_mensal)
        if (userData.user_valor_mensal) {
            let valStr = String(userData.user_valor_mensal).replace('R$', '').trim();
            if (valStr.includes(',')) {
                valStr = valStr.replace(/\./g, '').replace(',', '.');
            }
            const val = parseFloat(valStr);
            if (!isNaN(val)) setUserPlanValue(val);
        }

        // Definir limite de leads (user_quantidade_leads)
        const quantidadeLeads = Number((userData as any).user_quantidade_leads);
        if (Number.isFinite(quantidadeLeads) && quantidadeLeads > 0) {
          setUserPlanLimit(quantidadeLeads);
        }

        setUserPlanName(String(userData.user_plano || '').trim());
        setPlanStatus(String(userData.plano_status || '').trim());

        const hasCupom = Boolean((userData as any).cupom);
        setHasUsedCoupon(hasCupom);
        if (hasCupom) {
          setCouponStatus(null);
          setCouponMessage('Cupom já utilizado');
        }
        
        // Calcular uso do plano pelo ciclo (dia_vencimento -> próximo dia_vencimento)
        const now = new Date();
        const dueDay = Number(userData.dia_vencimento);
        const cycleRange = getCycleRangeByDueDay(dueDay, now);
        if (cycleRange) {
          setUsagePeriodLabel(`Período: ${formatLocalDmy(cycleRange.cycleStart)} a ${formatLocalDmy(cycleRange.cycleEnd)}`);
          const startIso = new Date(
            cycleRange.cycleStart.getFullYear(),
            cycleRange.cycleStart.getMonth(),
            cycleRange.cycleStart.getDate(),
            0,
            0,
            0
          ).toISOString();
          const endIso = new Date(
            cycleRange.cycleEnd.getFullYear(),
            cycleRange.cycleEnd.getMonth(),
            cycleRange.cycleEnd.getDate(),
            0,
            0,
            0
          ).toISOString();

          const { count: currentLeads } = await supabase
            .from('leads_v2')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('created_at', startIso)
            .lt('created_at', endIso)
            .not('TRIAL', 'eq', 'SIM')
            .or('lead_canal_origem.is.null,lead_canal_origem.not.ilike.%worklivoo-%');

          if (currentLeads !== null) setCurrentMonthLeads(currentLeads);
        } else {
          const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          setUsagePeriodLabel(`Período: ${formatLocalDmy(startMonth)} a ${formatLocalDmy(endMonth)}`);
          const startIso = startMonth.toISOString();
          const endIso = endMonth.toISOString();

          const { count: currentLeads } = await supabase
            .from('leads_v2')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('created_at', startIso)
            .lt('created_at', endIso)
            .not('TRIAL', 'eq', 'SIM')
            .or('lead_canal_origem.is.null,lead_canal_origem.not.ilike.%worklivoo-%');

          if (currentLeads !== null) setCurrentMonthLeads(currentLeads);
        }

        // Calcular dias para renovação
        if (userData.dia_vencimento) {
            const today = new Date();
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth(); // 0-11
            const dueDay = parseInt(userData.dia_vencimento);

            // Tentar criar a data de vencimento neste mês
            let nextDueDate = new Date(currentYear, currentMonth, dueDay);

            // Verificar se o dia solicitado existe neste mês (ex: 31 em Fevereiro)
            // O objeto Date ajusta automaticamente (ex: 31 Fev -> 3 Mar), então precisamos corrigir se o mês mudou
            if (nextDueDate.getMonth() !== currentMonth) {
                 // Se pulou o mês, significa que o dia não existe neste mês (ex: 31/02), então pega o último dia do mês
                 nextDueDate = new Date(currentYear, currentMonth + 1, 0);
            }

            // Se a data de vencimento já passou hoje (ou é hoje), a próxima é no mês que vem
            // Definimos hoje sem hora para comparar apenas a data
            const todayNoTime = new Date(currentYear, currentMonth, today.getDate());
            
            if (nextDueDate <= todayNoTime) {
                 nextDueDate = new Date(currentYear, currentMonth + 1, dueDay);
                 // Corrigir novamente caso o próximo mês não tenha o dia (ex: 31/04)
                 if (nextDueDate.getMonth() !== (currentMonth + 1) % 12) {
                    nextDueDate = new Date(currentYear, currentMonth + 2, 0);
                 }
            }

            const diffTime = Math.abs(nextDueDate.getTime() - todayNoTime.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            setRenewalDays(diffDays);
        }

        setFormData((prev) => {
          const pickDb = (dbValue: any, fallback: string) => {
            const v = dbValue === null || dbValue === undefined ? '' : String(dbValue).trim();
            return v ? v : fallback;
          };

          return {
            ...prev,
            nome: pickDb(userData.user_nome, prev.nome || ''),
            email: pickDb(userData.user_email, prev.email || ''),
            celular: pickDb(userData.user_telefone, prev.celular || ''),
            cep: pickDb(userData.user_cep_faturamento, prev.cep || ''),
            endereco: pickDb(userData.user_endereco_faturamento, prev.endereco || ''),
            bairro: pickDb(userData.user_bairro_faturamento, prev.bairro || ''),
            cidade: pickDb(userData.user_cidade_faturamento, prev.cidade || ''),
            documento: pickDb(userData.user_cnpj_faturamento, prev.documento || ''),
            emailNf: pickDb(userData.user_email_nf_faturamento, prev.emailNf || ''),
            telefoneFaturamento: pickDb(userData.user_telefone_faturamento, prev.telefoneFaturamento || ''),
            numero: pickDb((userData as any).user_numero_endereco_faturamento, prev.numero || ''),
            complemento: pickDb(userData.user_complemento_faturamento, prev.complemento || ''),
            estado: pickDb(userData.user_estado_faturamento, prev.estado || ''),
          };
        });
      }
    } catch {
      toast.error('Erro ao carregar informações do usuário.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatCepValue = (value: string) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };

  const fillAddressByCep = async (cepDigits: string, options?: { force?: boolean; source?: 'input' | 'button' }) => {
    const forceLookup = Boolean(options?.force);
    const source = options?.source || 'input';

    if (cepDigits.length !== 8) {
      console.log('[CEP] Busca ignorada: CEP incompleto.', { cepDigits, source });
      return;
    }

    if (!forceLookup && lastCepLookupRef.current === cepDigits) {
      console.log('[CEP] Busca ignorada: CEP ja consultado anteriormente.', { cepDigits, source });
      return;
    }

    setIsFetchingCep(true);
    lastCepLookupRef.current = cepDigits;
    console.log('[CEP] Iniciando busca.', { cepDigits, source, forceLookup });

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
      if (!response.ok) {
        console.error('[CEP] Falha HTTP ao consultar CEP.', { cepDigits, source, status: response.status });
        throw new Error('Falha ao consultar o CEP.');
      }

      const data: ViaCepResponse = await response.json();
      if (data.erro) {
        console.warn('[CEP] CEP nao encontrado no ViaCEP.', { cepDigits, source, data });
        toast.error('CEP nao encontrado.');
        return;
      }

      setFormData((prev) => {
        const currentCepDigits = String(prev.cep || '').replace(/\D/g, '');
        if (currentCepDigits !== cepDigits) {
          console.warn('[CEP] Resposta descartada porque o CEP mudou durante a consulta.', {
            cepDigits,
            currentCepDigits,
            source,
          });
          return prev;
        }

        const nextData = {
          ...prev,
          endereco: String(data.logradouro || '').trim() || prev.endereco,
          bairro: String(data.bairro || '').trim() || prev.bairro,
          cidade: String(data.localidade || '').trim() || prev.cidade,
          estado: String(data.uf || '').trim() || prev.estado,
        };

        console.log('[CEP] Endereco preenchido com sucesso.', {
          cepDigits,
          source,
          endereco: nextData.endereco,
          bairro: nextData.bairro,
          cidade: nextData.cidade,
          estado: nextData.estado,
        });

        return nextData;
      });
    } catch (error) {
      console.error('[CEP] Erro ao buscar CEP.', { cepDigits, source, error });
      lastCepLookupRef.current = '';
      toast.error('Nao foi possivel buscar o CEP.');
    } finally {
      setIsFetchingCep(false);
    }
  };

  const handleCepChange = (value: string) => {
    const formattedCep = formatCepValue(value);

    setFormData((prev) => ({ ...prev, cep: formattedCep }));

    lastCepLookupRef.current = '';
    setIsFetchingCep(false);
  };

  const handleFillCepButtonClick = () => {
    const cepDigits = String(formData.cep || '').replace(/\D/g, '');
    console.log('[CEP] Clique no botao de preencher endereco.', { cepDigits });

    if (cepDigits.length !== 8) {
      console.warn('[CEP] Clique ignorado: CEP incompleto.', { cepDigits });
      toast.error('Digite um CEP valido com 8 numeros.');
      return;
    }

    void fillAddressByCep(cepDigits, { force: true, source: 'button' });
  };

  const handleCardChange = (field: string, value: string) => {
    setCardData(prev => ({ ...prev, [field]: value }));
  };

  const handleOpenCardChargeConfirm = () => {
    setShowCardChargeConfirm(true);
  };

  const formatCurrencyBRL = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const getLocalYmd = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const clampDueDay = (day: number) => {
    const d = Number(day);
    if (!Number.isFinite(d) || d <= 0) return null;
    return d >= 29 ? 28 : d;
  };

  const computeNextMonthDueDate = (day: number, now: Date) => {
    const dueDay = clampDueDay(day);
    if (!dueDay) return null;
    const nextMonthBase = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastDay = new Date(nextMonthBase.getFullYear(), nextMonthBase.getMonth() + 1, 0).getDate();
    const safeDay = Math.min(dueDay, lastDay);
    return new Date(nextMonthBase.getFullYear(), nextMonthBase.getMonth(), safeDay);
  };

  const applyInvoiceSettingsToSubscription = async (subscriptionId: string, apiKey?: string) => {
    const payload = {
      taxes: {
        retainIss: false,
        iss: 0,
        pisCofinsTaxStatus: 'NONE',
      },
      municipalServiceId: '282549',
      municipalServiceName:
        '749019909 - OUTRAS ATIVIDADES PROFISSIONAIS CIENTIFICAS E TECNICAS NAO ESPECIFICADAS ANTERIORMENTE ESCRITORIO ADMINISTRATIVO',
      effectiveDatePeriod: 'ON_PAYMENT_CONFIRMATION',
    };

    console.log('[Asaas] Aplicando invoiceSettings na assinatura.', { subscriptionId, payload });

    const resp = await asaasFetch(`/subscriptions/${encodeURIComponent(subscriptionId)}/invoiceSettings`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        ...(apiKey ? { access_token: apiKey } : {}),
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errJson = await resp.json().catch(() => null);
      const errText = errJson ? JSON.stringify(errJson) : await resp.text().catch(() => '');
      console.error('[Asaas] Erro ao aplicar invoiceSettings.', { subscriptionId, err: errText });
      throw new Error(errJson?.errors?.[0]?.description || 'Erro ao configurar invoiceSettings da assinatura.');
    }

    const json = await resp.json().catch(() => null);
    console.log('[Asaas] invoiceSettings aplicado com sucesso.', { subscriptionId, response: json });
    return json;
  };

  const getOpenSubscriptionPayment = async (subscriptionId: string) => {
    const apiKey = getAsaasApiKey();
    if (!apiKey && shouldRequireAsaasApiKey()) throw new Error('Chave de API não configurada');

    const resp = await asaasFetch(`/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=20`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...(apiKey ? { access_token: apiKey } : {}),
      },
    });

    const json = await resp.json().catch(() => null);
    const list = json?.data;
    if (!Array.isArray(list) || list.length === 0) return null;

    const score = (p: any) => {
      const status = String(p?.status || '').toUpperCase();
      if (status === 'OVERDUE') return 0;
      if (status === 'PENDING') return 1;
      return 9;
    };

    const candidates = list
      .filter((p: any) => {
        const s = String(p?.status || '').toUpperCase();
        return s === 'PENDING' || s === 'OVERDUE';
      })
      .sort((a: any, b: any) => {
        const sa = score(a);
        const sb = score(b);
        if (sa !== sb) return sa - sb;
        const da = new Date(String(a?.dueDate || a?.dateCreated || '')).getTime() || 0;
        const db = new Date(String(b?.dueDate || b?.dateCreated || '')).getTime() || 0;
        return da - db;
      });

    return candidates[0] || null;
  };

  const cancelFuturePendingSubscriptionPayments = async (subscriptionId: string, apiKey?: string) => {
    const resp = await asaasFetch(`/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=100`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...(apiKey ? { access_token: apiKey } : {}),
      },
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => null);
      throw new Error(err?.errors?.[0]?.description || 'Erro ao listar cobranças da assinatura.');
    }

    const json = await resp.json().catch(() => null);
    const list = json?.data;
    if (!Array.isArray(list) || list.length === 0) return { canceledCount: 0, failedCount: 0 };

    const now = new Date();
    const todayNoTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const futurePending = list.filter((p: any) => {
      const status = String(p?.status || '').toUpperCase();
      if (status !== 'PENDING') return false;
      const dueRaw = p?.dueDate || p?.clientPaymentDate || p?.dateCreated;
      if (!dueRaw) return false;
      const due = new Date(String(dueRaw));
      if (Number.isNaN(due.getTime())) return false;
      const dueNoTime = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      return dueNoTime.getTime() > todayNoTime.getTime();
    });

    if (futurePending.length === 0) return { canceledCount: 0, failedCount: 0 };

    console.log('[Asaas] Cancelando cobrancas futuras pendentes apos antecipacao.', {
      subscriptionId,
      count: futurePending.length,
      ids: futurePending.map((p: any) => p?.id).filter(Boolean),
    });

    let canceledCount = 0;
    let failedCount = 0;

    for (const p of futurePending) {
      const paymentId = String(p?.id || '').trim();
      if (!paymentId) continue;

      const delResp = await asaasFetch(`/payments/${encodeURIComponent(paymentId)}`, {
        method: 'DELETE',
        headers: {
          accept: 'application/json',
          ...(apiKey ? { access_token: apiKey } : {}),
        },
      });

      if (!delResp.ok) {
        failedCount += 1;
        const err = await delResp.json().catch(() => null);
        console.error('[Asaas] Falha ao cancelar cobrança futura pendente.', {
          subscriptionId,
          paymentId,
          err,
        });
        continue;
      }

      canceledCount += 1;
    }

    console.log('[Asaas] Cancelamento de cobrancas futuras pendentes concluido.', {
      subscriptionId,
      canceledCount,
      failedCount,
    });

    return { canceledCount, failedCount };
  };

  const openAdvanceInvoice = async () => {
    if (!asaasSubscriptionId) {
      toast.error('Assinatura não identificada.');
      return;
    }
    setIsAdvancingInvoice(true);
    try {
      const payment = await getOpenSubscriptionPayment(asaasSubscriptionId);
      if (!payment?.id) {
        toast.error('Nenhuma fatura em aberto encontrada.');
        return;
      }
      setAdvanceInvoicePayment(payment);
      setShowAdvanceInvoiceConfirm(true);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao buscar fatura.');
    } finally {
      setIsAdvancingInvoice(false);
    }
  };

  const applyAdvanceFinalUpdates = async () => {
    if (!userId) throw new Error('Usuário não identificado.');
    if (!asaasSubscriptionId) throw new Error('Assinatura não identificada.');

    const apiKey = getAsaasApiKey();
    if (!apiKey && shouldRequireAsaasApiKey()) throw new Error('Chave de API não configurada');

    const now = new Date();
    const dueDay = clampDueDay(now.getDate());
    if (!dueDay) throw new Error('Dia de vencimento inválido.');

    const nextDueDate = computeNextMonthDueDate(dueDay, now);
    if (!nextDueDate) throw new Error('Não foi possível calcular o próximo vencimento.');
    const nextDueDateYmd = getLocalYmd(nextDueDate);

    const updateSubscriptionResp = await asaasFetch(`/subscriptions/${encodeURIComponent(asaasSubscriptionId)}`, {
      method: 'PUT',
      headers: {
        accept: 'application/json',
        ...(apiKey ? { access_token: apiKey } : {}),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        nextDueDate: nextDueDateYmd,
        updatePendingPayments: true,
      }),
    });

    if (!updateSubscriptionResp.ok) {
      const err = await updateSubscriptionResp.json().catch(() => null);
      throw new Error(err?.errors?.[0]?.description || 'Erro ao atualizar assinatura.');
    }

    const { error: updateError } = await supabase
      .from('usuarios_v2')
      .update({ dia_vencimento: dueDay } as any)
      .eq('user_id', userId);

    if (updateError) throw updateError;

    try {
      const { canceledCount, failedCount } = await cancelFuturePendingSubscriptionPayments(asaasSubscriptionId, apiKey || undefined);
      console.log('[Asaas] Resultado do cancelamento silencioso de cobrancas futuras pendentes.', {
        subscriptionId: asaasSubscriptionId,
        canceledCount,
        failedCount,
      });
    } catch (e: any) {
      console.error('[Asaas] Erro ao cancelar cobrancas futuras pendentes apos antecipacao.', e);
    }

    await loadInitialData();
  };

  const confirmAdvanceInvoice = async () => {
    if (!advanceInvoicePayment?.id) {
      toast.error('Fatura não identificada.');
      return;
    }
    if (!asaasSubscriptionId) {
      toast.error('Assinatura não identificada.');
      return;
    }

    const isPix = String(cardFinal || '').toUpperCase() === 'PIX' || String(savedCardToken || '').toUpperCase() === 'PIX';
    const apiKey = getAsaasApiKey();
    if (!apiKey && shouldRequireAsaasApiKey()) {
      toast.error('Chave de API não configurada');
      return;
    }

    setIsAdvancingInvoice(true);
    try {
      const paymentId = String(advanceInvoicePayment.id);
      const value = Number(advanceInvoicePayment.value || 0);

      if (isPix) {
        const qrResp = await asaasFetch(`/payments/${encodeURIComponent(paymentId)}/pixQrCode`, {
          method: 'GET',
          headers: {
            accept: 'application/json',
            ...(apiKey ? { access_token: apiKey } : {}),
          },
        });

        if (!qrResp.ok) {
          const err = await qrResp.json().catch(() => null);
          throw new Error(err?.errors?.[0]?.description || 'Erro ao gerar QR Code.');
        }

        const qrJson = await qrResp.json().catch(() => null);
        const encodedImage = String(qrJson?.encodedImage || '').trim();
        const payload = String(qrJson?.payload || '').trim();
        if (!encodedImage || !payload) throw new Error('QR Code inválido.');

        setAdvancePixQrData({ encodedImage, payload, paymentId, value });
        setShowAdvanceInvoiceConfirm(false);
        setShowAdvancePixQr(true);
        toast.success('PIX gerado. Pague para confirmar a antecipação.');
        return;
      }

      const token = String(savedCardToken || '').trim();
      if (!token || token.toUpperCase() === 'PIX') {
        throw new Error('Token do cartão não identificado.');
      }

      const payResp = await asaasFetch(`/payments/${encodeURIComponent(paymentId)}/payWithCreditCard`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          access_token: apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          creditCardToken: token,
        }),
      });

      if (!payResp.ok) {
        const err = await payResp.json().catch(() => null);
        throw new Error(err?.errors?.[0]?.description || 'Não foi possível cobrar no cartão.');
      }

      await applyAdvanceFinalUpdates();
      setShowAdvanceInvoiceConfirm(false);
      setAdvanceInvoicePayment(null);
      toast.success(`Fatura antecipada com sucesso! Cobrado ${formatCurrencyBRL(value)}.`);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao antecipar fatura.');
    } finally {
      setIsAdvancingInvoice(false);
    }
  };

  const handleValidateCoupon = async () => {
    if (isValidatingCoupon) return;
    if (hasUsedCoupon) {
      setCouponStatus(null);
      setCouponMessage('Cupom já utilizado');
      return;
    }
    const normalized = String(couponCode || '').trim().toUpperCase();
    if (!normalized) return;
    if (normalized !== 'TRIAL') {
      setCouponStatus('error');
      setCouponMessage('Cupom inválido.');
      return;
    }
    if (!userId) {
      toast.error('Usuário não identificado.');
      return;
    }

    setIsValidatingCoupon(true);
    setCouponStatus(null);
    setCouponMessage('');
    try {
      const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('usuarios_v2')
        .update({
          cliente_status: 'Trial',
          data_final_trial: end,
          cupom: true,
        } as any)
        .eq('user_id', userId);

      if (error) throw error;

      setHasUsedCoupon(true);
      setCouponStatus('success');
      setCouponMessage('Cupom Validado, TRIAL ativado');
      toast.success('Cupom Validado, TRIAL ativado');
    } catch (err: any) {
      setCouponStatus('error');
      setCouponMessage('Não foi possível validar o cupom.');
      toast.error(err?.message || 'Não foi possível validar o cupom.');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  // Effect para polling do PIX
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (pixPaymentData && !isCardSaved) {
        interval = setInterval(checkPixStatus, 3000); // Checa a cada 3s
    }
    return () => {
        if (interval) clearInterval(interval);
    };
  }, [pixPaymentData, isCardSaved]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (!showAdvancePixQr || !advancePixQrData?.paymentId) return;

    const check = async () => {
      try {
        const apiKey = getAsaasApiKey();
        if (!apiKey && shouldRequireAsaasApiKey()) return;

        const resp = await asaasFetch(`/payments/${encodeURIComponent(advancePixQrData.paymentId)}`, {
          method: 'GET',
          headers: {
            accept: 'application/json',
            ...(apiKey ? { access_token: apiKey } : {}),
          },
        });

        if (!resp.ok) return;
        const data = await resp.json().catch(() => null);
        const status = String(data?.status || '').toUpperCase();
        if (status === 'RECEIVED' || status === 'CONFIRMED') {
          setIsAdvancingInvoice(true);
          try {
            await applyAdvanceFinalUpdates();
            setShowAdvancePixQr(false);
            setAdvancePixQrData(null);
            setAdvanceInvoicePayment(null);
            toast.success('Pagamento confirmado! Ciclo antecipado com sucesso.');
          } catch (e: any) {
            toast.error(e?.message || 'Pagamento confirmado, mas não foi possível finalizar a antecipação.');
          } finally {
            setIsAdvancingInvoice(false);
          }
        }
      } catch {
      }
    };

    interval = setInterval(check, 3000);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [advancePixQrData?.paymentId, showAdvancePixQr]);

  const generatePixCharge = async (customerId: string) => {
    try {
      setIsLoading(true);
      const apiKey = getAsaasApiKey();
      if (!apiKey && shouldRequireAsaasApiKey()) throw new Error('Chave de API não configurada');

      const valueToCharge = userPlanValue;
      if (!valueToCharge || valueToCharge <= 0) {
        throw new Error('Valor mensal do plano inválido.');
      }
      
      // Ajuste de data local para evitar problemas de fuso horário (UTC vs Local)
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const localDueDate = `${year}-${month}-${day}`;

      let subscriptionId = asaasSubscriptionId;
      if (!subscriptionId) {
        const subscriptionResponse = await asaasFetch('/subscriptions', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            ...(apiKey ? { access_token: apiKey } : {}),
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            billingType: 'PIX',
            cycle: 'MONTHLY',
            customer: customerId,
            value: valueToCharge,
            nextDueDate: localDueDate,
            description: 'JULIA IA'
          })
        });

        if (!subscriptionResponse.ok) {
          const err = await subscriptionResponse.json().catch(() => null);
          throw new Error(err?.errors?.[0]?.description || 'Erro ao criar assinatura PIX');
        }

        const subscriptionData = await subscriptionResponse.json();
        subscriptionId = subscriptionData.id;
        if (!subscriptionId) throw new Error('ID da assinatura não retornado pelo Asaas.');

        const { error: updateSubscriptionError } = await supabase
          .from('usuarios_v2')
          .update({ id_assinatura_asaas: subscriptionId } as any)
          .eq('user_id', userId);

        if (updateSubscriptionError) {
          console.error('Erro ao salvar id_assinatura_asaas:', updateSubscriptionError);
        }

        setAsaasSubscriptionId(subscriptionId);

        try {
          await applyInvoiceSettingsToSubscription(subscriptionId, apiKey || undefined);
        } catch (e: any) {
          console.error('[Asaas] Falha ao configurar invoiceSettings apos criar assinatura PIX.', e);
          toast.error(e?.message || 'Assinatura criada, mas nao foi possivel configurar invoiceSettings.');
        }
      }

      let paymentData: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const paymentsResponse = await asaasFetch(
          `/payments?subscription=${encodeURIComponent(subscriptionId)}&limit=1&sort=dateCreated&order=desc`,
          {
            method: 'GET',
            headers: {
              'accept': 'application/json',
              ...(apiKey ? { access_token: apiKey } : {})
            }
          }
        );

        if (paymentsResponse.ok) {
          const paymentsJson = await paymentsResponse.json().catch(() => null);
          const list = paymentsJson?.data;
          if (Array.isArray(list) && list.length > 0) {
            paymentData = list[0];
            break;
          }
        }

        await new Promise((r) => setTimeout(r, 500));
      }

      if (!paymentData?.id) {
        const subPaymentsResponse = await asaasFetch(`/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=1`, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            ...(apiKey ? { access_token: apiKey } : {})
          }
        });

        if (subPaymentsResponse.ok) {
          const subPaymentsJson = await subPaymentsResponse.json().catch(() => null);
          const list = subPaymentsJson?.data;
          if (Array.isArray(list) && list.length > 0) {
            paymentData = list[0];
          }
        }
      }

      if (!paymentData?.id) {
        throw new Error('Não foi possível localizar a cobrança PIX da assinatura.');
      }

      const paymentId = paymentData.id;

      // 2. Obter QR Code
      const qrResponse = await asaasFetch(`/payments/${paymentId}/pixQrCode`, {
        method: 'GET',
        headers: {
            'accept': 'application/json',
            ...(apiKey ? { access_token: apiKey } : {})
        }
      });

      if (!qrResponse.ok) throw new Error('Erro ao gerar QR Code');

      const qrData = await qrResponse.json();

      // 3. Atualizar dia de vencimento no Supabase (Igual ao cartão)
      const dateForUpdate = new Date();
      let dueDay = dateForUpdate.getDate();
      
      // Regra: se for dia 29, 30 ou 31, ajusta para 28 para evitar problemas com meses mais curtos
      if (dueDay >= 29) {
        dueDay = 28;
      }

      const { error: updateError } = await supabase
        .from('usuarios_v2')
        .update({ dia_vencimento: dueDay })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Erro ao atualizar dia de vencimento:', updateError);
        // Não vamos interromper o fluxo se falhar isso, mas logamos o erro
      }

      setPixPaymentData({
        id: paymentId,
        payload: qrData.payload,
        encodedImage: qrData.encodedImage,
        value: paymentData.value,
        expirationDate: paymentData.dueDate
      });

      toast.success('Assinatura PIX criada! Realize o pagamento para ativar.');

    } catch (error: any) {
        console.error('Erro PIX:', error);
        toast.error(error.message || 'Erro ao gerar PIX');
    } finally {
        setIsLoading(false);
    }
  };

  const checkPixStatus = async () => {
      // Se não tiver dados do PIX ou já tiver cartão salvo (fluxo completo), não faz nada
      if (!pixPaymentData || isCardSaved) return;
      
      try {
          const apiKey = getAsaasApiKey();
          if (!apiKey && shouldRequireAsaasApiKey()) return;

          const response = await asaasFetch(`/payments/${pixPaymentData.id}`, {
              method: 'GET',
              headers: {
                  'accept': 'application/json',
                  ...(apiKey ? { access_token: apiKey } : {})
              }
          });

          if (response.ok) {
              const data = await response.json();
              if (data.status === 'RECEIVED' || data.status === 'CONFIRMED') {
                  await handlePixSuccess();
              }
          }
      } catch (error) {
          console.error('Erro ao verificar status PIX:', error);
      }
  };

  const handlePixSuccess = async () => {
      // Evita chamadas múltiplas se já estiver salvando
      if (isCardSaved) return;
      if (!userId) {
        toast.error('Usuário não identificado.');
        return;
      }

      setIsLoading(true);
      try {
          // Atualizar usuário
          const { error } = await supabase
            .from('usuarios_v2')
            .update({
                cartao_token: 'PIX',
                cartao_final: 'PIX',
                plano_status: 'Ativado',
            })
            .eq('user_id', userId);

          if (error) throw error;
          
          setCardFinal('PIX');
          setIsCardSaved(true);
          setPixPaymentData(null); 
          toast.success('Pagamento confirmado! Assinatura ativa.');
          
          try {
            await fetch('https://primary-production-d442.up.railway.app/webhook/cartao-ativado', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });
          } catch (e) { console.error(e); }

      } catch (error) {
          console.error('Erro ao ativar assinatura PIX:', error);
          toast.error('Pagamento identificado, mas erro ao ativar.');
      } finally {
          setIsLoading(false);
      }
  };

  const handleSave = async () => {
    // Validação básica
    const telefoneDigitsRaw = String(formData.telefoneFaturamento || '').replace(/\D/g, '');
    const telefoneDigits = telefoneDigitsRaw
      ? telefoneDigitsRaw.startsWith('55')
        ? telefoneDigitsRaw
        : `55${telefoneDigitsRaw}`
      : '';

    if (!formData.nome || !formData.documento || !formData.emailNf || !telefoneDigits) {
      toast.error('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    if (telefoneDigits.length < 12) {
      toast.error('Telefone de faturamento inválido.');
      return;
    }

    if (!userId) {
      toast.error('Usuário não identificado.');
      return;
    }

    setIsLoading(true);

    try {
      const normalizedCep = String(formData.cep || '').replace(/\D/g, '');
      const normalizedDocumento = String(formData.documento || '').replace(/\D/g, '');
      const normalizedTelefone = telefoneDigits;
      const asaasTelefone = normalizedTelefone.startsWith('55') ? normalizedTelefone.slice(2) : normalizedTelefone;
      const emailNf = String(formData.emailNf || '').trim();

      let currentAsaasId = asaasCustomerId;

      if (!currentAsaasId) {
        const apiKey = getAsaasApiKey();
        if (!apiKey && shouldRequireAsaasApiKey()) throw new Error('Chave de API do Asaas não configurada.');

        const { data: companyData } = await supabase
          .from('usuarios_v2')
          .select('user_empresa')
          .eq('user_id', userId)
          .single();

        const companyName = String((companyData as any)?.user_empresa || '').trim();

        const asaasPayload = {
          name: companyName || formData.nome,
          cpfCnpj: normalizedDocumento,
          email: emailNf,
          mobilePhone: asaasTelefone,
          address: String(formData.endereco || '').trim(),
          addressNumber: String(formData.numero || '').trim(),
          complement: String(formData.complemento || '').trim(),
          province: String(formData.bairro || '').trim(),
          postalCode: String(formData.cep || '').trim(),
          notificationDisabled: true
        };

        console.log('Payload Cliente Asaas:', asaasPayload);

        const response = await asaasFetch('/customers', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            ...(apiKey ? { access_token: apiKey } : {}),
            'content-type': 'application/json'
          },
          body: JSON.stringify(asaasPayload)
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Erro Asaas:', errorData);
          throw new Error(errorData.errors?.[0]?.description || 'Erro ao criar cliente no Asaas');
        }

        const asaasData = await response.json();
        const asaasId = asaasData.id;

        if (!asaasId) throw new Error('ID do cliente não retornado pelo Asaas');
        currentAsaasId = asaasId;
      }

      const updateData: any = {
        id_cliente_asaas: currentAsaasId,
        user_cep_faturamento: normalizedCep,
        user_endereco_faturamento: String(formData.endereco || '').trim(),
        user_bairro_faturamento: String(formData.bairro || '').trim(),
        user_cidade_faturamento: String(formData.cidade || '').trim(),
        user_cnpj_faturamento: normalizedDocumento,
        user_email_nf_faturamento: emailNf,
        user_telefone_faturamento: normalizedTelefone,
        user_numero_endereco_faturamento: String(formData.numero || '').trim(),
        user_complemento_faturamento: String(formData.complemento || '').trim(),
        user_estado_faturamento: String(formData.estado || '').trim(),
      };

      if (paymentMethod === 'PIX') {
        updateData.cartao_token = 'PIX';
        updateData.cartao_final = 'PIX';
      }

      const { error: updateError } = await supabase
        .from('usuarios_v2')
        .update(updateData)
        .eq('user_id', userId);

      if (updateError) throw updateError;

      setAsaasCustomerId(currentAsaasId);
      setIsSaved(true);

      if (paymentMethod === 'PIX') {
        await generatePixCharge(currentAsaasId);
      } else {
        toast.success('Cliente cadastrado com sucesso!');
      }

    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error(error.message || 'Erro ao salvar informações.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCard = async () => {
    // Validação básica do cartão
    const holderNameToSend = (cardData.holderName || formData.nome || '').trim();
    if (!holderNameToSend || !cardData.number || !cardData.expiryMonth || !cardData.expiryYear || !cardData.ccv) {
      toast.error('Por favor, preencha todos os dados do cartão.');
      return;
    }

    const telefoneDigitsRaw = String(formData.telefoneFaturamento || '').replace(/\D/g, '');
    const telefoneDigits = telefoneDigitsRaw
      ? telefoneDigitsRaw.startsWith('55')
        ? telefoneDigitsRaw
        : `55${telefoneDigitsRaw}`
      : '';
    const asaasTelefone = telefoneDigits.startsWith('55') ? telefoneDigits.slice(2) : telefoneDigits;

    if (!formData.documento || !formData.emailNf || !telefoneDigits || !formData.cep || !formData.numero) {
      toast.error('Preencha os dados de faturamento para continuar.');
      return;
    }
    if (telefoneDigits.length < 12) {
      toast.error('Telefone de faturamento inválido.');
      return;
    }

    if (!userId) {
      toast.error('Usuário não identificado.');
      return;
    }

    setIsLoading(true);

    try {
      if (!asaasCustomerId) throw new Error('Cliente Asaas não identificado.');

      const apiKey = import.meta.env.VITE_ASAAS_API_KEY;
      if (!apiKey) throw new Error('Chave de API do Asaas não configurada.');

      // Sanitização da API Key
      const cleanApiKey = apiKey.trim().replace(/^['"]|['"]$/g, '');

      // Obter IP do cliente
      let remoteIp = '0.0.0.0';
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        if (ipResponse.ok) {
           const ipData = await ipResponse.json();
           remoteIp = ipData.ip;
        }
      } catch (e) {
        console.warn('Não foi possível obter o IP do cliente, usando padrão.', e);
      }

      // 1. Tokenizar cartão no Asaas (com fallback para token já salvo)
      const tokenPayload = {
        customer: asaasCustomerId,
        creditCard: {
          holderName: holderNameToSend,
          number: cardData.number.replace(/\s/g, ''),
          expiryMonth: cardData.expiryMonth,
          expiryYear: cardData.expiryYear,
          ccv: cardData.ccv
        },
        creditCardHolderInfo: {
          name: (formData.nome || holderNameToSend).trim(),
          email: String(formData.emailNf || '').trim(),
          cpfCnpj: formData.documento.replace(/\D/g, ''),
          postalCode: formData.cep.replace(/\D/g, ''),
          addressNumber: formData.numero,
          phone: asaasTelefone
        },
        remoteIp: remoteIp
      };

      console.log('Payload enviado:', tokenPayload);

      // Usando o proxy para tokenização
      // Endpoint correto para tokenizar: /api/v3/creditCard/tokenize
      let creditCardToken = '';
      let tokenizationReportedAlreadyTokenized = false;
      const response = await asaasFetch('/creditCard/tokenize', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'access_token': cleanApiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify(tokenPayload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Erro Asaas Tokenização:', errorData);
        const rawDescription = String(errorData?.errors?.[0]?.description || '');
        const description = rawDescription
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        const isAlreadyTokenized = description.includes('ja tokenizado') || description.includes('tokeniz');
        if (isAlreadyTokenized) {
          tokenizationReportedAlreadyTokenized = true;
        }
        if (isAlreadyTokenized && savedCardToken) {
          creditCardToken = savedCardToken;
        } else {
          throw new Error(rawDescription || 'Erro ao tokenizar cartão');
        }
      } else {
        const tokenData = await response.json();
        creditCardToken = tokenData.creditCardToken;
      }

      if (!creditCardToken && !tokenizationReportedAlreadyTokenized) {
        throw new Error('Cartão já tokenizado, mas nenhum token salvo foi encontrado.');
      }

      // 1.5. Criar assinatura do cartão (sem criar cobrança avulsa)
      let createdSubscriptionId: string | null = null;
      if (userPlanValue > 0 && !asaasSubscriptionId) {
        const todayForDueDate = new Date();
        const year = todayForDueDate.getFullYear();
        const month = String(todayForDueDate.getMonth() + 1).padStart(2, '0');
        const day = String(todayForDueDate.getDate()).padStart(2, '0');
        const localDueDate = `${year}-${month}-${day}`;

        const subscriptionResponse = await asaasFetch('/subscriptions', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'access_token': cleanApiKey,
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            billingType: 'CREDIT_CARD',
            cycle: 'MONTHLY',
            customer: asaasCustomerId,
            value: userPlanValue,
            nextDueDate: localDueDate,
            description: 'JULIA IA',
            ...(creditCardToken ? { creditCardToken } : {}),
          })
        });

        if (!subscriptionResponse.ok) {
          const err = await subscriptionResponse.json().catch(() => null);
          throw new Error(err?.errors?.[0]?.description || 'Erro ao criar assinatura do cartão.');
        }

        const subscriptionData = await subscriptionResponse.json();
        createdSubscriptionId = subscriptionData.id;
        if (!createdSubscriptionId) throw new Error('ID da assinatura não retornado pelo Asaas.');
        try {
          await applyInvoiceSettingsToSubscription(createdSubscriptionId, cleanApiKey || undefined);
        } catch (e: any) {
          console.error('[Asaas] Falha ao configurar invoiceSettings apos criar assinatura do cartao.', e);
          toast.error(e?.message || 'Assinatura criada, mas nao foi possivel configurar invoiceSettings.');
        }
        toast.success('Assinatura criada com sucesso!');
      }

      // 2. Calcular dia de vencimento
      const today = new Date();
      let dueDay = today.getDate();
      
      // Regra: se for dia 29, 30 ou 31, o vencimento será dia 1
      if (dueDay >= 29) {
        dueDay = 28;
      }

      // 3. Atualizar tabela usuarios
      const lastFourDigits = cardData.number.replace(/\s/g, '').slice(-4);
      const subscriptionIdToSave = asaasSubscriptionId || createdSubscriptionId;
      
      const { error: updateError } = await supabase
        .from('usuarios_v2')
        .update({
          cartao_token: creditCardToken,
          cartao_final: lastFourDigits,
          cartao_exp_mes: String(cardData.expiryMonth || '').trim(),
          cartao_exp_ano: String(cardData.expiryYear || '').trim(),
          dia_vencimento: dueDay,
          plano_status: 'Ativado',
          ...(subscriptionIdToSave ? { id_assinatura_asaas: subscriptionIdToSave } : {}),
        } as any)
        .eq('user_id', userId);

      if (updateError) throw updateError;

      setSavedCardToken(creditCardToken);
      if (createdSubscriptionId) {
        setAsaasSubscriptionId(createdSubscriptionId);
      }

      // 4. Disparar webhook de ativação
      try {
        await fetch('https://primary-production-d442.up.railway.app/webhook/cartao-ativado', {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_id: userId })
        });
      } catch (webhookError) {
        console.error('Erro ao disparar webhook:', webhookError);
      }

      setCardFinal(lastFourDigits);
      setIsCardSaved(true);
      toast.success('Cartão cadastrado com sucesso!');

    } catch (error: any) {
      console.error('Erro ao salvar cartão:', error);
      toast.error(error.message || 'Erro ao processar cartão.');
    } finally {
      setIsLoading(false);
    }
  };

  const visibleInvoices = invoices.filter((inv) => {
    const status = String((inv as any)?.status || '').toUpperCase();
    const isPaid = status === 'CONFIRMED' || status === 'RECEIVED';
    if (isPaid) return true;

    if (status === 'OVERDUE') return true;
    if (status !== 'PENDING') return false;

    const dueRaw = (inv as any)?.dueDate || (inv as any)?.clientPaymentDate || (inv as any)?.dateCreated;
    if (!dueRaw) return false;

    const dueDate = new Date(dueRaw);
    if (Number.isNaN(dueDate.getTime())) return false;

    const now = new Date();
    const todayNoTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueNoTime = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const diffMs = dueNoTime.getTime() - todayNoTime.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return diffDays <= 15;
  });

  const setupStep = paymentMethod === 'PIX' ? 1 : isSaved ? 2 : 1;
  const isSetupComplete = isSaved && isCardSaved;

  return {
    isLoading,
    setIsLoading,
    isSaved,
    setIsSaved,
    isCardSaved,
    setIsCardSaved,
    userId,
    setUserId,
    asaasCustomerId,
    setAsaasCustomerId,
    asaasSubscriptionId,
    setAsaasSubscriptionId,
    savedCardToken,
    setSavedCardToken,
    cardFinal,
    setCardFinal,
    paymentMethod,
    setPaymentMethod,
    invoices,
    setInvoices,
    isLoadingInvoices,
    setIsLoadingInvoices,
    showAllInvoices,
    setShowAllInvoices,
    renewalDays,
    setRenewalDays,
    userPlanValue,
    setUserPlanValue,
    userPlanLimit,
    setUserPlanLimit,
    userPlanName,
    setUserPlanName,
    planStatus,
    setPlanStatus,
    currentMonthLeads,
    setCurrentMonthLeads,
    usagePeriodLabel,
    setUsagePeriodLabel,
    usageHistory,
    setUsageHistory,
    formData,
    setFormData,
    cardData,
    setCardData,
    pixPaymentData,
    setPixPaymentData,
    couponCode,
    setCouponCode,
    isValidatingCoupon,
    setIsValidatingCoupon,
    couponMessage,
    setCouponMessage,
    couponStatus,
    setCouponStatus,
    hasUsedCoupon,
    setHasUsedCoupon,
    showCardChargeConfirm,
    setShowCardChargeConfirm,
    showAdvanceInvoiceConfirm,
    setShowAdvanceInvoiceConfirm,
    showAdvancePixQr,
    setShowAdvancePixQr,
    isAdvancingInvoice,
    setIsAdvancingInvoice,
    advanceInvoicePayment,
    setAdvanceInvoicePayment,
    advancePixQrData,
    setAdvancePixQrData,
    isFetchingCep,
    setIsFetchingCep,
    lastCepLookupRef,
    formatLocalYmd,
    formatLocalDmy,
    getCycleRangeByDueDay,
    fetchInvoices,
    loadInitialData,
    handleInputChange,
    formatCepValue,
    fillAddressByCep,
    handleCepChange,
    handleFillCepButtonClick,
    handleCardChange,
    handleOpenCardChargeConfirm,
    formatCurrencyBRL,
    getLocalYmd,
    clampDueDay,
    computeNextMonthDueDate,
    applyInvoiceSettingsToSubscription,
    getOpenSubscriptionPayment,
    cancelFuturePendingSubscriptionPayments,
    openAdvanceInvoice,
    applyAdvanceFinalUpdates,
    confirmAdvanceInvoice,
    handleValidateCoupon,
    generatePixCharge,
    checkPixStatus,
    handlePixSuccess,
    handleSave,
    handleSaveCard,
    visibleInvoices,
    setupStep,
    isSetupComplete,
  };
};

export type AssinaturaCtx = ReturnType<typeof useAssinatura>;
