import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { User, Mail, Phone, Building, Check, AlertCircle, Loader2, CreditCard, Calendar, Lock, FileText, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase-utils';
import { usePersistentState } from '@/hooks/use-persistent-state';

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
  
  const [invoices, setInvoices] = useState<Payment[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  // Estado persistente do formulário de cliente
  const [formData, setFormData] = usePersistentState('assinatura-novo-form', {
    nome: '',
    documento: '',
    email: '',
    celular: '',
    cep: '',
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

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (asaasCustomerId) {
      fetchInvoices();
    }
  }, [asaasCustomerId]);

  const fetchInvoices = async () => {
    if (!asaasCustomerId) return;
    
    setIsLoadingInvoices(true);
    try {
      const apiKey = import.meta.env.VITE_ASAAS_API_KEY;
      if (!apiKey) return;

      const response = await fetch(`/api/asaas/payments?customer=${asaasCustomerId}`, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'access_token': apiKey
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          setInvoices(data.data);
        }
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
      const apiKey = import.meta.env.VITE_ASAAS_API_KEY;
      if (!apiKey) throw new Error('Chave de API do Asaas não configurada.');

      // 1. Criar Cliente no Asaas
      const asaasPayload = {
        name: formData.nome,
        cpfCnpj: formData.documento.replace(/\D/g, ''),
        email: formData.email,
        mobilePhone: formData.celular.replace(/\D/g, '')
      };

      // Usando o proxy configurado no vite.config.ts
      const response = await fetch('/api/asaas/customers', {
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

      // 2. Salvar ID na tabela usuarios (apenas o ID, sem atualizar outros dados)
      const { error: updateError } = await supabase
        .from('usuarios')
        .update({
          id_cliente_asaas: asaasId
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      setAsaasCustomerId(asaasId);
      setIsSaved(true);
      toast.success('Cliente cadastrado com sucesso!');

    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error(error.message || 'Erro ao salvar informações.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCard = async () => {
    // Validação básica do cartão
    if (!cardData.holderName || !cardData.number || !cardData.expiryMonth || !cardData.expiryYear || !cardData.ccv) {
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
          holderName: cardData.holderName,
          number: cardData.number.replace(/\s/g, ''),
          expiryMonth: cardData.expiryMonth,
          expiryYear: cardData.expiryYear,
          ccv: cardData.ccv
        },
        creditCardHolderInfo: {
          name: formData.nome,
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
      const response = await fetch('/api/asaas/creditCard/tokenize', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'access_token': apiKey,
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

      // 2. Calcular dia de vencimento
      const today = new Date();
      let dueDay = today.getDate();
      
      // Regra: se for dia 29, 30 ou 31, o vencimento será dia 1
      if (dueDay >= 29) {
        dueDay = 1;
      }

      // 3. Atualizar tabela usuarios
      const lastFourDigits = cardData.number.replace(/\s/g, '').slice(-4);
      
      const { error: updateError } = await supabase
        .from('usuarios')
        .update({
          cartao_token: creditCardToken,
          cartao_final: lastFourDigits,
          dia_vencimento: dueDay
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;

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

  // Se tudo estiver salvo (cliente e cartão)
  if (isSaved && isCardSaved) {
    return (
      <div className="container mx-auto py-10 px-4 max-w-3xl flex flex-col items-center min-h-[50vh]">
        <Card className="border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/10 w-full max-w-md mb-8">
          <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
              <Check size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-green-700 dark:text-green-400">Tudo Pronto!</h2>
              <p className="text-muted-foreground mt-2">
                Seus dados e cartão foram cadastrados com sucesso. Sua assinatura está ativa.
              </p>
              {cardFinal && (
                <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 inline-block">
                   <div className="flex items-center gap-3 text-left">
                      <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <CreditCard size={20} className="text-gray-600 dark:text-gray-300"/>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Cartão de Crédito</p>
                        <p className="text-xs text-muted-foreground">Terminado em •••• {cardFinal}</p>
                      </div>
                   </div>
                </div>
              )}
            </div>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => {
                // Opcional: permitir editar ou resetar
                // setIsCardSaved(false);
                // setIsSaved(false);
                window.location.href = '/'; // Redirecionar para dashboard
              }}
            >
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>

        {/* Seção de Faturas */}
        <Card className="w-full max-w-md border-muted/60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <FileText size={20} />
              </div>
              <div>
                <CardTitle>Histórico de Pagamentos</CardTitle>
                <CardDescription>Visualize suas faturas e comprovantes.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingInvoices ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : invoices.length > 0 ? (
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div 
                    key={invoice.id} 
                    className="flex items-center justify-between p-3 rounded-lg border border-muted hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => window.open(invoice.invoiceUrl, '_blank')}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">
                        {invoice.description || 'Assinatura'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(invoice.clientPaymentDate || invoice.dateCreated).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="block font-medium text-sm">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoice.value)}
                        </span>
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full ${
                          invoice.status === 'CONFIRMED' || invoice.status === 'RECEIVED' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                            : invoice.status === 'OVERDUE'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {invoice.status === 'CONFIRMED' || invoice.status === 'RECEIVED' ? 'Pago' : 
                           invoice.status === 'OVERDUE' ? 'Atrasado' : 'Pendente'}
                        </span>
                      </div>
                      <ExternalLink size={14} className="text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma fatura encontrada.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-3xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Configuração de Assinatura</h1>
        <p className="text-muted-foreground">
          {isSaved ? 'Agora, cadastre seu cartão de crédito.' : 'Preencha seus dados para criar sua conta de faturamento.'}
        </p>
      </div>

      {!isSaved ? (
        <Card className="border-muted/60 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <User size={20} />
              </div>
              <div>
                <CardTitle>Dados do Cliente</CardTitle>
                <CardDescription>Informações para emissão de notas fiscais e cobrança.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="nome"
                    placeholder="Seu nome completo"
                    className="pl-9"
                    value={formData.nome}
                    onChange={(e) => handleInputChange('nome', e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="documento">CPF / CNPJ</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="documento"
                    placeholder="000.000.000-00"
                    className="pl-9"
                    value={formData.documento}
                    onChange={(e) => handleInputChange('documento', e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    className="pl-9"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="celular">Celular</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="celular"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    className="pl-9"
                    value={formData.celular}
                    onChange={(e) => handleInputChange('celular', e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="cep"
                    placeholder="00000-000"
                    className="pl-9"
                    value={formData.cep}
                    onChange={(e) => handleInputChange('cep', e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="numero">Número</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="numero"
                    placeholder="123"
                    className="pl-9"
                    value={formData.numero}
                    onChange={(e) => handleInputChange('numero', e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button 
                className="w-full md:w-auto min-w-[200px]" 
                onClick={handleSave} 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Salvar e Continuar'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-muted/60 shadow-lg animate-in fade-in slide-in-from-right-8 duration-500">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <CreditCard size={20} />
              </div>
              <div>
                <CardTitle>Dados do Cartão</CardTitle>
                <CardDescription>Insira os dados do cartão para a assinatura.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="holderName">Nome no Cartão</Label>
                <Input
                  id="holderName"
                  placeholder="Como está impresso no cartão"
                  value={cardData.holderName}
                  onChange={(e) => handleCardChange('holderName', e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardNumber">Número do Cartão</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="cardNumber"
                    placeholder="0000 0000 0000 0000"
                    className="pl-9"
                    value={cardData.number}
                    onChange={(e) => handleCardChange('number', e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiryMonth">Mês</Label>
                  <Input
                    id="expiryMonth"
                    placeholder="MM"
                    maxLength={2}
                    value={cardData.expiryMonth}
                    onChange={(e) => handleCardChange('expiryMonth', e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryYear">Ano</Label>
                  <Input
                    id="expiryYear"
                    placeholder="AA"
                    maxLength={4}
                    value={cardData.expiryYear}
                    onChange={(e) => handleCardChange('expiryYear', e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ccv">CVV</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="ccv"
                      placeholder="123"
                      maxLength={4}
                      className="pl-9"
                      value={cardData.ccv}
                      onChange={(e) => handleCardChange('ccv', e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 flex gap-3">
               <Button 
                variant="outline"
                onClick={() => setIsSaved(false)}
                disabled={isLoading}
              >
                Voltar
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleSaveCard} 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Finalizar Assinatura'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Assinatura;