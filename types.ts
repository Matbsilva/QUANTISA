
export enum Priority {
  High = 'Alta',
  Medium = 'Média',
  Low = 'Baixa',
}

export enum KanbanStatus {
  Backlog = 'Backlog / Caixa de Entrada',
  InProgress = 'Em Orçamentação',
  ReadyToSend = 'Pronto para Envio',
  Sent = 'Enviado (Recente)',
  Waiting = 'Aguardando Retorno',
  Approved = 'Aprovado',
  Declined = 'Declinado',
  Archived = 'Arquivo Morto',
}

export interface ReturnHistoryItem {
  id: string;
  date: string;
  notes: string;
}

export interface Doubt {
  id: string;
  question: string;
  options?: string[]; // Para sugestões de múltipla escolha
}

export interface Service {
  id: string;
  nome: string;
  description?: string; // Adicionado para o escopo detalhado
  quantidade: number;
  unidade: string;
}

export interface ParsedAnalysis {
  projectName?: string;
  clientName?: string;
  deadline?: string;
  priority?: Priority;
  briefingSummary?: string;
  services?: Service[];
  doubts?: Doubt[];
  keyMaterials?: string[];
  valueEngineering?: string[];
  preliminaryRisks?: string[];
  rawAnalysisText?: string; // Mantém o texto bruto para referência, se necessário
}

export interface RefinementSuggestion {
  doubtId: string;
  question: string;
  suggestedAnswers: {
    answer: string;
    tag: string;
    actionType: 'modify' | 'add';
  }[];
}

export interface ValueEngineeringOption {
  solution: string;
  relativeCost: string;
  deadlineImpact: string;
  pros: string[];
  cons: string[];
  recommendation: string;
}

export interface ValueEngineeringAnalysis {
  itemId: string;
  itemName: string;
  options: ValueEngineeringOption[];
}

export interface InternalQuery {
  id: string;
  query: string;
}


export type ApprovalStatus = 'approved' | 'rejected' | null;

export interface InternalQueryApproval {
  status: ApprovalStatus;
  comment: string;
}

// Novo Tipo para o Mapeamento
export interface CompositionMappingItem {
    serviceId: string;
    serviceName: string;
    status: 'matched' | 'partial' | 'missing' | 'created';
    selectedCompositionId?: string; // ID da composição existente selecionada
    suggestedCompositionId?: string; // ID sugerido pela IA
    matchReasoning?: string; // Por que a IA escolheu essa
    aiConfidence?: 'high' | 'medium' | 'low';
    needsCreation?: boolean; // Se true, indica que precisa gerar do zero
}

// --- TIPO PARA VALIDAÇÃO DE INSUMOS (ETAPA 1.5 / 3) ---
export interface InsumoValidationItem {
    id: string;
    nome: string;
    unidade: string;
    quantidadeEstimada: number; // Estimativa macro baseada no escopo
    
    // Coluna 1: Base Existente
    databasePrice?: number;
    databaseInsumoId?: string; // Link se encontrado no banco
    
    // Coluna 2: Sugestão IA/Web
    aiSuggestedPrice?: number;
    aiSource?: string; // "SINAPI", "Mercado Livre", "Estimativa"
    
    // Coluna 3: Decisão (Editável)
    finalPrice: number;
    
    status: 'ok' | 'alert' | 'missing'; // Alert se variação for alta ou item novo
}

export interface Project {
  id: string;
  nome: string;
  cliente: string;
  data_entrada: string;
  data_limite: string;
  prioridade: Priority;
  status: KanbanStatus;
  resumo_tecnico: string;
  briefing?: string;
  data_envio?: Date;
  returns?: ReturnHistoryItem[];
  initialAnalysis?: string;
  services?: Service[];
  doubts?: Doubt[];
  keyMaterials?: string[];
  valueEngineering?: string[];
  preliminaryRisks?: string[];
  clientAnswers?: string; // Respostas do cliente para as dúvidas
  detailedServices?: Service[]; // Para a etapa "Escopo Detalhado"
  pendingDoubts?: Doubt[]; // Dúvidas que não foram respondidas
  internalQueries?: InternalQuery[]; // This will now use the updated InternalQuery type.
  observations?: string[]; // ADDED: For general project notes that don't fit into a specific service.
  internalQueryApprovals?: Record<string, InternalQueryApproval>; // Para armazenar as respostas do usuário
  
  // Atualizado para usar o novo tipo de array
  compositionMappings?: CompositionMappingItem[]; 
  insumoValidations?: InsumoValidationItem[]; // Novo campo para armazenar a validação

