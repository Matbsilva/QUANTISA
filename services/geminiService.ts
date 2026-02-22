
import { GoogleGenAI, GenerateContentResponse, Blob, Modality, type LiveServerMessage } from "@google/genai";
import type {
  Composicao,
  SearchResult,
  Insumo,
  Service,
  Doubt,
  InternalQuery,
  ApprovalStatus,
  RefinementSuggestion,
  ValueEngineeringAnalysis,
  GeminiResponse,
  ParsedAnalysis,
  Message,
  CompositionMappingItem,
  InsumoValidationItem
} from '../types';

let ai: GoogleGenAI | null = null;

/**
 * Lazily initializes and returns the GoogleGenAI instance.
 */
function getAiInstance() {
    if (ai) {
        return ai;
    }
    const apiKey = process.env.API_KEY;
    if (apiKey) {
        ai = new GoogleGenAI({ apiKey });
        return ai;
    }
    console.warn("Gemini AI service is not initialized. Make sure the API_KEY environment variable is set.");
    return null;
}

// Definição para o parsing de composições
export type ParsedComposicao = Omit<Composicao, 'id' | 'codigo'> & { 
    codigo?: string; 
};

// ====================================================================================================
// SISTEMA DE RETRY ROBUSTO (PORTADO DO H-QUANT)
// ====================================================================================================

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }
      const delay = Math.min(initialDelay * Math.pow(backoffFactor, attempt), maxDelay);
      console.warn(`Tentativa ${attempt + 1}/${maxRetries + 1} falhou. Tentando novamente em ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError!;
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return ['overloaded', '503', '429', 'too many requests', 'timeout', 'network error', 'fetch failed'].some(p => msg.includes(p));
}

// ====================================================================================================
// HELPER FUNCTIONS FOR JSON CLEANING
// ====================================================================================================

function cleanJsonString(text: string): string {
    let cleaned = text;

    // 1. Try to extract from Markdown blocks first
    const markdownMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
        cleaned = markdownMatch[1];
    } else {
        const simpleBlockMatch = cleaned.match(/```\s*([\s\S]*?)\s*```/);
        if (simpleBlockMatch) {
            cleaned = simpleBlockMatch[1];
        } else {
            // 1.1 If no markdown, try to extract the JSON object/array directly by finding the first [ or {
            const firstOpenBrace = cleaned.indexOf('{');
            const firstOpenBracket = cleaned.indexOf('[');
            
            let start = -1;
            let end = -1;

            if (firstOpenBrace !== -1 && (firstOpenBracket === -1 || firstOpenBrace < firstOpenBracket)) {
                start = firstOpenBrace;
                end = cleaned.lastIndexOf('}') + 1;
            } else if (firstOpenBracket !== -1) {
                start = firstOpenBracket;
                end = cleaned.lastIndexOf(']') + 1;
            }

            if (start !== -1 && end > start) {
                cleaned = cleaned.substring(start, end);
            }
        }
    }

    // 2. Fix: Replace \' with ' (Single quote escape is valid in JS but invalid in JSON strings)
    cleaned = cleaned.replace(/\\'/g, "'");

    // 3. Fix: Fix invalid unicode escapes (e.g. \u00 or \u12 or \uTGIF)
    cleaned = cleaned.replace(/\\u(?![0-9a-fA-F]{4})/g, "\\\\u");

    // 4. Fix: Escape backslashes that are not part of a valid JSON escape sequence
    cleaned = cleaned.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");

    // 5. Fix: Remove trailing commas in objects/arrays (common LLM error)
    cleaned = cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

    return cleaned.trim();
}

// ====================================================================================================
// PERSONA E PROMPTS MODULARES
// ====================================================================================================

// Persona Persistente (Apenas identidade e tom)
const CORE_PERSONA = `
**PERSONA:** Eng. Marcus Oliveira, Engenheiro Civil Sênior especialista em orçamentos.
**POSTURA:**
1. **Visão de Dono:** Foco em custo-benefício e viabilidade.
2. **Consultor Técnico:** Sempre justifica escolhas e sugere melhorias.
3. **Guardião de Dados:** Prioriza o uso de dados históricos do usuário (Data Master).
`;

// ====================================================================================================
// FUNÇÕES DE ETAPAS
// ====================================================================================================

export const classifyComposition = async (titulo: string, codigosExistentes: string[]): Promise<{ sugestaoCodigo: string; grupo: string; subgrupo: string; justificativa: string }> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const prompt = `
    ${CORE_PERSONA}
    **TAREFA (Classificação):** Sugerir classificação (Grupo, Subgrupo) e Código único para uma nova composição.
    **DADOS:** Título: "${titulo}". Códigos Existentes: ${JSON.stringify(codigosExistentes.slice(0, 50))}...
    
    **REGRAS:**
    1. GRUPO/SUBGRUPO em CAIXA ALTA.
    2. Código padrão GRUPO-SUBGRUPO-SEQUENCIAL.
    
    **SAÍDA (JSON):** { "grupo": "String", "subgrupo": "String", "sugestaoCodigo": "String", "justificativa": "String" }
    `;

    try {
        const response = await withRetry<GenerateContentResponse>(() => aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        }));
        return JSON.parse(cleanJsonString(response.text || '{}'));
    } catch (error) {
        console.error("Erro ao classificar:", error);
        return { grupo: 'GERAL', subgrupo: 'GERAL', sugestaoCodigo: `NEW-${Math.floor(Math.random() * 1000)}`, justificativa: 'Erro na IA.' };
    }
};

export const parseCompositions = async (text: string): Promise<ParsedComposicao[]> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const prompt = `
**PERSONA:** SCANNER DE TEXTO INTELIGENTE (Foco em Extração de Dados).
**TAREFA:** Transcrever o texto técnico fornecido para um objeto JSON estruturado (Composicao).

**JSON SCHEMA:**
Array<Composicao> onde Composicao tem: 
- titulo, unidade, quantidadeReferencia, grupo, subgrupo, tags (string[]), classificacaoInterna
- premissas: { escopo, metodo, incluso, naoIncluso }
- insumos: { materiais: [{item, unidade, quantidade, valorUnitario, valorTotal}], equipamentos: [] }
- maoDeObra: [{funcao, hhPorUnidade, custoUnitario, custoTotal}]
- indicadores: { custoMateriaisPorUnidade, custoMaoDeObraPorUnidade, custoEquipamentosPorUnidade, custoDiretoTotalPorUnidade }
- analiseEngenheiro: { nota, fontesReferencias, quadroProdutividade, analiseRecomendacao }

**IMPORTANTE:** Se o texto estiver incompleto, tente inferir com base no contexto, mas priorize a fidelidade.
    `;

    const fullPrompt = `${prompt}\n\n---\nTEXTO PARA EXTRAÇÃO:\n${text}`;

    try {
        const response = await withRetry<GenerateContentResponse>(() => aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
            config: { responseMimeType: "application/json" }
        }));
        
        const data = JSON.parse(cleanJsonString(response.text || '[]'));
        return Array.isArray(data) ? data : (data.titulo ? [data] : []);
    } catch (error) {
        console.error("Erro no parse:", error);
        throw new Error("Falha ao interpretar composições.");
    }
};

// --- ETAPA 1.5 / 3: VALIDAÇÃO DE INSUMOS (NOVO) ---

export const generateInsumoValidationList = async (detailedServices: Service[], existingInsumos: Insumo[]): Promise<InsumoValidationItem[]> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    // 1. Minificar dados para prompt
    const scopeSummary = detailedServices.map(s => `${s.quantidade} ${s.unidade} de ${s.nome} (${s.description || ''})`).join('\n');
    const dbSummary = existingInsumos.map(i => `${i.id}|${i.nome}|${i.unidade}|R$${i.custo}`).join('\n');

    const prompt = `
${CORE_PERSONA}

**TAREFA (Validação de Custos):**
Com base no escopo detalhado abaixo, identifique QUAIS insumos (materiais e mão de obra) são necessários para compor estes serviços.
Para cada insumo identificado:
1. Verifique se ele já existe na "Base de Dados" fornecida (correspondência aproximada de nome).
2. Se existir, use o preço da base.
3. Se NÃO existir, estime um preço de mercado atual (use o Google Search se necessário).

**ESCOPO DO PROJETO:**
${scopeSummary}

**BASE DE DADOS EXISTENTE (ID|Nome|Unidade|Custo):**
${dbSummary}

**SAÍDA (JSON Array):**
Retorne uma lista de objetos 'InsumoValidationItem':
{
  "id": "temp-id-...",
  "nome": "Nome do Insumo",
  "unidade": "un/m2/kg...",
  "quantidadeEstimada": number (estimativa grosseira para o total da obra),
  "databasePrice": number | null (se encontrado na base),
  "databaseInsumoId": "string" | null (ID do item na base se encontrado),
  "aiSuggestedPrice": number (sua estimativa de mercado),
  "aiSource": "Fonte da estimativa (ex: 'SINAPI', 'Média de Mercado', 'Base Interna')",
  "finalPrice": number (use o databasePrice se existir, senão use o aiSuggestedPrice),
  "status": "ok" | "missing" (ok se achou no banco, missing se é novo)
}
`;

    try {
        // Habilita googleSearch para preencher preços faltantes
        const response = await withRetry<GenerateContentResponse>(() => aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { 
                responseMimeType: "application/json",
                tools: [{ googleSearch: {} }] 
            }
        }));
        
        const data = JSON.parse(cleanJsonString(response.text || '[]'));
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Erro na validação de insumos:", error);
        return [];
    }
};


// --- OUTRAS FUNÇÕES ---

export const getDetailedScope = async (services: Service[], doubts: Doubt[], clientAnswers: string) => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("IA não configurada.");
    
    const prompt = `
    ${CORE_PERSONA}
    **TAREFA (Escopo Detalhado):** Refinar a lista de serviços com base nas respostas do cliente.
    **CONTEXTO:** Serviços Iniciais: ${JSON.stringify(services)}. Dúvidas: ${JSON.stringify(doubts)}. Respostas Cliente: "${clientAnswers}".
    **SAÍDA:** JSON {detailedServices, pendingDoubts, internalQueries}.
    `;
    
    const response = await withRetry<GenerateContentResponse>(() => aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    }));
    return JSON.parse(cleanJsonString(response.text || '{}'));
};

export const refineScopeFromEdits = async (currentServices: Service[], userInstruction: string) => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("IA não configurada.");
    const prompt = `Reanalisar escopo. Atual: ${JSON.stringify(currentServices)}. Instrução: "${userInstruction}". Retorne JSON { updatedServices }.`;
    
    const response = await withRetry<GenerateContentResponse>(() => aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    }));
    return JSON.parse(cleanJsonString(response.text || '{}'));
};

export const processQueryResponses = async (queryResponses: any[], currentServices: Service[]) => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("IA não configurada.");
    const prompt = `Processar premissas. Contexto: ${JSON.stringify(currentServices)}. Respostas: ${JSON.stringify(queryResponses)}. Retorne JSON { newServices, newObservations }.`;
    
    const response = await withRetry<GenerateContentResponse>(() => aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    }));
    const data = JSON.parse(cleanJsonString(response.text || '{}'));
    data.newServices = (data.newServices || []).map((s: any) => ({...s, id: `serv-new-${Math.random()}`}));
    return data;
};

export const getValueEngineeringAnalysis = async (detailedServices: Service[]) => {
    if (!detailedServices.length) return { valueEngineeringAnalysis: [] };
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("IA off");
    
    const prompt = `
    ${CORE_PERSONA}
    **TAREFA (Engenharia de Valor):** Analisar o escopo e propor alternativas técnicas para otimizar custo/prazo.
    **ESCOPO:** ${JSON.stringify(detailedServices)}
    **SAÍDA:** JSON { valueEngineeringAnalysis: [{ itemId, itemName, options: [{solution, relativeCost, deadlineImpact, pros, cons, recommendation}] }] }.
    `;

    const r = await withRetry<GenerateContentResponse>(() => aiInstance.models.generateContent({
         model: 'gemini-2.5-flash', 
         contents: prompt,
         config: { responseMimeType: "application/json" }
    }));
    return JSON.parse(cleanJsonString(r.text || '{}'));
};

// ... (Rest of existing functions: analyzeImage, analyzeText, generateWithSearch, etc.) ...
// Keep helpers
const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return { inlineData: { data: await base64EncodedDataPromise, mimeType: file.type } };
};

export const analyzeImage = async (prompt: string, image: File): Promise<string> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) return "Erro IA";
    const imagePart = await fileToGenerativePart(image);
    const r = await withRetry<GenerateContentResponse>(() => aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }, imagePart] }
    }));
    return r.text || '';
};

export const analyzeText = async (prompt: string): Promise<string> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) return "Erro IA";
    const r = await withRetry<GenerateContentResponse>(() => aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    }));
    return r.text || '';
};

export const generateWithSearch = async (prompt: string): Promise<SearchResult> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) return { text: "Erro IA" };
    const r = await withRetry<GenerateContentResponse>(() => aiInstance.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
    }));
    return { text: r.text || '', metadata: r.candidates?.[0]?.groundingMetadata };
}

export const streamChat = async (history: Message[], newMessage: string, usePro: boolean): Promise<AsyncGenerator<string, void, unknown>> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) {
        const empty = async function* () { return; };
        return empty();
    }
    const modelName = usePro ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const config = usePro ? { thinkingConfig: { thinkingBudget: 32768 } } : {};
    const chat = aiInstance.chats.create({
        model: modelName,
        config,
        history: history.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] }))
    });
    const result = await chat.sendMessageStream({ message: newMessage });
    async function* generator() {
        for await (const chunk of result) { if (chunk.text) yield chunk.text; }
    }
    return generator();
};

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) { binary += String.fromCharCode(bytes[i]); }
  return btoa(binary);
}

export const createTranscriptionSession = (onMessage: (text: string, isFinal: boolean) => void, onError: (error: Error) => void) => {
    let sessionPromise: Promise<any> | null = null;
    let inputAudioContext: AudioContext | null = null;
    let scriptProcessor: ScriptProcessorNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    const createBlob = (data: Float32Array): Blob => {
        const l = data.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) { int16[i] = data[i] * 32768; }
        return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
    };
    
    const start = async () => {
        const aiInstance = getAiInstance();
        if (!aiInstance) { onError(new Error("IA não configurada.")); return; }
        try {
            const streamVal = await navigator.mediaDevices.getUserMedia({ audio: true });
            inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

            sessionPromise = aiInstance.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        source = inputAudioContext!.createMediaStreamSource(streamVal);
                        scriptProcessor = inputAudioContext!.createScriptProcessor(4096, 1, 1);
                        scriptProcessor.onaudioprocess = (e) => {
                            const blob = createBlob(e.inputBuffer.getChannelData(0));
                            sessionPromise?.then((s) => s.sendRealtimeInput({ media: blob }));
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContext!.destination);
                    },
                    onmessage: (msg: LiveServerMessage) => {
                        if (msg.serverContent?.inputTranscription) {
                            onMessage(msg.serverContent.inputTranscription.text || '', msg.serverContent?.turnComplete || false);
                        }
                    },
                    onerror: (e: any) => onError(new Error(e.message ?? "Live error")),
                    onclose: () => console.log('Live closed.'),
                },
                config: { responseModalities: [Modality.AUDIO], inputAudioTranscription: {} },
            });
        } catch (err) { onError(err instanceof Error ? err : new Error('Audio error')); }
    };
    
    const stop = async () => {
        if (scriptProcessor) { scriptProcessor.disconnect(); scriptProcessor = null; }
        if (source) { source.disconnect(); source = null; }
        if (inputAudioContext && inputAudioContext.state !== 'closed') { await inputAudioContext.close(); inputAudioContext = null; }
        if (sessionPromise) { try { (await sessionPromise).close(); } catch(e) {} finally { sessionPromise = null; } }
    };
    return { start, stop };
};

export const mapScopeToCompositions = async (services: Service[], availableCompositions: Composicao[]): Promise<CompositionMappingItem[]> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const serviceList = services.map(s => ({ id: s.id, nome: s.nome, description: s.description, unidade: s.unidade }));
    const compList = availableCompositions.map(c => ({ id: c.id, titulo: c.titulo, unidade: c.unidade, escopo: c.premissas.escopo }));

    const prompt = `
${CORE_PERSONA}
**TAREFA (Mapeamento):** Vincular serviços do escopo a composições existentes.
**ENTRADA:** Serviços: ${JSON.stringify(serviceList)}. Biblioteca: ${JSON.stringify(compList)}.
**SAÍDA (JSON Array):** [{ "serviceId", "serviceName", "status": "matched"|"partial"|"missing", "suggestedCompositionId", "matchReasoning", "needsCreation" }]
`;

    try {
        const response = await withRetry<GenerateContentResponse>(() => aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        }));
        
        const data = JSON.parse(cleanJsonString(response.text || '[]'));
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Erro no mapeamento:", error);
        return services.map(s => ({
            serviceId: s.id,
            serviceName: s.nome,
            status: 'missing',
            matchReasoning: 'Erro ao processar mapeamento.',
            aiConfidence: 'low',
            needsCreation: true
        }));
    }
};

export const answerQueryFromCompositions = async (query: string, compositions: Composicao[]): Promise<GeminiResponse> => {
  const aiInstance = getAiInstance();
  if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

  const systemInstruction = `
${CORE_PERSONA}
**TAREFA (Ask H-Quant):** Responder dúvidas usando dados internos (prioridade) e web.
**FORMATO:** JSON { "tipoResposta": "...", "texto": "...", ... }
`;

  const contextData = compositions.map(c => ({
      id: c.id,
      titulo: c.titulo,
      codigo: c.codigo,
      unidade: c.unidade,
      custoTotal: c.indicadores.custoDiretoTotalPorUnidade,
  }));

  const prompt = `
**PERGUNTA:** "${query}"
**BASE DE DADOS:** ${JSON.stringify(contextData)}
`;

  try {
    const response = await withRetry<GenerateContentResponse>(() => aiInstance.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { 
          systemInstruction,
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }] 
      }
    }));
    
    return JSON.parse(cleanJsonString(response.text || '{}'));
  } catch (error) {
      console.error(error);
      return { tipoResposta: "nao_encontrado", texto: "Erro ao processar a pergunta." };
  }
};

export const parseInsumos = async (text: string): Promise<Partial<Insumo>[]> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("IA off");
    const r = await withRetry<GenerateContentResponse>(() => aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Parse insumos: ${text}. JSON array {nome, unidade, custo, tipo, marca}.`,
        config: { responseMimeType: "application/json" }
    }));
    const d = JSON.parse(cleanJsonString(r.text || '[]'));
    return Array.isArray(d) ? d : [];
};

