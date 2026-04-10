import React from "react";
import { useCRM } from "@/contexts/CRMContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Gift, Copy, Check, MessageCircle, Ticket, DollarSign, ArrowRight } from "lucide-react";

const IndiqueGanhe = () => {
  const { user } = useCRM();
  const [copied, setCopied] = React.useState(false);

  // Link de referência com mensagem personalizada para WhatsApp
  const nomeEmpresa = user?.empresa || "NOME DA EMPRESA";
  const mensagem = `A ${nomeEmpresa} me indicou vocês, gostaria de falar com você!`;
  const referralLink = `https://wa.me/5512997079459?text=${encodeURIComponent(mensagem)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Definição de cores inline para garantir a aplicação correta
  const primaryColor = "#EBF57D"; // Verde limão/amarelo solicitado
  const bgColor = "#F6F6F6"; // Cinza claro solicitado
  const cardBgColor = "#FFFFFF"; // Branco para os cards internos para dar contraste com o fundo #F6F6F6

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500 max-w-6xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        
        {/* Coluna da Esquerda: Textos e Prêmios */}
        <Card className="border-none shadow-md h-full flex flex-col" style={{ backgroundColor: bgColor }}>
           <CardHeader className="pb-2">
              <CardTitle className="text-xl font-bold flex items-center gap-2" style={{ color: '#000000' }}>
                  <Gift className="w-5 h-5" style={{ color: '#000000' }} />
                  Indique e Ganhe
               </CardTitle>
           </CardHeader>
           <CardContent className="flex-1 flex flex-col justify-center space-y-8 p-6 md:p-8">
              <div className="space-y-4">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight" style={{ color: '#000000' }}>
                  Conhece alguma empresa que se beneficiaria da solução? <br/>
                  <span style={{ color: '#000000', backgroundColor: primaryColor, padding: '0 4px' }}>Agora sua indicação tem recompensa.</span>
                </h1>
                <p className="text-base" style={{ color: '#666666' }}>
                  Seu indicado ganha <span className="font-medium" style={{ color: '#000000' }}>7 dias para testar a IA</span> e você escolhe:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {/* Card Prêmio 1 */}
                 <div className="rounded-xl p-6 border-0 flex flex-col items-center text-center gap-4 transition-all hover:scale-[1.02] shadow-sm hover:shadow-md" style={{ backgroundColor: primaryColor }}>
                    <div className="h-14 w-14 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: '#000000', color: primaryColor }}>
                       <Ticket size={28} />
                    </div>
                    <div>
                       <h3 className="font-bold text-xl leading-tight" style={{ color: '#000000' }}>100 Atendimentos</h3>
                       <p className="text-sm mt-1 font-medium opacity-80" style={{ color: '#000000' }}>Créditos extras</p>
                    </div>
                 </div>

                 {/* Card Prêmio 2 */}
                 <div className="rounded-xl p-6 border-0 flex flex-col items-center text-center gap-4 transition-all hover:scale-[1.02] shadow-sm hover:shadow-md" style={{ backgroundColor: primaryColor }}>
                    <div className="h-14 w-14 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: '#000000', color: primaryColor }}>
                       <DollarSign size={28} />
                    </div>
                    <div>
                       <h3 className="font-bold text-xl leading-tight" style={{ color: '#000000' }}>R$100 de Desconto</h3>
                       <p className="text-sm mt-1 font-medium opacity-80" style={{ color: '#000000' }}>Na próxima fatura</p>
                    </div>
                 </div>
              </div>
              
              <div className="pt-2">
                <p className="text-xs italic border-t pt-4 w-full" style={{ color: '#999999', borderColor: 'rgba(0,0,0,0.1)' }}>
                   *Consulte o regulamento para mais detalhes sobre a premiação.
                </p>
              </div>
           </CardContent>
        </Card>

        {/* Coluna da Direita: Link e Instruções */}
        <Card className="border-none shadow-md h-full flex flex-col relative overflow-hidden" style={{ backgroundColor: bgColor }}>
           <div className="absolute top-0 left-0 w-full h-1.5" style={{ background: `linear-gradient(to right, ${primaryColor}, #d4e06a)` }} />
           
           <CardContent className="flex-1 flex flex-col justify-center space-y-8 p-6 md:p-8">
              <div className="rounded-2xl p-6 md:p-8 space-y-6 border" style={{ backgroundColor: cardBgColor, borderColor: 'rgba(0,0,0,0.05)' }}>
                 <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: '#000000' }}>
                           Seu Link Exclusivo
                        </label>
                        <p className="text-sm" style={{ color: '#666666' }}>Compartilhe para começar a ganhar</p>
                    </div>
                    
                    <div className="flex gap-2">
                       <div className="relative flex-1">
                          <Input 
                             readOnly 
                             value={referralLink} 
                             className="pr-10 font-mono text-sm border shadow-sm h-12"
                             style={{ backgroundColor: '#F9F9F9', color: '#000000', borderColor: 'rgba(0,0,0,0.1)' }}
                          />
                       </div>
                       <Button 
                          onClick={handleCopy} 
                          size="lg"
                          className="h-12 px-6 shadow-sm transition-all duration-300"
                          style={{ 
                              backgroundColor: copied ? '#16a34a' : primaryColor, 
                              color: copied ? '#ffffff' : '#000000',
                              fontWeight: '600'
                          }}
                       >
                          {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                       </Button>
                    </div>
                 </div>
              </div>

              <div className="space-y-6 px-2">
                 <h3 className="font-semibold flex items-center gap-2" style={{ color: '#000000' }}>
                    <ArrowRight className="w-4 h-4" style={{ color: '#000000' }} />
                    Como funciona
                 </h3>
                 
                 <div className="space-y-4">
                    <div className="flex gap-4 items-start group">
                        <div className="w-10 h-10 rounded-full transition-colors flex items-center justify-center shrink-0 font-bold text-lg" style={{ backgroundColor: primaryColor, color: '#000000' }}>
                            1
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-medium" style={{ color: '#000000' }}>Copie e envie</h4>
                            <p className="text-sm leading-relaxed" style={{ color: '#666666' }}>
                                Copie o link acima e envie para o indicado (amigo ou empresa).
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex gap-4 items-start group">
                        <div className="w-10 h-10 rounded-full transition-colors flex items-center justify-center shrink-0 font-bold text-lg" style={{ backgroundColor: primaryColor, color: '#000000' }}>
                            2
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-medium" style={{ color: '#000000' }}>Contato via WhatsApp</h4>
                            <p className="text-sm leading-relaxed" style={{ color: '#666666' }}>
                                Ele falará conosco no WhatsApp e, se virar cliente, sua recompensa é liberada automaticamente.
                            </p>
                        </div>
                    </div>
                 </div>
              </div>
           </CardContent>
        </Card>
      </div>

      {/* Seção Regulamento */}
      <Card className="border-none shadow-md" style={{ backgroundColor: bgColor }}>
        <CardHeader>
          <CardTitle className="text-xl font-bold" style={{ color: '#000000' }}>
            Regulamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ol className="list-decimal list-inside space-y-3" style={{ color: '#333333' }}>
            <li>Copie seu link de indicação e envie para a empresa indicada</li>
            <li>O indicado fala conosco pelo WhatsApp e passa por uma reunião com nosso time</li>
            <li>Caso faça sentido, vamos liberar 7 dias para o indicado testar a IA antes de contratar</li>
            <li>Se virar cliente, você recebe benefícios na sua assinatura</li>
          </ol>
          
          <p className="text-sm pt-4 border-t" style={{ color: '#666666', borderColor: 'rgba(0,0,0,0.1)' }}>
            Válido para até 3 indicações convertidas por mês (limitado a 300 atendimentos ou R$300 em desconto). Indicações adicionais são contabilizadas no mês seguinte.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default IndiqueGanhe;
