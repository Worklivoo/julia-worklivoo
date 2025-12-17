import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { CreditCard, User, Mail, Phone, Calendar, Lock, MapPin, Building, ShieldCheck, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase-utils';
import { usePersistentState } from '@/hooks/use-persistent-state';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Assinatura = () => {
  const [isPersonalInfoSaved, setIsPersonalInfoSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [paymentProfileId, setPaymentProfileId] = useState<string | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  // Form states with persistence
  const [formData, setFormData] = usePersistentState('assinatura-form-data', {
    nome: '',
    documento: '',
    email: '',
    celular: '',
    cardName: '',
    cardNumber: '',
    cardMonth: '',
    cardYear: '',
    cardCvv: '',
    cardCep: '',
    cardAddressNumber: ''
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;
      setUserId(user.id);

      // Carregar dados do usuário para preencher formulário
      const { data: userData } = await supabase
        .from('usuarios')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (userData) {
        setFormData(prev => ({
          ...prev,
          nome: prev.nome || userData.user_nome || '',
          email: prev.email || userData.user_email || '',
          celular: prev.celular || userData.user_telefone || '',
        }));
      }

      // Verificar se já existe perfil de pagamento
      const { data: paymentData, error } = await supabase
        .from('clientes_pagamento')
        .select('*')
        .eq('user_id', user.id)
        .order('data_criacao', { ascending: false })
        .limit(1)
        .single();

      if (paymentData) {
        setPaymentProfileId(paymentData.id);
        setIsPersonalInfoSaved(true);
        // Se houver dados de cartão salvos (parcialmente), poderíamos preencher aqui
        // Mas por segurança, geralmente não trazemos dados sensíveis de volta ou tokenizados
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveClick = () => {
    if (!formData.nome || !formData.documento || !formData.email || !formData.celular) {
      toast.error('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!userId) return;
    setIsLoading(true);
    setIsConfirmDialogOpen(false);

    try {
      const apiKey = import.meta.env.VITE_ASAAS_API_KEY;
      console.log('Ambiente:', import.meta.env.MODE);
      console.log('API Key presente:', !!apiKey);
      
      if (!apiKey) {
        throw new Error('Chave de API do Asaas não configurada.');
      }

      // Determinar URL com base no ambiente da chave (produção ou sandbox)
      // A chave fornecida começa com $aact_prod, o que indica produção.
      // O endpoint correto é https://api.asaas.com/v3/customers
      
      const baseUrl = 'https://api.asaas.com/v3/customers';

      // Preparar dados para API do Asaas
      const asaasPayload = {
        name: formData.nome,
        cpfCnpj: formData.documento.replace(/\D/g, ''),
        email: formData.email,
        mobilePhone: formData.celular.replace(/\D/g, '')
      };

      // Chamada API Asaas
      // Usar proxy para evitar problemas de CORS e proteger a chave
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

      if (!asaasId) {
        throw new Error('ID do cliente não retornado pelo Asaas');
      }

      // Salvar no Supabase
      const dbPayload = {
        user_id: userId,
        id_cliente_asaas: asaasId,
        valor_total: 0,
        data_vencimento: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
        status_pagamento: 'PENDENTE'
      };

      let error;
      
      if (paymentProfileId) {
        // Atualizar existente
        const { error: updateError } = await supabase
          .from('clientes_pagamento')
          .update({
             id_cliente_asaas: asaasId // Atualiza caso tenha mudado
          })
          .eq('id', paymentProfileId);
        error = updateError;
      } else {
        // Criar novo
        const { data, error: insertError } = await supabase
          .from('clientes_pagamento')
          .insert(dbPayload)
          .select()
          .single();
        
        if (data) {
          setPaymentProfileId(data.id);
        }
        error = insertError;
      }

      if (error) throw error;

      setIsPersonalInfoSaved(true);
      toast.success('Informações salvas e cliente criado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error(error.message || 'Erro ao salvar informações pessoais.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalizeSubscription = async () => {
    if (!userId || !paymentProfileId) return;
    
    // Validação básica
    if (!formData.cardName || !formData.cardNumber || !formData.cardMonth || !formData.cardYear || !formData.cardCvv || !formData.cardCep || !formData.cardAddressNumber) {
      toast.error('Por favor, preencha todos os dados do cartão.');
      return;
    }

    setIsLoading(true);

    try {
      const apiKey = import.meta.env.VITE_ASAAS_API_KEY;
      if (!apiKey) throw new Error('Chave de API do Asaas não configurada.');

      // Obter ID do cliente Asaas do banco de dados (garantir que temos o mais atual)
      const { data: currentPaymentProfile } = await supabase
        .from('clientes_pagamento')
        .select('id_cliente_asaas')
        .eq('id', paymentProfileId)
        .single();

      if (!currentPaymentProfile?.id_cliente_asaas) {
        throw new Error('ID do cliente Asaas não encontrado. Salve suas informações pessoais primeiro.');
      }

      // Obter IP do cliente
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      const remoteIp = ipData.ip;

      // Preparar payload para tokenização
      const tokenizePayload = {
        creditCard: {
          holderName: formData.cardName,
          number: formData.cardNumber.replace(/\D/g, ''),
          expiryMonth: formData.cardMonth,
          expiryYear: formData.cardYear,
          ccv: formData.cardCvv
        },
        creditCardHolderInfo: {
          name: formData.nome,
          email: formData.email,
          cpfCnpj: formData.documento.replace(/\D/g, ''),
          postalCode: formData.cardCep.replace(/\D/g, ''),
          addressNumber: formData.cardAddressNumber,
          phone: formData.celular.replace(/\D/g, '')
        },
        customer: currentPaymentProfile.id_cliente_asaas,
        remoteIp: remoteIp
      };

      // Chamada API Asaas via Proxy
      const response = await fetch('/api/asaas/creditCard/tokenizeCreditCard', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'access_token': apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify(tokenizePayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Erro Asaas Tokenização:', errorData);
        throw new Error(errorData.errors?.[0]?.description || 'Erro ao processar cartão.');
      }

      const creditCardData = await response.json();
      // A resposta é um array com os dados do cartão, pegamos o primeiro (e único) item
      /*
         [ 
           { 
             "creditCardNumber": "7916", 
             "creditCardBrand": "MASTERCARD", 
             "creditCardToken": "e65ddd03-4b9e-439b-934d-f2d466061fb3" 
           } 
         ] 
      */
      
      const cardInfo = creditCardData; // Dependendo da resposta exata, pode ser creditCardData[0] ou o próprio objeto. A documentação/exemplo diz array.
      // O exemplo do usuário mostra array: [ { ... } ]
      // Vamos verificar se é array
      const tokenizedCard = Array.isArray(creditCardData) ? creditCardData[0] : creditCardData;

      if (!tokenizedCard.creditCardToken) {
        throw new Error('Token do cartão não retornado.');
      }

      // Calcular data de pagamento (30 dias após hoje)
      const dataPagamento = new Date();
      dataPagamento.setDate(dataPagamento.getDate() + 30);

      // Atualizar Supabase
      const { error } = await supabase
        .from('clientes_pagamento')
        .update({
          cartao_token: tokenizedCard.creditCardToken,
          cartao_final: tokenizedCard.creditCardNumber,
          cartao_bandeira: tokenizedCard.creditCardBrand,
          status_pagamento: 'CONFIRMADO',
          data_pagamento: dataPagamento.toISOString()
        })
        .eq('id', paymentProfileId);

      if (error) throw error;

      toast.success('Cartão cadastrado e assinatura confirmada!');
      
      // Limpar CVV por segurança (mantendo outros dados para conveniência visual, ou limpar tudo sensível)
      setFormData(prev => ({ ...prev, cardCvv: '' }));

    } catch (error: any) {
      console.error('Erro ao finalizar assinatura:', error);
      toast.error(error.message || 'Erro ao processar assinatura.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="text-foreground transition-colors">
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent light-welcome-title">Assinatura & Cobrança</h1>
            <p className="text-muted-foreground mt-1 text-lg">Gerencie suas informações pessoais e métodos de pagamento</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-[1600px]">
          
          {/* Coluna da Esquerda - Formulários */}
          <div className="space-y-8">
            
            {/* Seção 1: Dados Pessoais */}
            <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Informações Pessoais</CardTitle>
                    <CardDescription>Dados para identificação e contato.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="nome" className="text-sm font-medium">Nome Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="nome" 
                        placeholder="Seu nome completo" 
                        className="pl-9" 
                        disabled={isPersonalInfoSaved}
                        value={formData.nome}
                        onChange={(e) => handleInputChange('nome', e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="documento" className="text-sm font-medium">CPF / CNPJ</Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="documento" 
                        placeholder="000.000.000-00" 
                        className="pl-9" 
                        disabled={isPersonalInfoSaved}
                        value={formData.documento}
                        onChange={(e) => handleInputChange('documento', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="seu@email.com" 
                        className="pl-9" 
                        disabled={isPersonalInfoSaved}
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="celular" className="text-sm font-medium">Celular</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="celular" 
                        type="tel" 
                        placeholder="(00) 00000-0000" 
                        className="pl-9" 
                        disabled={isPersonalInfoSaved}
                        value={formData.celular}
                        onChange={(e) => handleInputChange('celular', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {!isPersonalInfoSaved ? (
                  <Button 
                    className="w-full mt-4" 
                    onClick={handleSaveClick}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Salvando...' : 'Salvar Informações'}
                  </Button>
                ) : (
                  <div className="flex items-center justify-center gap-2 p-3 bg-green-500/10 text-green-600 rounded-md mt-4 border border-green-200 dark:border-green-900">
                    <Check className="w-4 h-4" />
                    <span className="text-sm font-medium">Informações salvas</span>
                    <Button variant="link" className="h-auto p-0 text-green-600 ml-2" onClick={() => setIsPersonalInfoSaved(false)}>
                      Editar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Seção 2: Dados do Cartão (Só aparece se dados pessoais estiverem salvos) */}
            {isPersonalInfoSaved && (
              <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-4">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <CreditCard className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Método de Pagamento</CardTitle>
                      <CardDescription>Cadastre seu cartão de crédito para faturamento.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  {/* Visual do Cartão (Decorativo) */}
                  <div className="relative w-full max-w-sm mx-auto h-48 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 shadow-xl mb-8 transform transition-transform hover:scale-[1.02]">
                    <div className="flex justify-between items-start">
                      <div className="w-12 h-8 bg-yellow-500/80 rounded flex items-center justify-center">
                        <div className="w-8 h-5 border border-white/30 rounded-sm" />
                      </div>
                      <CreditCard className="w-6 h-6 text-white/50" />
                    </div>
                    <div className="mt-8">
                      <div className="text-lg tracking-widest font-mono text-white/90">
                        {formData.cardNumber ? formData.cardNumber : '•••• •••• •••• ••••'}
                      </div>
                    </div>
                    <div className="mt-8 flex justify-between items-end">
                      <div>
                        <div className="text-xs text-white/60 uppercase mb-1">Titular</div>
                        <div className="text-sm font-medium tracking-wide uppercase">
                          {formData.cardName ? formData.cardName : 'NOME NO CARTÃO'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-white/60 uppercase mb-1">Validade</div>
                        <div className="text-sm font-medium tracking-wide">
                          {formData.cardMonth || 'MM'}/{formData.cardYear ? formData.cardYear.slice(-2) : 'AA'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="card-name">Nome no Cartão</Label>
                        <Input 
                          id="card-name" 
                          placeholder="Como aparece no cartão" 
                          value={formData.cardName}
                          onChange={(e) => handleInputChange('cardName', e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="card-number">Número do Cartão</Label>
                        <div className="relative">
                          <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="card-number" 
                            placeholder="0000 0000 0000 0000" 
                            className="pl-9" 
                            value={formData.cardNumber}
                            onChange={(e) => handleInputChange('cardNumber', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Validade</Label>
                        <div className="flex gap-2">
                          <Select value={formData.cardMonth} onValueChange={(v) => handleInputChange('cardMonth', v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Mês" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                <SelectItem key={m} value={m.toString().padStart(2, '0')}>
                                  {m.toString().padStart(2, '0')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={formData.cardYear} onValueChange={(v) => handleInputChange('cardYear', v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Ano" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() + i).map((y) => (
                                <SelectItem key={y} value={y.toString()}>
                                  {y}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cvv">CVV</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="cvv" 
                            placeholder="123" 
                            maxLength={4} 
                            className="pl-9" 
                            value={formData.cardCvv}
                            onChange={(e) => handleInputChange('cardCvv', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Endereço de Faturamento</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="cep">CEP</Label>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                              id="cep" 
                              placeholder="00000-000" 
                              className="pl-9" 
                              value={formData.cardCep}
                              onChange={(e) => handleInputChange('cardCep', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="numero">Número</Label>
                          <Input 
                            id="numero" 
                            placeholder="123" 
                            value={formData.cardAddressNumber}
                            onChange={(e) => handleInputChange('cardAddressNumber', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Coluna da Direita - Resumo e Ação */}
          <div className="space-y-6 lg:sticky lg:top-6 h-fit">
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Ambiente Seguro
                </CardTitle>
                <CardDescription>
                  Seus dados são criptografados e armazenados com segurança.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Ao salvar, você confirma que as informações fornecidas são verdadeiras e autoriza cobranças futuras neste cartão.
                </div>
                <Separator />
                <Button 
                  className="w-full" 
                  size="lg" 
                  disabled={!isPersonalInfoSaved || isLoading}
                  onClick={handleFinalizeSubscription}
                >
                  {isLoading ? 'Processando...' : 'Finalizar Assinatura'}
                </Button>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Informações Pessoais</AlertDialogTitle>
            <AlertDialogDescription>
              Por favor, verifique se os dados abaixo estão corretos antes de salvar.
              <br /><br />
              <div className="bg-muted p-3 rounded-md text-sm space-y-2 text-foreground">
                <p><strong>Nome:</strong> {formData.nome}</p>
                <p><strong>CPF/CNPJ:</strong> {formData.documento}</p>
                <p><strong>Email:</strong> {formData.email}</p>
                <p><strong>Celular:</strong> {formData.celular}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave} disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Confirmar e Salvar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Assinatura;