export interface BatchSimilarityResult { newInsumoId: string; existingInsumoId: string; similarityScore: number; reasoning: string; }
export const findSimilarInsumosInBatch = async (newInsumos: Partial<Insumo>[], existingInsumos: Insumo[]): Promise<BatchSimilarityResult[]> => {
    if (!newInsumos.length || !existingInsumos.length) return [];
    const aiInstance = getAiInstance();
    if (!aiInstance) return [];
    const r = await withRetry<GenerateContentResponse>(() => aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Compare: New=${JSON.stringify(newInsumos.map(i=>({id:i.id, nome:i.nome})))}. Existing=${JSON.stringify(existingInsumos.map(i=>({id:i.id, nome:i.nome})))}. JSON array {newInsumoId, existingInsumoId, similarityScore, reasoning}.`,
        config: { responseMimeType: "application/json" }
    }));
    const d = JSON.parse(cleanJsonString(r.text || '[]'));
    return Array.isArray(d) ? d : [];
};

export const reviseParsedComposition = async (composition: ParsedComposicao, instruction: string): Promise<ParsedComposicao> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const prompt = `
        ${CORE_PERSONA}
        **JSON ATUAL:** ${JSON.stringify(composition)}
        **INSTRUÇÃO:** "${instruction}"
        **AÇÃO:** Retorne APENAS o JSON corrigido.
    `;

    try {
        const response = await withRetry<GenerateContentResponse>(() => aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        }));
        return JSON.parse(cleanJsonString(response.text || '{}'));
    } catch (error) {
        throw new Error("Falha na revisão.");
    }
}

export interface BatchRelevanceResult {
  idNovaComposicao: string;
  candidatos: {
    idExistente: string;
    titulo: string;
    escopoResumido: string;
    relevanciaScore: number;
    motivo: string;
  }[];
}

export const findRelevantCompositionsInBatch = async (newCompositions: (ParsedComposicao & { id: string })[], existingCompositions: Composicao[]): Promise<BatchRelevanceResult[]> => {
    const aiInstance = getAiInstance();
    if (!aiInstance || newCompositions.length === 0 || existingCompositions.length === 0) {
        return newCompositions.map(c => ({ idNovaComposicao: c.id, candidatos: [] }));
    }

    const newCompositionsForPrompt = newCompositions.map(c => ({ id: c.id, titulo: c.titulo }));
    const existingCompositionsForPrompt = existingCompositions.map(c => ({ id: c.id, titulo: c.titulo, escopo: c.premissas.escopo }));

    const prompt = `
**TAREFA:** Entity Resolution para Engenharia.
Para cada item em "Novas", encontre até 5 similares em "Existentes".
**SAÍDA (JSON):** { "resultados": [ { "idNovaComposicao": "...", "candidatos": [ { "idExistente": "...", "titulo": "...", "escopoResumido": "...", "relevanciaScore": 0-100, "motivo": "..." } ] } ] }
    `;
    
    const payload = { newCompositions: newCompositionsForPrompt, existingCompositions: existingCompositionsForPrompt };

    try {
        const response = await withRetry<GenerateContentResponse>(() => aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${prompt}\n\n${JSON.stringify(payload)}`,
            config: { responseMimeType: "application/json" }
        }));

        const data = JSON.parse(cleanJsonString(response.text || '{}'));
        return data.resultados || [];
    } catch (error) {
        return newCompositions.map(c => ({ idNovaComposicao: c.id, candidatos: [] }));
    }
}

export const getRefinementSuggestions = async (pendingDoubts: Doubt[]) => {
     if (!pendingDoubts.length) return { refinementSuggestions: [] };
     const aiInstance = getAiInstance();
     if (!aiInstance) throw new Error("IA off");
     const r = await withRetry<GenerateContentResponse>(() => aiInstance.models.generateContent({
         model: 'gemini-2.5-flash', 
         contents: `Sugestões para: ${JSON.stringify(pendingDoubts)}. JSON { refinementSuggestions }.`,
         config: { responseMimeType: "application/json" }
     }));
     return JSON.parse(cleanJsonString(r.text || '{}'));
};
