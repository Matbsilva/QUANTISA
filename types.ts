

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
    compositionMappings?: Record<string, { type: 'existing' | 'new', selectedCompositionId?: string }>;
    refinementSuggestions?: RefinementSuggestion[]; // Sugestões da IA para dúvidas pendentes
    valueEngineeringAnalysis?: ValueEngineeringAnalysis[]; // Análise de EV da IA
    refinementSelections?: Record<string, string>; // { doubtId: selectedOption | '__OTHER__' }
    customRefinementAnswers?: Record<string, string>; // { doubtId: 'custom text answer' }
    valueEngineeringSelections?: Record<string, string>; // { itemId: selectedAlternativeSolution }
}


export interface Insumo {
    id: string;
    nome: string;
    unidade: string;
    custo: number;
    tipo: 'Material' | 'MaoObra' | 'Equipamento';
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  thinking?: boolean;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface GroundingMetadata {
  groundingChunks: GroundingChunk[];
}

export interface SearchResult {
  text: string;
  metadata?: GroundingMetadata;
}