  refinementSuggestions?: RefinementSuggestion[]; // Sugestões da IA para dúvidas pendentes
  valueEngineeringAnalysis?: ValueEngineeringAnalysis[]; // Análise de EV da IA
  refinementSelections?: Record<string, string>; // { doubtId: selectedOption | '__OTHER__' }
  customRefinementAnswers?: Record<string, string>; // { doubtId: 'custom text answer' }
  valueEngineeringSelections?: Record<string, string>; // { itemId: selectedAlternativeSolution }
}


export interface PriceHistory {
  date: string;
  cost: number;
}

export interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  custo: number; // Represents the LATEST cost for display purposes
  tipo: 'Material' | 'MaoObra' | 'Equipamento';
  marca?: string;
  observacao?: string;
  priceHistory: PriceHistory[];
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  thinking?: boolean;
}

export interface GroundingChunk {
  web?: {
    // FIX: Made uri and title optional to match the type from @google/genai SDK.
    uri?: string;
    title?: string;
  };
}

export interface GroundingMetadata {
  // FIX: Made groundingChunks optional to match the type from @google/genai SDK.
  groundingChunks?: GroundingChunk[];
}

export interface SearchResult {
  text: string;
  metadata?: GroundingMetadata;
}

// --- NEW COMPOSITION TYPES (V1.2 FINAL) ---

export interface ComposicaoInsumo {
  item: string;
  unidade: string;
  quantidade: number; // Formerly quantidadeComPerda
  valorUnitario: number;
  valorTotal: number;
  pesoUnitario?: number;
  pesoTotal?: number;
}

export interface ComposicaoMaoDeObra {
  funcao: string;
  hhPorUnidade: number; // Coeficiente de produtividade
  custoUnitario: number;
  custoTotal: number;
}

export interface ComposicaoListaCompraItem {
  item: string;
  unidadeCompra: string;
  quantidadeBruta: number;
  quantidadeAComprar: number;
  custoTotalEstimado: number;
}

export interface ComposicaoIndicadorMaoDeObra {
  funcao: string; // Ex: "HH Profissional (Pedreiro)"
  hhPorUnidade: number;
  hhTotal: number;
}

export interface ComposicaoIndicadores {
  custoMateriaisPorUnidade: number;
  custoEquipamentosPorUnidade: number;
  custoMaoDeObraPorUnidade: number;
  custoDiretoTotalPorUnidade: number;

  custoMateriaisTotal: number;
  custoEquipamentosTotal: number;
  custoMaoDeObraTotal: number;
  custoDiretoTotalTotal: number;

  maoDeObraDetalhada: ComposicaoIndicadorMaoDeObra[];

  pesoMateriaisPorUnidade: number;
  pesoMateriaisTotal: number;

  volumeEntulhoPorUnidade: number;
  volumeEntulhoTotal: number;
}

export interface Composicao {
  id: string;
  codigo: string;
  titulo: string;
  unidade: string;
  quantidadeReferencia: number;
  grupo: string;
  subgrupo: string;
  tags: string[];
  classificacaoInterna: string;

  premissas: {
    escopo: string;
    metodo: string;
    incluso: string;
    naoIncluso: string;
  };

  insumos: {
    materiais: ComposicaoInsumo[];
    equipamentos: ComposicaoInsumo[];
  };

  maoDeObra: ComposicaoMaoDeObra[];

  quantitativosConsolidados: {
    listaCompraMateriais: ComposicaoListaCompraItem[];
    necessidadeEquipamentos: any[]; // Simplificado, pode ser refinado
    quadroMaoDeObraTotal: any[]; // Simplificado, pode ser refinado
  };

  indicadores: ComposicaoIndicadores;

  guias: {
    dicasExecucao: string;
    alertasSeguranca: string;
    criteriosQualidade: string;
  };

  analiseEngenheiro: {
    nota?: string;
    fontesReferencias?: string;
    quadroProdutividade?: string;
    analiseRecomendacao?: string;
    notaDaImportacao?: string; // Campo opcional para a nota de adaptação
  };
}

// --- TIPOS DE RESPOSTA PARA O ASK H-QUANT ---
export type RespostaDireta = {
  tipoResposta: "resposta_direta";
  texto: string;
};
export type ListaComposicoes = {
  tipoResposta: "lista_composicoes";
  ids: string[];
  textoIntroducao: string;
};
export type RespostaAnalitica = {
  tipoResposta: "resposta_analitica";
  texto: string;
  idsReferenciados: string[];
};
export type NaoEncontrado = {
  tipoResposta: "nao_encontrado";
  texto: string;
};
export type GeminiResponse = RespostaDireta | ListaComposicoes | RespostaAnalitica | NaoEncontrado;
