import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  User, 
  CheckCircle2, 
  ChevronRight, 
  AlertCircle, 
  Download, 
  TrendingUp, 
  Layers, 
  Zap,
  MoreVertical,
  Mail,
  Phone,
  Building,
  Lock,
  Loader2,
  CalendarDays,
  ArrowUpRight,
  RefreshCw,
  QrCode,
  Banknote,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase-utils';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { getAsaasApiKey, getAsaasUrl } from '@/utils/asaas';

interface Payment {
  id: string;
  value: number;
  status: string;
  clientPaymentDate: string | null;
  dateCreated: string;
  invoiceUrl: string;
  description: string | null;
}

const Assinatura = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isCardSaved, setIsCardSaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [asaasCustomerId, setAsaasCustomerId] = useState<string | null>(null);
  const [cardFinal, setCardFinal] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CREDIT_CARD' | 'PIX' | null>(null);
  
  const [invoices, setInvoices] = useState<Payment[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  const [renewalDays, setRenewalDays] = useState<number | null>(null);
  const [userPlanValue, setUserPlanValue] = useState<number>(0); // Valor mensal do plano (user_valor_mensal)
  const [userPlanLimit, setUserPlanLimit] = useState<number>(2000); // Limite de leads (user_plano)
  const [currentMonthLeads, setCurrentMonthLeads] = useState<number>(0);
  const [usageHistory, setUsageHistory] = useState<any[]>([]);

  const [formData, setFormData] = usePersistentState('assinatura-novo-form', {
    nome: '',
    documento: '',
    email: '',
    celular: '',
    cep: '',
    endereco: '',
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
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', `${startDate}T00:00:00`)
            .lte('created_at', `${endDate}T23:59:59`);
            
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
      if (!apiKey) {
        console.error('API Key não encontrada');
        return;
      }

      console.log('Buscando faturas para:', asaasCustomerId);
      const response = await fetch(getAsaasUrl(`/payments?customer=${asaasCustomerId}&limit=12&sort=dateCreated&order=desc`), {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'access_token': apiKey
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
        .from('usuarios')
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
        
        // Se já tiver token do cartão, marcamos como salvo
        if (userData.cartao_token) {
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

        // Definir limite de leads (user_plano)
        if (userData.user_plano) {
            const limit = parseInt(String(userData.user_plano).replace(/\D/g, ''));
            if (!isNaN(limit) && limit > 0) {
                setUserPlanLimit(limit);
            }
        }
        
        // Calcular leads do mês atual
        const now = new Date();
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        
        const { count: currentLeads } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('created_at', `${startMonth}T00:00:00`)
            .lte('created_at', `${endMonth}T23:59:59`);
            
        if (currentLeads !== null) setCurrentMonthLeads(currentLeads);

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

        // Preencher formulário com dados existentes se o formulário estiver vazio
        setFormData(prev => ({
          ...prev,
          nome: prev.nome || userData.user_nome || '',
          email: prev.email || userData.user_email || '',
          celular: prev.celular || userData.user_telefone || '',
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar informações do usuário.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCardChange = (field: string, value: string) => {
    setCardData(prev => ({ ...prev, [field]: value }));
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

  const generatePixCharge = async (customerId: string) => {
    try {
      setIsLoading(true);
      const apiKey = getAsaasApiKey();
      if (!apiKey) throw new Error('Chave de API não configurada');

      // 1. Criar cobrança
      // Usa o valor do plano do usuário ou 1.00 como fallback de segurança
      const valueToCharge = userPlanValue > 0 ? userPlanValue : 1.00;
      
      // Ajuste de data local para evitar problemas de fuso horário (UTC vs Local)
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const localDueDate = `${year}-${month}-${day}`;

      const paymentResponse = await fetch(getAsaasUrl('/payments'), {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'access_token': apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          customer: customerId,
          billingType: "PIX",
          value: valueToCharge,
          dueDate: localDueDate,
          description: "Ativação Assinatura Worklivoo"
        })
      });

      if (!paymentResponse.ok) {
        const err = await paymentResponse.json();
        throw new Error(err.errors?.[0]?.description || 'Erro ao gerar cobrança PIX');
      }

      const paymentData = await paymentResponse.json();
      const paymentId = paymentData.id;

      // 2. Obter QR Code
      const qrResponse = await fetch(getAsaasUrl(`/payments/${paymentId}/pixQrCode`), {
        method: 'GET',
        headers: {
            'accept': 'application/json',
            'access_token': apiKey
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
        .from('usuarios')
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

      toast.success('Cobrança PIX gerada com sucesso! Realize o pagamento para ativar.');

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
          if (!apiKey) return;

          const response = await fetch(getAsaasUrl(`/payments/${pixPaymentData.id}`), {
              method: 'GET',
              headers: {
                  'accept': 'application/json',
                  'access_token': apiKey
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

      setIsLoading(true);
      try {
          // Atualizar usuário
          const { error } = await supabase
            .from('usuarios')
            .update({
                cartao_token: 'PIX',
                cartao_final: 'PIX',
                tryout: 'NÃO'
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
    if (!formData.nome || !formData.documento || !formData.email || !formData.celular) {
      toast.error('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (!userId) {
      toast.error('Usuário não identificado.');
      return;
    }

    setIsLoading(true);

    try {
      const apiKey = getAsaasApiKey();
      if (!apiKey) throw new Error('Chave de API do Asaas não configurada.');

      // 1. Criar Cliente no Asaas
      const asaasPayload = {
        name: formData.nome,
        cpfCnpj: formData.documento.replace(/\D/g, ''),
        email: formData.email,
        mobilePhone: formData.celular.replace(/\D/g, ''),
        notificationDisabled: true
      };

      console.log('Payload Cliente Asaas:', asaasPayload);

      const response = await fetch(getAsaasUrl('/customers'), {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'access_token': apiKey,
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

      // 2. Salvar ID na tabela usuarios
      const updateData: any = {
        id_cliente_asaas: asaasId
      };

      // No caso de PIX, não atualizamos cartao_token/final ainda.
      // Esperamos o pagamento ser confirmado.

      const { error: updateError } = await supabase
        .from('usuarios')
        .update(updateData)
        .eq('user_id', userId);

      if (updateError) throw updateError;

      setAsaasCustomerId(asaasId);
      setIsSaved(true);
      
      if (paymentMethod === 'PIX') {
         // Iniciar fluxo de pagamento PIX
         await generatePixCharge(asaasId);
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

    if (!userId) {
      toast.error('Usuário não identificado.');
      return;
    }

    setIsLoading(true);

    try {
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

      // 1. Tokenizar Cartão no Asaas
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
          email: formData.email,
          cpfCnpj: formData.documento.replace(/\D/g, ''),
          postalCode: formData.cep.replace(/\D/g, ''),
          addressNumber: formData.numero,
          phone: formData.celular.replace(/\D/g, '')
        },
        remoteIp: remoteIp
      };

      console.log('Payload enviado:', tokenPayload);

      // Usando o proxy para tokenização
      // Endpoint correto para tokenizar: /api/v3/creditCard/tokenize
      const response = await fetch(getAsaasUrl('/creditCard/tokenize'), {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'access_token': cleanApiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify(tokenPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Erro Asaas Tokenização:', errorData);
        throw new Error(errorData.errors?.[0]?.description || 'Erro ao tokenizar cartão');
      }

      const tokenData = await response.json();
      const creditCardToken = tokenData.creditCardToken;

      if (!creditCardToken) throw new Error('Token do cartão não retornado.');

      // 1.5. Fazer cobrança do valor do plano (user_valor_mensal) APENAS SE for a primeira vez (não tiver cartão salvo anteriormente)
      if (userPlanValue > 0 && !cardFinal) {
        const paymentPayload = {
          billingType: "CREDIT_CARD",
          value: userPlanValue,
          dueDate: new Date().toISOString().split('T')[0], // Vencimento hoje
          customer: asaasCustomerId,
          creditCardToken: creditCardToken,
          remoteIp: remoteIp,
          description: `Mensalidade Worklivoo`
        };

        console.log('Processando cobrança:', paymentPayload);

        const paymentResponse = await fetch(getAsaasUrl('/payments'), {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'access_token': cleanApiKey,
            'content-type': 'application/json'
          },
          body: JSON.stringify(paymentPayload)
        });

        if (!paymentResponse.ok) {
          const errorData = await paymentResponse.json();
          console.error('Erro na cobrança:', errorData);
          throw new Error(errorData.errors?.[0]?.description || 'Erro ao processar o pagamento inicial.');
        }

        const paymentData = await paymentResponse.json();
        console.log('Cobrança realizada:', paymentData);
        toast.success('Cobrança realizada com sucesso!');
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
      
      const { error: updateError } = await supabase
        .from('usuarios')
        .update({
          cartao_token: creditCardToken,
          cartao_final: lastFourDigits,
          dia_vencimento: dueDay,
          tryout: 'NÃO'
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;

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

  const setupStep = isSaved ? 2 : 1;
  const isSetupComplete = isSaved && isCardSaved;

  if (!isSetupComplete) {
    if (!isSetupComplete && !paymentMethod) {
        return (
            <div className="h-full flex items-center justify-center animate-in fade-in zoom-in duration-500 py-10">
                <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl shadow-black/5 border border-gray-100 overflow-hidden p-10 text-center">
                    <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6 text-white">
                        <Banknote size={32} />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Escolha a forma de pagamento</h2>
                    <p className="text-gray-500 mb-8">Como você prefere realizar o pagamento da sua assinatura?</p>
                    
                    <div className="grid grid-cols-1 gap-4">
                        <button 
                            onClick={() => setPaymentMethod('CREDIT_CARD')}
                            className="group relative flex items-center gap-4 p-6 rounded-2xl border-2 border-gray-100 hover:border-black transition-all text-left"
                        >
                            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
                                <CreditCard size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Cartão de Crédito</h3>
                                <p className="text-xs text-gray-400">Cobrança automática mensal</p>
                            </div>
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ArrowUpRight size={20} />
                            </div>
                        </button>

                        <button 
                            onClick={() => {
                                setPaymentMethod('PIX');
                                if (isSaved && asaasCustomerId) {
                                    generatePixCharge(asaasCustomerId);
                                }
                            }}
                            className="group relative flex items-center gap-4 p-6 rounded-2xl border-2 border-gray-100 hover:border-brand-primary transition-all text-left"
                        >
                            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-brand-primary group-hover:text-black transition-colors">
                                <QrCode size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">PIX</h3>
                                <p className="text-xs text-gray-400">Pagamento via código ou QR Code</p>
                            </div>
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ArrowUpRight size={20} />
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (pixPaymentData && !isCardSaved) {
        return (
            <div className="h-full flex items-center justify-center animate-in fade-in zoom-in duration-500 py-10">
                <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl shadow-black/5 border border-gray-100 overflow-hidden p-10 text-center">
                    <div className="w-16 h-16 bg-brand-primary rounded-2xl flex items-center justify-center mx-auto mb-6 text-black animate-pulse">
                        <QrCode size={32} />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Pagamento via PIX</h2>
                    <p className="text-gray-500 mb-8">Escaneie o QR Code ou copie o código abaixo para ativar sua assinatura.</p>
                    
                    <div className="bg-white border-2 border-brand-primary/20 p-4 rounded-2xl mb-8 inline-block shadow-lg shadow-brand-primary/10">
                        <img 
                            src={`data:image/png;base64,${pixPaymentData.encodedImage}`} 
                            alt="QR Code PIX" 
                            className="w-48 h-48 mix-blend-multiply"
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="bg-gray-50 p-4 rounded-xl flex items-center gap-3 border border-gray-100">
                            <input 
                                readOnly 
                                value={pixPaymentData.payload} 
                                className="bg-transparent flex-1 text-xs font-mono text-gray-500 outline-none"
                            />
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(pixPaymentData.payload);
                                    toast.success('Código PIX copiado!');
                                }}
                                className="p-2 hover:bg-white rounded-lg transition-colors text-black"
                                title="Copiar código"
                            >
                                <Copy size={16} />
                            </button>
                        </div>
                        
                        <div className="bg-blue-50 text-blue-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                             <Loader2 size={16} className="animate-spin" />
                             Aguardando pagamento...
                        </div>
                        
                        <p className="text-xs text-gray-400 mt-4">
                            Valor: {pixPaymentData.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}<br/>
                            Vencimento: {pixPaymentData.expirationDate.split('-').reverse().join('/')}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
      <div className="h-full flex items-center justify-center animate-in fade-in zoom-in duration-500 py-10">
        <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl shadow-black/5 border border-gray-100 overflow-hidden">
          {/* Stepper Header */}
          <div className="bg-black p-8 text-white relative">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Configurar Assinatura</h2>
              <span className="text-brand-primary text-sm font-bold bg-white/10 px-3 py-1 rounded-full">
                Passo {setupStep} de {paymentMethod === 'PIX' ? 1 : 2}
              </span>
            </div>
            <div className="flex gap-2">
              <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${setupStep >= 1 ? 'bg-brand-primary' : 'bg-white/20'}`}></div>
              {paymentMethod !== 'PIX' && (
                  <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${setupStep >= 2 ? 'bg-brand-primary' : 'bg-white/20'}`}></div>
              )}
            </div>
          </div>

          <div className="p-10">
            {setupStep === 1 ? (
              <div className="space-y-6 animate-in slide-in-from-right duration-300">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-brand-bg flex items-center justify-center text-black">
                    <User size={20} />
                  </div>
                  <h3 className="text-lg font-bold">Dados de Faturamento</h3>
                </div>
                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nome Completo</label>
                    <input 
                      type="text" 
                      placeholder="Ex: João Silva" 
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-black focus:ring-4 focus:ring-black/5 transition-all"
                      value={formData.nome}
                      onChange={(e) => handleInputChange('nome', e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">CPF ou CNPJ</label>
                    <input 
                      type="text" 
                      placeholder="000.000.000-00" 
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-black focus:ring-4 focus:ring-black/5 transition-all"
                      value={formData.documento}
                      onChange={(e) => handleInputChange('documento', e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">E-mail Financeiro</label>
                    <input 
                      type="email" 
                      placeholder="financeiro@empresa.com" 
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-black focus:ring-4 focus:ring-black/5 transition-all"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Celular</label>
                        <input 
                        type="tel" 
                        placeholder="(00) 00000-0000" 
                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-black focus:ring-4 focus:ring-black/5 transition-all"
                        value={formData.celular}
                        onChange={(e) => handleInputChange('celular', e.target.value)}
                        disabled={isLoading}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">CEP</label>
                        <input 
                        type="text" 
                        placeholder="00000-000" 
                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-black focus:ring-4 focus:ring-black/5 transition-all"
                        value={formData.cep}
                        onChange={(e) => handleInputChange('cep', e.target.value)}
                        disabled={isLoading}
                        />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Endereço (Rua e Bairro)</label>
                    <input 
                      type="text" 
                      placeholder="Rua Exemplo, Bairro Centro" 
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-black focus:ring-4 focus:ring-black/5 transition-all"
                      value={formData.endereco}
                      onChange={(e) => handleInputChange('endereco', e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Número</label>
                    <input 
                      type="text" 
                      placeholder="123" 
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-black focus:ring-4 focus:ring-black/5 transition-all"
                      value={formData.numero}
                      onChange={(e) => handleInputChange('numero', e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-right duration-300">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-brand-bg flex items-center justify-center text-black">
                    <CreditCard size={20} />
                  </div>
                  <h3 className="text-lg font-bold">Dados do Cartão</h3>
                </div>
                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nome no Cartão</label>
                    <input 
                      type="text" 
                      placeholder="Como está impresso no cartão" 
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-black focus:ring-4 focus:ring-black/5 transition-all"
                      value={cardData.holderName}
                      onChange={(e) => handleCardChange('holderName', e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Número do Cartão</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="0000 0000 0000 0000" 
                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-black focus:ring-4 focus:ring-black/5 transition-all"
                        value={cardData.number}
                        onChange={(e) => handleCardChange('number', e.target.value)}
                        disabled={isLoading}
                      />
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400">
                        <CreditCard size={20} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Mês</label>
                            <input 
                                type="text" 
                                placeholder="MM" 
                                maxLength={2}
                                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-black transition-all"
                                value={cardData.expiryMonth}
                                onChange={(e) => handleCardChange('expiryMonth', e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Ano</label>
                            <input 
                                type="text" 
                                placeholder="AA" 
                                maxLength={4}
                                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-black transition-all"
                                value={cardData.expiryYear}
                                onChange={(e) => handleCardChange('expiryYear', e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">CVV</label>
                      <input 
                        type="text" 
                        placeholder="000" 
                        maxLength={4}
                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-black transition-all"
                        value={cardData.ccv}
                        onChange={(e) => handleCardChange('ccv', e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-10 flex gap-4">
              {setupStep === 2 && (
                <button 
                  onClick={() => cardFinal ? setIsCardSaved(true) : setIsSaved(false)}
                  className="flex-1 py-4 text-sm font-bold text-gray-500 hover:text-black transition-colors"
                  disabled={isLoading}
                >
                  {cardFinal ? 'Cancelar' : 'Voltar'}
                </button>
              )}
              <button 
                onClick={setupStep === 1 ? handleSave : handleSaveCard}
                className="flex-[2] bg-brand-primary text-black py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black hover:text-brand-primary transition-all duration-300 group shadow-lg shadow-brand-primary/20"
                disabled={isLoading}
              >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                    </>
                ) : (
                    <>
                        {setupStep === 1 ? 'Continuar' : 'Confirmar e Ativar'} 
                        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                )}
              </button>
            </div>
            
            <p className="text-center text-[10px] text-gray-400 mt-6 uppercase font-bold tracking-widest">
              Pagamento processado de forma segura via Asaas
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Active Subscription Dashboard View
  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12 py-10 px-4">
      
      {/* Header Section */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-black dark:text-white">Minha Assinatura</h2>
          <p className="text-gray-500 mt-1">Gerencie seu plano, faturas e acompanhe o uso do sistema.</p>
        </div>
        <div className="flex gap-3">
          <button 
            className="px-6 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold hover:bg-gray-50 transition-all text-black"
            onClick={() => setIsCardSaved(false)}
          >
            {cardFinal === 'PIX' ? 'Alterar Pagamento' : 'Editar Cartão'}
          </button>
          <button 
            className="px-6 py-3 bg-black text-white rounded-2xl text-sm font-bold hover:bg-black/90 transition-all shadow-xl shadow-black/10 dark:bg-white dark:text-black"
            onClick={() => window.open('https://wa.me/5512997079459?text=Estava%20na%20gerenciamento%20minha%20assinatura%20e%20me%20surgiu%20uma%20d%C3%BAvida.%20Preciso%20de%20ajuda!', '_blank')}
          >
            Suporte Financeiro
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        
        {/* Left Column: Card and Billing */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          
          {/* Visual Credit Card */}
          {cardFinal === 'PIX' ? (
              <div className="bg-brand-primary aspect-[1.58/1] rounded-[32px] p-8 text-black relative overflow-hidden shadow-2xl shadow-brand-primary/20 group">
                 <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-3xl group-hover:bg-white/30 transition-all duration-700"></div>
                 <div className="flex justify-between items-start mb-8">
                    <div className="w-12 h-10 bg-black/10 rounded-lg flex items-center justify-center backdrop-blur-md">
                       <QrCode size={20} className="text-black" />
                    </div>
                    <Banknote size={24} className="text-black" />
                 </div>
                 <div>
                    <p className="text-xl font-black uppercase tracking-widest mb-2">PAGAMENTO VIA PIX</p>
                    <p className="text-xs font-bold opacity-60 mb-6">As faturas são enviadas mensalmente.</p>
                    
                    <div className="flex justify-between items-end">
                       <div>
                          <p className="text-[10px] uppercase font-bold opacity-50 mb-1">Titular</p>
                          <p className="text-sm font-bold uppercase tracking-wide truncate max-w-[150px]">{formData.nome || 'Cliente'}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] uppercase font-bold opacity-50 mb-1">Status</p>
                          <p className="text-sm font-bold">ATIVO</p>
                       </div>
                    </div>
                 </div>
              </div>
          ) : (
              <div className="bg-black aspect-[1.58/1] rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl shadow-black/20 group">
                 <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-primary/10 rounded-full blur-3xl group-hover:bg-brand-primary/20 transition-all duration-700"></div>
                 <div className="flex justify-between items-start mb-12">
                    <div className="w-12 h-10 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-md">
                       <div className="w-8 h-6 bg-brand-primary/80 rounded-sm"></div>
                    </div>
                    <Zap size={24} className="text-brand-primary" />
                 </div>
                 <div>
                    <p className="text-lg font-mono tracking-widest mb-6">•••• •••• •••• {cardFinal || '0000'}</p>
                    <div className="flex justify-between items-end">
                       <div>
                          <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Titular</p>
                          <p className="text-sm font-bold uppercase tracking-wide">
                            {formData.nome ? (
                              formData.nome.trim().split(/\s+/).length > 2 
                                ? `${formData.nome.trim().split(/\s+/)[0]} ${formData.nome.trim().split(/\s+/)[1]}...` 
                                : formData.nome
                            ) : 'Cliente'}
                          </p>
                       </div>
                       <div>
                          <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Status</p>
                          <p className="text-sm font-bold">Ativo</p>
                       </div>
                    </div>
                 </div>
              </div>
          )}

          {/* Faturas Recentes */}
          <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm">
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-gray-900">Faturas Recentes</h3>
                <button 
                  onClick={fetchInvoices}
                  disabled={isLoadingInvoices}
                  className="p-2 hover:bg-gray-50 rounded-full transition-colors disabled:opacity-50"
                  title="Atualizar faturas"
                >
                  <RefreshCw size={18} className={`text-gray-400 ${isLoadingInvoices ? 'animate-spin' : ''}`} />
                </button>
             </div>
             <div className="space-y-4">
                {isLoadingInvoices ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    </div>
                ) : invoices.length > 0 ? (
                    (showAllInvoices ? invoices : invoices.slice(0, 3)).map((inv, i) => (
                    <div 
                        key={inv.id || i} 
                        className="flex justify-between items-center pb-4 border-b border-gray-50 last:border-0 last:pb-0 cursor-pointer group hover:opacity-70 transition-opacity"
                        onClick={() => window.open(inv.invoiceUrl, '_blank')}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                inv.status === 'CONFIRMED' || inv.status === 'RECEIVED' 
                                ? 'bg-green-100 text-green-600' 
                                : inv.status === 'OVERDUE'
                                ? 'bg-red-100 text-red-600'
                                : inv.status === 'REFUNDED'
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-yellow-100 text-yellow-600'
                            }`}>
                                {inv.status === 'OVERDUE' ? <AlertCircle size={14} /> : 
                                 inv.status === 'REFUNDED' ? <RefreshCw size={14} /> : <CheckCircle2 size={14} />}
                            </div>
                            <div>
                                <p className="text-xs font-bold text-black">{new Date(new Date(inv.clientPaymentDate || inv.dateCreated).getTime() + 86400000).toLocaleDateString('pt-BR')}</p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase">
                                    {inv.status === 'CONFIRMED' || inv.status === 'RECEIVED' ? 'Pago' : 
                                    inv.status === 'OVERDUE' ? 'Atrasado' : 
                                    inv.status === 'REFUNDED' ? 'Estornado' : 'Pendente'}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-black">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inv.value)}
                            </p>
                            <div className="flex items-center justify-end gap-1 text-gray-300 group-hover:text-brand-primary transition-colors">
                                <span className="text-[10px] font-bold uppercase hidden group-hover:inline-block">Ver</span>
                                <Download size={12} />
                            </div>
                        </div>
                    </div>
                    ))
                ) : (
                    <p className="text-center text-xs text-gray-400 py-4">Nenhuma fatura encontrada.</p>
                )}
             </div>
                
             {invoices.length > 3 && (
                <button 
                    onClick={() => setShowAllInvoices(!showAllInvoices)}
                    className="w-full mt-6 py-3 text-xs font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-widest"
                >
                    {showAllInvoices ? 'Ver menos' : 'Ver todas as faturas'}
                </button>
             )}
          </div>
        </div>

        {/* Right Column: Usage Summary */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          
          {/* Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-brand-primary p-8 rounded-[32px] shadow-lg shadow-brand-primary/20 relative overflow-hidden group">
                <TrendingUp size={40} className="absolute -right-2 -bottom-2 text-black/5 group-hover:scale-125 transition-transform duration-500" />
                <p className="text-[10px] font-black uppercase tracking-widest text-black/60 mb-2">Quantidade de Leads</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black text-black">{currentMonthLeads.toLocaleString()}</p>
                  <p className="text-sm font-bold text-black/40">/ {userPlanLimit.toLocaleString()}</p>
                </div>
                <div className="mt-6 h-2 w-full bg-black/10 rounded-full overflow-hidden">
                   <div 
                     className={`h-full rounded-full transition-all duration-1000 ${currentMonthLeads > userPlanLimit ? 'bg-red-500' : 'bg-black'}`} 
                     style={{width: `${Math.min(100, (currentMonthLeads / (userPlanLimit || 1)) * 100)}%`}}
                   ></div>
                </div>
                <p className="text-xs font-bold text-black/60 mt-4 flex items-center gap-1">
                    {currentMonthLeads > userPlanLimit ? (
                        <>
                            <AlertCircle size={14} className="text-red-600" />
                            <span className="text-red-600">{currentMonthLeads - userPlanLimit} leads acima do plano base</span>
                        </>
                    ) : (
                        <span>{Math.round((currentMonthLeads / (userPlanLimit || 1)) * 100)}% do plano base utilizado</span>
                    )}
                </p>
             </div>

             <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group">
                <Layers size={40} className="absolute -right-2 -bottom-2 text-gray-100 group-hover:scale-125 transition-transform duration-500" />
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Plano Atual</p>
                <p className="text-xl font-black text-black uppercase">Worklivoo Empresarial</p>
                <p className="text-xs font-bold text-brand-primary bg-black inline-block px-3 py-1 rounded-full mt-4">
                  {renewalDays !== null ? `Renovação em ${renewalDays} dias` : 'Renovação Mensal'}
                </p>
             </div>

             <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group">
                <AlertCircle size={40} className="absolute -right-2 -bottom-2 text-gray-100 group-hover:scale-125 transition-transform duration-500" />
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Leads Excedidos</p>
                <p className="text-4xl font-black text-black">{Math.max(0, currentMonthLeads - userPlanLimit)}</p>
                <p className="text-xs font-bold text-gray-400 mt-4 italic">
                  {currentMonthLeads > userPlanLimit ? 'Limite do plano excedido' : 'Sem custos adicionais este mês'}
                </p>
             </div>
          </div>

          {/* Main Content: Monthly Usage History */}
          <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-10 pb-6">
               <div className="flex justify-between items-center mb-2">
                  <h3 className="text-2xl font-black text-black">Histórico de Consumo</h3>
                  <div className="flex gap-2">
                     <div className="flex items-center gap-1.5 px-3 py-1 bg-brand-bg rounded-full text-[10px] font-bold uppercase text-gray-500">
                        <div className="w-1.5 h-1.5 bg-brand-primary rounded-full"></div> Leads Normais
                     </div>
                     <div className="flex items-center gap-1.5 px-3 py-1 bg-brand-bg rounded-full text-[10px] font-bold uppercase text-gray-500">
                        <div className="w-1.5 h-1.5 bg-black rounded-full"></div> Leads Excedidos
                     </div>
                  </div>
               </div>
               <p className="text-sm text-gray-400">Acompanhamento detalhado dos recursos utilizados em meses anteriores.</p>
            </div>

            {/* Usage Table Header */}
            <div className="grid grid-cols-12 px-10 py-4 bg-gray-50 border-y border-gray-100">
               <div className="col-span-3 text-[10px] font-black uppercase text-gray-400 tracking-widest">Mês Referência</div>
               <div className="col-span-3 text-[10px] font-black uppercase text-gray-400 tracking-widest text-center">Total de Leads</div>
               <div className="col-span-3 text-[10px] font-black uppercase text-gray-400 tracking-widest text-center">Leads Excedidos</div>
               <div className="col-span-3 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">Custo Adicional</div>
            </div>

            {/* Usage Rows */}
            <div className="flex-1 overflow-y-auto">
               {usageHistory.length > 0 ? (
                 usageHistory.map((item, index) => (
                 <div 
                   key={index} 
                   className="grid grid-cols-12 px-10 py-6 items-center border-b border-gray-50 hover:bg-brand-bg/30 transition-all cursor-default group"
                 >
                   {/* Month & Icon */}
                   <div className="col-span-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-black group-hover:bg-white transition-colors">
                         <CalendarDays size={18} />
                      </div>
                      <div>
                         <p className="text-sm font-bold text-black">{item.month}</p>
                         <p className="text-[10px] text-gray-400 font-bold uppercase">{item.year}</p>
                      </div>
                   </div>

                   {/* Total Leads */}
                   <div className="col-span-3 text-center">
                      <p className="text-lg font-black text-black">{item.leadsCount.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Capturados</p>
                   </div>

                   {/* Leads Excedidos */}
                   <div className="col-span-3 text-center">
                      <p className={`text-lg font-black ${item.leadsExceededCount > 0 ? 'text-red-500' : 'text-gray-300'}`}>{item.leadsExceededCount.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Excedentes</p>
                   </div>

                   {/* Extra Value */}
                   <div className="col-span-3 text-right">
                      <div className="flex flex-col items-end">
                         <div className="flex items-center gap-1">
                            <p className={`text-lg font-black ${item.exceeded > 0 ? 'text-black' : 'text-gray-300'}`}>{item.extraValue}</p>
                            {item.exceeded > 0 && <ArrowUpRight size={14} className="text-brand-primary" />}
                         </div>
                         <p className="text-[10px] text-gray-400 font-bold uppercase">Referente ao excedente</p>
                      </div>
                   </div>
                 </div>
               ))
               ) : (
                 <div className="p-10 text-center text-gray-400 text-sm">
                    Nenhum histórico de consumo disponível.
                 </div>
               )}
            </div>

            {/* Summary Footer Section */}
            <div className="p-10 bg-gray-50/50 flex justify-between items-center border-t border-gray-100">
               <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                     <AlertCircle size={16} className="text-gray-400" />
                     <p className="text-xs text-gray-500 font-medium">Custo por lead excedente: <span className="text-black font-bold">R$ 2,00</span></p>
                  </div>
               </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Assinatura;
