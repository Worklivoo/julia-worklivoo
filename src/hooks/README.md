# Hooks de Persistência de Estado

Este diretório contém hooks personalizados para gerenciar estado persistente usando localStorage, permitindo que o estado dos componentes seja mantido entre navegações e sessões do navegador.

## usePersistentState

Hook principal para gerenciar qualquer tipo de estado persistente.

### Uso Básico

```typescript
import { usePersistentState } from '@/hooks/use-persistent-state';

function MeuComponente() {
  const [contador, setContador] = usePersistentState('meu-contador', 0);
  
  return (
    <div>
      <p>Contador: {contador}</p>
      <button onClick={() => setContador(contador + 1)}>
        Incrementar
      </button>
    </div>
  );
}
```

### Parâmetros

- `key` (string): Chave única para armazenar no localStorage
- `defaultValue` (T): Valor padrão caso não exista no localStorage

### Retorno

- `[state, setState]`: Array com o estado atual e função para atualizá-lo

## usePersistentTab

Hook especializado para persistir estado de abas/seções.

### Uso

```typescript
import { usePersistentTab } from '@/hooks/use-persistent-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function MinhasPaginas() {
  const [activeTab, setActiveTab] = usePersistentTab('minhas-paginas', 'home');
  
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="home">Home</TabsTrigger>
        <TabsTrigger value="about">Sobre</TabsTrigger>
        <TabsTrigger value="contact">Contato</TabsTrigger>
      </TabsList>
      
      <TabsContent value="home">
        Conteúdo da Home
      </TabsContent>
      <TabsContent value="about">
        Conteúdo do Sobre
      </TabsContent>
      <TabsContent value="contact">
        Conteúdo do Contato
      </TabsContent>
    </Tabs>
  );
}
```

### Parâmetros

- `pageKey` (string): Identificador único da página
- `defaultTab` (string): Aba padrão

## usePersistentSections

Hook especializado para persistir estado de seções expandidas/colapsadas.

### Uso

```typescript
import { usePersistentSections } from '@/hooks/use-persistent-state';

function MeuAccordion() {
  const [sections, setSections] = usePersistentSections('meu-accordion', {
    section1: true,
    section2: false,
    section3: false
  });
  
  const toggleSection = (sectionKey: string) => {
    setSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };
  
  return (
    <div>
      <div>
        <button onClick={() => toggleSection('section1')}>
          Seção 1 {sections.section1 ? '▼' : '▶'}
        </button>
        {sections.section1 && <div>Conteúdo da Seção 1</div>}
      </div>
      
      <div>
        <button onClick={() => toggleSection('section2')}>
          Seção 2 {sections.section2 ? '▼' : '▶'}
        </button>
        {sections.section2 && <div>Conteúdo da Seção 2</div>}
      </div>
    </div>
  );
}
```

### Parâmetros

- `pageKey` (string): Identificador único da página
- `defaultSections` (T): Objeto com seções e seus estados padrão

## usePersistentDateRange

Hook especializado para persistir filtros de data (DateRange) com conversão adequada de objetos Date.

### Uso

```typescript
import { usePersistentDateRange } from '@/hooks/use-persistent-state';
import { startOfMonth, endOfMonth } from 'date-fns';

function MeuFiltroData() {
  const [dateRange, setDateRange] = usePersistentDateRange('dashboard-filter', {
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  
  return (
    <div>
      <DateRangePicker
        value={dateRange}
        onChange={setDateRange}
      />
    </div>
  );
}
```

### Parâmetros

- `key` (string): Chave única para armazenar no localStorage
- `defaultValue` ({ from?: Date; to?: Date }): Valor padrão do DateRange

### Retorno

- `[dateRange, setDateRange]`: Array com o estado atual e função para atualizá-lo

**⚠️ Importante:** Use `usePersistentDateRange` em vez de `usePersistentState` para objetos que contêm datas, pois ele lida corretamente com a serialização/deserialização de objetos Date no localStorage.

## Exemplos de Implementação

### 1. Página de Autenticação (Auth.tsx)

```typescript
// Mantém a aba ativa entre login e registro
const [activeTab, setActiveTab] = usePersistentTab('auth', 'login');

<Tabs value={activeTab} onValueChange={setActiveTab}>
  {/* conteúdo das abas */}
</Tabs>
```

### 2. Página de Configurações (Settings.tsx)

```typescript
// Mantém a seção ativa das configurações
const [activeTab, setActiveTab] = usePersistentTab('settings', 'profile');

// Mantém as preferências de notificação
const [notifications, setNotifications] = usePersistentState('settings-notifications', {
  email: true,
  push: false,
  marketing: false
});
```

### 3. Barra Lateral (Sidebar.tsx)

```typescript
// Mantém o estado colapsado/expandido da sidebar
const [isCollapsed, setIsCollapsed] = usePersistentState('sidebar-collapsed', false);
```

## Características

### ✅ Vantagens

- **Persistência Automática**: Estado é salvo automaticamente no localStorage
- **Sincronização Multi-aba**: Mudanças são sincronizadas entre abas/janelas
- **Type Safety**: Totalmente tipado com TypeScript
- **Tratamento de Erros**: Lida graciosamente com erros de localStorage
- **Flexibilidade**: Funciona com qualquer tipo de dados serializáveis
- **Performance**: Otimizado para evitar re-renders desnecessários

### 🔧 Funcionalidades

- **Inicialização Inteligente**: Carrega valor do localStorage ou usa padrão
- **Serialização Automática**: Converte automaticamente entre JSON e objetos
- **Event Listeners**: Escuta mudanças no localStorage de outras abas
- **Hooks Especializados**: Versões otimizadas para casos de uso específicos

### 📝 Convenções de Nomenclatura

- Use kebab-case para chaves: `'minha-pagina-tab'`
- Prefixe com o nome da página: `'settings-notifications'`
- Seja específico: `'dashboard-sidebar-collapsed'` em vez de `'collapsed'`

### ⚠️ Considerações

- **Limite de Armazenamento**: localStorage tem limite de ~5-10MB por domínio
- **Dados Sensíveis**: Nunca armazene informações sensíveis (senhas, tokens)
- **Compatibilidade**: Funciona apenas em navegadores que suportam localStorage
- **Serialização**: Apenas dados serializáveis em JSON são suportados

## Troubleshooting

### Problema: Estado não persiste
- Verifique se a chave é única e consistente
- Confirme que o localStorage está habilitado no navegador
- Verifique o console para erros de serialização

### Problema: Performance lenta
- Evite armazenar objetos muito grandes
- Use chaves específicas em vez de objetos aninhados complexos
- Considere debounce para atualizações frequentes

### Problema: Sincronização entre abas não funciona
- Verifique se está usando a mesma chave em todas as abas
- Confirme que o event listener do storage está funcionando
- Teste em modo privado para descartar extensões do navegador