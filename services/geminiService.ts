

import { GoogleGenAI, GenerateContentResponse, Blob, Modality, type LiveServerMessage } from "@google/genai";
import type { Message, SearchResult, Service, Doubt, RefinementSuggestion, ValueEngineeringAnalysis, InternalQuery } from '../types';

let ai: GoogleGenAI | null = null;

/**
 * Lazily initializes and returns the GoogleGenAI instance.
 * This function ensures the SDK is only instantiated on the client-side when needed.
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

export interface DetailedScopeAnalysis {
    detailedServices: Service[];
    pendingDoubts: Doubt[];
    internalQueries: InternalQuery[];
}

export const getDetailedScope = async (
    services: Service[], 
    doubts: Doubt[], 
    clientAnswers: string
): Promise<DetailedScopeAnalysis> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");
    
    const prompt = `
        1.0 PERSONA E OBJETIVOS ESTRATÉGICOS (OBRIGATÓRIO INTERNALIZAR)
        Você atuará como um Engenheiro Civil Sênior e especialista em orçamentos que opera com uma Visão de Dono absoluta. Seu objetivo final é gerar inteligência de negócio para garantir propostas competitivas, maximizar a lucratividade e entregar valor e segurança ao cliente.

        Seus princípios de atuação são (VOCÊ DEVE APLICAR ESTES PRINCÍPIOS EM SUA ANÁLISE):
        *   Busca pelo Custo-Benefício Ótimo: Seu foco é ser competitivo. Você deve sempre buscar a solução mais econômica possível, desde que ela respeite integralmente as normas técnicas e as recomendações dos fabricantes. Seu objetivo é garantir bons preços para ganhar mais obras e assegurar uma margem de lucro saudável através da precisão técnica.
        *   Engenharia de Valor como Ferramenta Estratégica: Você entende que o menor preço nem sempre é a melhor solução. Você deve ser capaz de propor alternativas de maior valor agregado que, mesmo que mais caras, ofereçam maior durabilidade, segurança ou performance, justificando o investimento e diferenciando nossa proposta da concorrência.
        *   Foco Obsessivo em Mitigação de Riscos: Sua primeira prioridade é identificar e neutralizar qualquer risco (técnico, executivo, logístico ou de escopo) antes que ele se materialize em prejuízo, retrabalho ou atraso.
        *   Precisão como Vantagem Competitiva: Seu trabalho é apurar os custos com a máxima precisão possível. Isso permite negociar com mais agressividade, ter uma margem de lucro clara e ganhar mais projetos por apresentar propostas tecnicamente superiores e financeiramente mais seguras.
        *   Consultor, Não Calculista: Você atua como um consultor técnico para o seu cliente (eu), explicando o "porquê" de cada decisão, educando sobre os riscos e guiando para a melhor solução técnica e comercial.

        2.0 AÇÃO: REFINAMENTO DE ESCOPO
        Sua tarefa é refinar uma lista de serviços com base nas respostas do cliente.

        **Contexto Fornecido:**
        - **Lista de Serviços Inicial:** ${JSON.stringify(services)}
        - **Dúvidas Técnicas (que você gerou):** ${JSON.stringify(doubts)}
        - **Respostas do Cliente:** "${clientAnswers}"

        **Suas Tarefas:**
        1.  **Análise Crítica:** Analise as respostas do cliente. Para cada dúvida, determine se a resposta foi clara e suficiente.
        2.  **Enriquecer Descrição:** Se a resposta for clara, utilize a informação para enriquecer o campo "description" do serviço correspondente. A descrição deve ser técnica e focar no **ESCOPO** (o quê será entregue), não no processo (como será feito).
        3.  **Criar Consultas Internas com Premissas:** Se uma resposta do cliente for vaga, incompleta, ou implicar uma nova premissa técnica/logística, crie uma "Consulta Interna" (internalQueries). **IMPORTANTE:** A consulta deve ser uma pergunta seguida de uma premissa sugerida para validação. Exemplo: "As dimensões do elevador não foram informadas. Assumir que o elevador comporta chapas de drywall sem necessidade de corte ou içamento manual?".
        4.  **Identificar Dúvidas Pendentes:** Se uma dúvida não foi respondida de forma alguma, adicione-a à lista de "pendingDoubts".

        **Formato de Saída Obrigatório:**
        Responda APENAS com um único objeto JSON válido, sem nenhum texto extra. A estrutura deve ser:
        {
          "detailedServices": [ { "id": "string", "nome": "string", "quantidade": number, "unidade": "string", "description": "string" }, ... ],
          "pendingDoubts": [ { "id": "string", "question": "string" }, ... ],
          "internalQueries": [ { "id": "string", "query": "string" }, ... ]
        }
    `;

    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        let textToParse = response.text;
        const match = textToParse.match(jsonRegex);

        if (match && match[1]) {
            textToParse = match[1];
        }
        
        const jsonData: DetailedScopeAnalysis = JSON.parse(textToParse);
        
        if (!jsonData.detailedServices || !Array.isArray(jsonData.detailedServices)) {
            throw new Error("Resposta da IA inválida: 'detailedServices' não encontrado ou não é um array.");
        }

        jsonData.pendingDoubts = jsonData.pendingDoubts || [];
        jsonData.internalQueries = jsonData.internalQueries || [];


        return jsonData;

    } catch (error) {
        console.error("Error generating detailed scope:", error);
        throw new Error("Não foi possível gerar o escopo detalhado a partir das respostas.");
    }
};

export interface ProcessedQueriesOutput {
    newServices: Service[];
    newObservations: string[];
}

export const processApprovedQueries = async (approvedQueries: InternalQuery[], currentServices: Service[]): Promise<ProcessedQueriesOutput> => {
     const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");
    
    const prompt = `
        1.0 PERSONA E OBJETIVOS ESTRATÉGICOS (OBRIGATÓRIO INTERNALIZAR)
        Você atuará como um Engenheiro Civil Sênior e especialista em orçamentos que opera com uma Visão de Dono absoluta. Seu objetivo final é gerar inteligência de negócio para garantir propostas competitivas, maximizar a lucratividade e entregar valor e segurança ao cliente.

        Seus princípios de atuação são (VOCÊ DEVE APLICAR ESTES PRINCÍPIOS EM SUA ANÁLISE):
        *   Busca pelo Custo-Benefício Ótimo: Seu foco é ser competitivo. Você deve sempre buscar a solução mais econômica possível, desde que ela respeite integralmente as normas técnicas e as recomendações dos fabricantes. Seu objetivo é garantir bons preços para ganhar mais obras e assegurar uma margem de lucro saudável através da precisão técnica.
        *   Engenharia de Valor como Ferramenta Estratégica: Você entende que o menor preço nem sempre é a melhor solução. Você deve ser capaz de propor alternativas de maior valor agregado que, mesmo que mais caras, ofereçam maior durabilidade, segurança ou performance, justificando o investimento e diferenciando nossa proposta da concorrência.
        *   Foco Obsessivo em Mitigação de Riscos: Sua primeira prioridade é identificar e neutralize qualquer risco (técnico, executivo, logístico ou de escopo) antes que ele se materialize em prejuízo, retrabalho ou atraso.
        *   Precisão como Vantagem Competitiva: Seu trabalho é apurar os custos com a máxima precisão possível. Isso permite negociar com mais agressividade, ter uma margem de lucro clara e ganhar mais projetos por apresentar propostas tecnicamente superiores e financeiramente mais seguras.
        *   Consultor, Não Calculista: Você atua como um consultor técnico para o seu cliente (eu), explicando o "porquê" de cada decisão, educando sobre os riscos e guiando para a melhor solução técnica e comercial.

        2.0 AÇÃO: PROCESSAMENTO DE PREMISSAS APROVADAS
        Sua tarefa é interpretar um conjunto de premissas que foram aprovadas e transformá-las em ações concretas para um orçamento.

        **Contexto Fornecido:**
        - **Lista de Serviços Atuais (para referência de contexto):** ${JSON.stringify(currentServices)}
        - **Lista de Premissas Aprovadas:** ${JSON.stringify(approvedQueries)}

        **Suas Tarefas:**
        1.  **Análise de Intenção:** Para cada premissa na lista, analise o texto e determine se ele representa:
            a) A criação de um **novo serviço** que não existia antes.
            b) Uma **observação geral** sobre o projeto (uma condição, uma premissa de execução, etc.).
        2.  **Geração de Novos Serviços (com Inteligência):** Se uma premissa representa um novo serviço, você deve criar um objeto de serviço completo.
            - **nome:** Crie um nome de serviço claro e conciso (ex: "Aplicação de autonivelante cimentício").
            - **description:** Escreva uma descrição técnica para o serviço.
            - **quantidade e unidade:** **Se a premissa estiver relacionada a um serviço existente (ex: aplicar sobre um contrapiso), TENTE INFERIR a quantidade e unidade a partir do serviço de base.** Se não for possível, ESTIME um valor plausível e use 'vb' (verba) como unidade. Ex: { "quantidade": 1, "unidade": "vb" }. É crucial que você sempre forneça um valor.
        3.  **Geração de Observações:** Se a premissa for uma observação, reescreva a frase como uma afirmação declarativa.
            - **Exemplo de Entrada:** "As dimensões do elevador de serviço não foram informadas. Assumir que o elevador comporta chapas de drywall (2.40m ou 3.00m) e outros materiais de grandes dimensões sem necessidade de corte ou içamento manual?"
            - **Exemplo de Saída:** "Premissa: As dimensões do elevador de serviço não foram informadas; assume-se que o mesmo comporta chapas de drywall e outros materiais de grandes dimensões sem necessidade de corte ou içamento."

        **Formato de Saída Obrigatório:**
        Responda APENAS com um único objeto JSON válido, sem nenhum texto extra. A estrutura deve ser:
        {
          "newServices": [ { "id": "string", "nome": "string", "description": "string", "quantidade": number, "unidade": "string" }, ... ],
          "newObservations": ["string", ...]
        }
    `;

    try {
         const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        
        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        let textToParse = response.text;
        const match = textToParse.match(jsonRegex);

        if (match && match[1]) {
            textToParse = match[1];
        }

        const jsonData: ProcessedQueriesOutput = JSON.parse(textToParse);
        
        // Add unique IDs to new services
        jsonData.newServices = (jsonData.newServices || []).map(s => ({...s, id: `serv-new-${Date.now()}-${Math.random()}`}));
        jsonData.newObservations = jsonData.newObservations || [];

        return jsonData;

    } catch (error) {
        console.error("Error processing approved queries:", error);
        throw new Error("Não foi possível processar as definições aprovadas.");
    }
};


export interface RefinementAndValueEngineeringOutput {
    refinementSuggestions: RefinementSuggestion[];
    valueEngineeringAnalysis: ValueEngineeringAnalysis[];
}

export const getRefinementAndValueEngineeringSuggestions = async (
    detailedServices: Service[],
    pendingDoubts: Doubt[]
): Promise<RefinementAndValueEngineeringOutput> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const prompt = `
        1.0 PERSONA E OBJETIVOS ESTRATÉGICOS (OBRIGATÓRIO INTERNALIZAR)
        Você atuará como um Engenheiro Civil Sênior e especialista em orçamentos que opera com uma Visão de Dono absoluta. Seu objetivo final é gerar inteligência de negócio para garantir propostas competitivas, maximizar a lucratividade e entregar valor e segurança ao cliente.

        Seus princípios de atuação são (VOCÊ DEVE APLICAR ESTES PRINCÍPIOS EM SUA ANÁLISE):
        *   Busca pelo Custo-Benefício Ótimo: Seu foco é ser competitivo. Você deve sempre buscar a solução mais econômica possível, desde que ela respeite integralmente as normas técnicas e as recomendações dos fabricantes. Seu objetivo é garantir bons preços para ganhar mais obras e assegurar uma margem de lucro saudável através da precisão técnica.
        *   Engenharia de Valor como Ferramenta Estratégica: Você entende que o menor preço nem sempre é a melhor solução. Você deve ser capaz de propor alternativas de maior valor agregado que, mesmo que mais caras, ofereçam maior durabilidade, segurança ou performance, justificando o investimento e diferenciando nossa proposta da concorrência.
        *   Foco Obsessivo em Mitigação de Riscos: Sua primeira prioridade é identificar e neutralizar qualquer risco (técnico, executivo, logístico ou de escopo) antes que ele se materialize em prejuízo, retrabalho ou atraso.
        *   Precisão como Vantagem Competitiva: Seu trabalho é apurar os custos com a máxima precisão possível. Isso permite negociar com mais agressividade, ter uma margem de lucro clara e ganhar mais projetos por apresentar propostas tecnicamente superiores e financeiramente mais seguras.
        *   Consultor, Não Calculista: Você atua como um consultor técnico para o seu cliente (eu), explicando o "porquê" de cada decisão, educando sobre os riscos e guiando para a melhor solução técnica e comercial.

        2.0 AÇÃO: GERAR SUGESTÕES DE REFINAMENTO E ANÁLISE DE ENGENHARIA DE VALOR

        **Contexto:**
        - **Serviços Detalhados:** ${JSON.stringify(detailedServices)}
        - **Dúvidas Pendentes:** ${JSON.stringify(pendingDoubts)}

        **Suas Tarefas:**

        **1. Refinamento de Dúvidas (refinementSuggestions):**
           - Para CADA dúvida pendente, gere de 3 a 5 sugestões de resposta.
           - Para cada sugestão, determine se a ação resultante é uma **modificação** de um serviço existente ou a **adição** de um novo, e preencha o campo \`actionType\` com \`'modify'\` ou \`'add'\`.
           - **Regra de Ordenação:** Ordene as sugestões da mais econômica/simples para a mais cara/premium.
           - **Contextualização:** Para cada sugestão, adicione uma "tag" que justifique sua posição (ex: "Solução Econômica", "Padrão de Mercado (Custo-Benefício)", "Alta Performance").

        **2. Análise de Engenharia de Valor (valueEngineeringAnalysis):**
           - **É OBRIGATÓRIO E CRÍTICO que você execute esta análise.**
           - **Seleção de Itens:** Analise a lista de serviços e identifique de 1 a 3 itens com maior impacto potencial no custo ou no risco técnico do projeto.
           - **Geração de Alternativas:** Para cada item selecionado, você **DEVE** criar uma análise.
                - A primeira opção **DEVE SER SEMPRE** a "Solução Atual", que é o serviço como descrito no escopo.
                - Gere de uma a duas "Alternativas" que sejam soluções técnicas viáveis e comuns no mercado, pensando nos eixos de otimização (Velocidade, Performance, Custo).
           - **Preenchimento das Colunas (Lógica Detalhada e Obrigatória):** Para cada solução (a atual e as alternativas), você **DEVE OBRIGATORIAMENTE PREENCHER TODAS as colunas abaixo.** Não deixe nenhum campo em branco. Seja técnico e quantitativo.
                - **solution:** Título curto e claro. Use <br/> para quebras de linha se necessário.
                - **relativeCost:** Estime a variação percentual do custo total (material + mão de obra) da alternativa em relação à "Solução Atual". Formato da Resposta: "Custo Base<br/>(0%)", "Custo Alto (+40%)<br/>(aprox.)", "Custo Baixo (-15%)<br/>(aprox.)".
                - **deadlineImpact:** Estime o impacto no tempo de execução do serviço. Formato da Resposta: "Prazo Base<br/>(0%)", "Mais Rápido (-50%)<br/>(aprox.)", "Mais Lento (+30%)<br/>(aprox.)".
                - **pros:** Liste em bullet points os benefícios técnicos e práticos mais relevantes.
                - **cons:** Liste em bullet points os pontos negativos e os riscos técnicos. Seja específico.
                - **recommendation:** Sintetize sua análise em uma única frase conclusiva. Use frases-chave como: "Melhor custo-benefício para...", "Ideal se o prazo for crítico...", "Recomendado para durabilidade máxima...".
        
        **Formato de Saída Obrigatório:**
        Responda APENAS com um único objeto JSON válido e completo, seguindo estritamente a estrutura do exemplo abaixo.

        **Exemplo da Estrutura JSON de Saída Completa:**
        \`\`\`json
        {
          "refinementSuggestions": [
            {
              "doubtId": "dbt-x",
              "question": "O escopo prevê a instalação de portas?",
              "suggestedAnswers": [
                { "answer": "Kit Porta Pronta (simples)", "tag": "Solução Econômica", "actionType": "add" },
                { "answer": "Porta de madeira maciça", "tag": "Solução Robusta", "actionType": "add" }
              ]
            }
          ],
          "valueEngineeringAnalysis": [
            {
              "itemId": "serv-4",
              "itemName": "Instalação de piso vinílico",
              "options": [
                {
                  "solution": "Solução Atual:<br/>Vinílico Colado 3mm",
                  "relativeCost": "Custo Base<br/>(0%)",
                  "deadlineImpact": "Prazo Base<br/>(0%)",
                  "pros": ["Excelente durabilidade", "Melhor acústica"],
                  "cons": ["Custo de material mais elevado", "Instalação mais lenta"],
                  "recommendation": "Recomendação do Engenheiro: Ótima escolha para áreas de alto tráfego."
                },
                {
                  "solution": "Alternativa 1:<br/>Piso Vinílico Clicado 5mm",
                  "relativeCost": "Custo Alto (+40%)<br/>(aprox.)",
                  "deadlineImpact": "Mais Rápido (-50%)<br/>(aprox.)",
                  "pros": ["Instalação muito rápida", "Pode ser reinstalado"],
                  "cons": ["Custo do material significativamente maior"],
                  "recommendation": "Recomendação do Engenheiro: Ideal se o prazo for o fator mais crítico."
                }
              ]
            }
          ]
        }
        \`\`\`
    `;

    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        
        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        const match = response.text.match(jsonRegex);
        let textToParse = response.text;

        if (match && match[1]) {
            textToParse = match[1];
        }
        
        const jsonData: RefinementAndValueEngineeringOutput = JSON.parse(textToParse);

        if (!jsonData.refinementSuggestions || !jsonData.valueEngineeringAnalysis) {
            throw new Error("Resposta da IA inválida. Estrutura de sugestões não encontrada.");
        }

        return jsonData;

    } catch (error) {
        console.error("Error generating refinement and VE suggestions:", error);
        throw new Error("Não foi possível gerar as sugestões de refinamento e engenharia de valor.");
    }
};


const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
};

export const analyzeImage = async (prompt: string, image: File): Promise<string> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) return "Desculpe, o serviço de IA não está configurado corretamente. Verifique a chave de API.";
    try {
        const imagePart = await fileToGenerativePart(image);
        const textPart = { text: prompt };
        const response: GenerateContentResponse = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart, imagePart] },
        });
        return response.text;
    } catch (error) {
        console.error("Error analyzing image:", error);
        return "Desculpe, não consegui analisar a imagem.";
    }
};

export const analyzeText = async (prompt: string): Promise<string> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) return "Desculpe, o serviço de IA não está configurado corretamente. Verifique a chave de API.";
    try {
        const response: GenerateContentResponse = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error analyzing text:", error);
        return "Desculpe, não consegui analisar o texto.";
    }
};


export const generateWithSearch = async (prompt: string): Promise<SearchResult> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) return { text: "Desculpe, o serviço de IA não está configurado corretamente. Verifique a chave de API." };
    try {
        const response: GenerateContentResponse = await aiInstance.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });
        
        const text = response.text;
        const metadata = response.candidates?.[0]?.groundingMetadata;

        return { text, metadata };
    } catch (error) {
        console.error("Error with search grounding:", error);
        return { text: "Desculpe, ocorreu um erro ao pesquisar." };
    }
}

export const streamChat = async (
    history: Message[], 
    newMessage: string, 
    usePro: boolean
): Promise<AsyncGenerator<string, void, unknown>> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) {
        async function* emptyGenerator(): AsyncGenerator<string, void, unknown> {
            yield "Desculpe, o serviço de IA não está configurado corretamente. Verifique a chave de API.";
        }
        return emptyGenerator();
    }
    
    const modelName = usePro ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const config = usePro ? { thinkingConfig: { thinkingBudget: 32768 } } : {};
    
    const chat = aiInstance.chats.create({
        model: modelName,
        config,
        history: history.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text }]
        }))
    });

    const result = await chat.sendMessageStream({ message: newMessage });
    
    async function* generator(): AsyncGenerator<string, void, unknown> {
        for await (const chunk of result) {
            yield chunk.text;
        }
    }
    return generator();
};

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const createTranscriptionSession = (
    onMessage: (text: string, isFinal: boolean) => void,
    onError: (error: Error) => void
) => {
    let sessionPromise: Promise<any> | null = null;
    let stream: MediaStream | null = null;
    let inputAudioContext: AudioContext | null = null;
    let scriptProcessor: ScriptProcessorNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    const createBlob = (data: Float32Array): Blob => {
        const l = data.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) {
            int16[i] = data[i] * 32768;
        }
        return {
            data: encode(new Uint8Array(int16.buffer)),
            mimeType: 'audio/pcm;rate=16000',
        };
    };
    
    const start = async () => {
        const aiInstance = getAiInstance();
        if (!aiInstance) {
            onError(new Error("Serviço de IA não está configurado. Verifique a chave de API."));
            return;
        }
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

            sessionPromise = aiInstance.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        console.log('Live session opened.');
                        if (!stream || !inputAudioContext) return;

                        source = inputAudioContext.createMediaStreamSource(stream);
                        scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromise?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContext.destination);
                    },
                    onmessage: (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            const { text } = message.serverContent.inputTranscription;
                            const isFinal = message.serverContent?.turnComplete || false;
                             onMessage(text, isFinal);
                        }
                        if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
                        }
                    },
                    onerror: (e: any) => onError(new Error(e.message ?? "Live session error")),
                    onclose: () => console.log('Live session closed.'),
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                },
            });
            
        } catch (err) {
            onError(err instanceof Error ? err : new Error('Failed to start audio capture'));
        }
    };
    
    const stop = async () => {
        if (scriptProcessor) {
            scriptProcessor.disconnect();
            scriptProcessor = null;
        }
        if (source) {
            source.disconnect();
            source = null;
        }
        if (inputAudioContext && inputAudioContext.state !== 'closed') {
            await inputAudioContext.close();
            inputAudioContext = null;
        }
        stream?.getTracks().forEach(track => track.stop());
        stream = null;

        if (sessionPromise) {
            try {
                const session = await sessionPromise;
                session.close();
            } catch(e) {
                console.error("Error closing session", e);
            } finally {
                sessionPromise = null;
            }
        }
    };
    
    return { start, stop };
};