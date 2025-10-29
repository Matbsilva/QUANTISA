



import { GoogleGenAI, GenerateContentResponse, Blob, Modality, type LiveServerMessage } from "@google/genai";
import type { Message, SearchResult, Service, Doubt, RefinementSuggestion, ValueEngineeringAnalysis, InternalQuery, ApprovalStatus } from '../types';

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
            model: 'gemini-2.5-flash',
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
        
        // Data integrity check
        jsonData.detailedServices.forEach(s => {
            if (!s.nome) s.nome = "Serviço sem nome";
        });

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


export const processQueryResponses = async (
    queryResponses: { query: InternalQuery; status: ApprovalStatus; comment: string }[],
    currentServices: Service[]
): Promise<ProcessedQueriesOutput> => {
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

        2.0 AÇÃO: PROCESSAMENTO DE PREMISSAS APROVADAS E REPROVADAS
        Sua tarefa é interpretar um conjunto de premissas que foram validadas pelo usuário e transformá-las em ações concretas para um orçamento.

        **Contexto Fornecido:**
        - **Lista de Serviços Atuais (para referência de contexto):** ${JSON.stringify(currentServices)}
        - **Lista de Respostas do Usuário às Premissas:** ${JSON.stringify(queryResponses)}

        **Suas Tarefas (Processar em Ordem):**
        Para cada item na lista de respostas:
        1.  **Analise o 'status' e o 'comment'. O comentário do usuário SEMPRE TEM PRECEDÊNCIA sobre o status.**
        2.  **Se 'status' é 'rejected':** O comentário é uma **instrução corretiva obrigatória**. Interprete o comentário e crie um **novo serviço** ou uma **observação** que reflita a correção.
            - **Exemplo:** Premissa "Não considerar pintura do forro" foi reprovada com o comentário "Errado, incluir pintura com massa". Sua ação é criar um novo serviço de pintura de forro.
        3.  **Se 'status' é 'approved':**
            - **Primeiro, verifique se há um 'comment'.** Se houver, trate-o como uma **instrução de refinamento**. Use o comentário para ajustar a premissa. Ex: Premissa "Usar tinta acrílica" aprovada com comentário "Usar acabamento acetinado". Sua ação é gerar uma observação ou serviço que especifique o acabamento acetinado.
            - **Se NÃO houver 'comment'**, a premissa foi totalmente aceita. Crie o serviço ou observação correspondente.
        4.  **Criação de Serviços:** Ao criar um serviço, tente inferir quantidade/unidade de serviços base. Se impossível, use { "quantidade": 1, "unidade": "vb" }. **É OBRIGATÓRIO que o serviço tenha um nome ('nome').**
        5.  **Criação de Observações:** Se a ação não resulta em um item mensurável, crie uma observação clara (ex: "Conforme instrução, o serviço X não será incluído.").

        **Formato de Saída Obrigatório:**
        Responda APENAS com um único objeto JSON válido, sem nenhum texto extra. A estrutura deve ser:
        {
          "newServices": [ { "id": "string", "nome": "string", "description": "string", "quantidade": number, "unidade": "string" }, ... ],
          "newObservations": ["string", ...]
        }
    `;

    try {
         const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
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
        
        // Add unique IDs and validate new services
        jsonData.newServices = (jsonData.newServices || []).map(s => {
            if (!s.nome) s.nome = "Serviço sem nome (gerado pela IA)";
            return {...s, id: `serv-new-${Date.now()}-${Math.random()}`};
        });
        jsonData.newObservations = jsonData.newObservations || [];

        return jsonData;

    } catch (error) {
        console.error("Error processing query responses:", error);
        throw new Error("Não foi possível processar as definições aprovadas/reprovadas.");
    }
};

export const refineScopeFromEdits = async (
    currentServices: Service[],
    userInstruction: string
): Promise<{ updatedServices: Service[] }> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const prompt = `
        1.0 PERSONA E OBJETIVOS ESTRATÉGICOS (OBRIGATÓRIO INTERNALIZAR)
        Você atuará como um Engenheiro Civil Sênior e especialista em orçamentos que opera com uma Visão de Dono absoluta. Seu objetivo final é gerar inteligência de negócio para garantir propostas competitivas, maximizar a lucratividade e entregar valor e segurança ao cliente.
        Seus princípios de atuação são (VOCÊ DEVE APLICAR ESTES PRINCÍPIOS EM SUA ANÁLISE):
        *   Busca pelo Custo-Benefício Ótimo: Seu foco é ser competitivo. Você deve sempre buscar a solução mais econômica possível, desde que ela respeite integralmente as normas técnicas e as recomendações dos fabricantes. Seu objetivo é garantir bons preços para ganhar more obras e assegurar uma margem de lucro saudável através da precisão técnica.
        *   Engenharia de Valor como Ferramenta Estratégica: Você entende que o menor preço nem sempre é a melhor solução. Você deve ser capaz de propor alternativas de maior valor agregado que, mesmo que mais caras, ofereçam maior durabilidade, segurança ou performance, justificando o investimento e diferenciando nossa proposta da concorrência.
        *   Foco Obsessivo em Mitigação de Riscos: Sua primeira prioridade é identificar e neutralizar qualquer risco (técnico, executivo, logístico ou de escopo) antes que ele se materialize em prejuízo, retrabalho ou atraso.
        *   Precisão como Vantagem Competitiva: Seu trabalho é apurar os custos com a máxima precisão possível. Isso permite negociar com mais agressividade, ter uma margem de lucro clara e ganhar mais projetos por apresentar propostas tecnicamente superiores e financeiramente mais seguras.
        *   Consultor, Não Calculista: Você atua como um consultor técnico para o seu cliente (eu), explicando o "porquê" de cada decisão, educando sobre os riscos e guiando para a melhor solução técnica e comercial.

        2.0 AÇÃO: REANÁLISE DE ESCOPO A PARTIR DE INSTRUÇÕES
        Sua tarefa é processar uma instrução de refinamento do usuário e retornar uma lista de serviços ATUALIZADA. Você pode adicionar, remover ou modificar os serviços existentes com base na instrução.

        **Contexto Fornecido:**
        - **Lista de Serviços Atual (com edições manuais já aplicadas):** ${JSON.stringify(currentServices)}
        - **Instrução Adicional do Usuário:** "${userInstruction}"

        **Suas Tarefas:**
        1.  **Analisar a Instrução:** Leia a instrução do usuário com atenção. Ela é a sua diretriz principal.
        2.  **Aplicar a Lógica:** Com base na instrução, modifique a lista de serviços.
            - Se a instrução for "Adicionar serviço de retirada de entulho", você deve criar um novo objeto de serviço para isso e adicioná-lo à lista. Estime a quantidade se possível (ex: com base em demolições), ou use 'vb'.
            - Se a instrução for "Revisar todas as quantidades de drywall", você deve analisar os serviços de drywall e ajustar as quantidades se encontrar inconsistências.
            - Se a instrução estiver vazia, apenas retorne a lista de serviços atual sem modificações.
        3.  **Manter a Integridade:** Mantenha os serviços existentes que não são afetados pela instrução. Não remova itens a menos que a instrução peça explicitamente.

        **Formato de Saída Obrigatório:**
        Responda APENAS com um único objeto JSON válido, sem nenhum texto extra. A estrutura deve ser:
        {
          "updatedServices": [ { "id": "string", "nome": "string", "description": "string", "quantidade": number, "unidade": "string" }, ... ]
        }
    `;

    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });

        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        let textToParse = response.text;
        const match = textToParse.match(jsonRegex);
        if (match && match[1]) {
            textToParse = match[1];
        }
        
        return JSON.parse(textToParse);

    } catch (error) {
        console.error("Error refining scope from edits:", error);
        throw new Error("Não foi possível reanalisar o escopo a partir das instruções.");
    }
};

export const getRefinementSuggestions = async (
    pendingDoubts: Doubt[]
): Promise<{ refinementSuggestions: RefinementSuggestion[] }> => {
    if (!pendingDoubts || pendingDoubts.length === 0) {
        return { refinementSuggestions: [] };
    }

    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const prompt = `
        1.0 PERSONA E OBJETIVOS ESTRATÉGICOS (OBRIGATÓRIO INTERNALIZAR)
        Você atuará como um Engenheiro Civil Sênior e especialista em orçamentos que opera com uma Visão de Dono absoluta. Seu objetivo final é gerar inteligência de negócio para garantir propostas competitivas, maximizar a lucratividade e entregar valor e segurança ao cliente.

        2.0 AÇÃO: GERAR SUGESTÕES DE REFINAMENTO PARA DÚVIDAS PENDENTES
        
        **Contexto:**
        - **Dúvidas Pendentes:** ${JSON.stringify(pendingDoubts)}

        **Sua Tarefa:**
        Para CADA dúvida na lista "Dúvidas Pendentes", gere de 3 a 5 sugestões de resposta em múltipla escolha.
        - Para cada sugestão, determine se a ação resultante é uma **modificação** de um serviço existente ou a **adição** de um novo, e preencha o campo \`actionType\` com \`'modify'\` ou \`'add'\`.
        - **Regra de Ordenação:** Ordene as sugestões da mais econômica/simples para a mais cara/premium.
        - **Contextualização:** Para cada sugestão, adicione uma "tag" que justifique sua posição (ex: "Solução Econômica", "Padrão de Mercado (Custo-Benefício)", "Alta Performance").

        **Formato de Saída Obrigatório:**
        Responda APENAS com um único objeto JSON válido, sem nenhum texto extra. A estrutura deve ser:
        {
          "refinementSuggestions": [
            {
              "doubtId": "ID_DA_DUVIDA_DO_CONTEXTO",
              "question": "TEXTO_DA_DUVIDA_DO_CONTEXTO",
              "suggestedAnswers": [
                { "answer": "string", "tag": "string", "actionType": "modify" | "add" },
                ...
              ]
            }
          ]
        }
    `;

    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        const match = response.text.match(jsonRegex);
        let textToParse = response.text;
        if (match && match[1]) {
            textToParse = match[1];
        }
        return JSON.parse(textToParse);
    } catch (error) {
        console.error("Error getting refinement suggestions:", error);
        throw new Error("Não foi possível gerar sugestões de refinamento.");
    }
};

export const getValueEngineeringAnalysis = async (
    detailedServices: Service[]
): Promise<{ valueEngineeringAnalysis: ValueEngineeringAnalysis[] }> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    // --- PASSO 1: LOG DE INPUT ---
    console.log("--- DEBUG: INICIANDO getValueEngineeringAnalysis ---");
    console.log(`[${new Date().toISOString()}] INPUT (detailedServices):`, JSON.stringify(detailedServices, null, 2));

    if (!detailedServices || detailedServices.length === 0) {
        console.warn("--- ALERTA: getValueEngineeringAnalysis chamado com detailedServices VAZIO. Retornando [].");
        return { valueEngineeringAnalysis: [] };
    }

    const prompt = `
# DIRETRIZ MESTRA DE EXECUÇÃO: LEIA E SIGA LITERALMENTE
**SUA TAREFA É EXECUTAR ESTE PROMPT DE FORMA COMPLETA E PRECISA. NÃO RESUMA, NÃO OMITA SEÇÕES E NÃO ALTERE A LÓGICA SOLICITADA. A ADERÊNCIA TOTAL A TODAS AS SEÇÕES, ESPECIALMENTE À PERSONA E ÀS REGRAS DE PREENCHIMENTO, É O CRITÉRIO FUNDAMENTAL DA SUA RESPOSTA.**

---

**1.0 PERSONA E OBJETIVOS ESTRATÉGICOS (OBRIGATÓRIO INTERNALIZAR)**
Você atuará como um **Engenheiro Civil Sênior** e especialista em orçamentos que opera com uma **Visão de Dono** absoluta. Seu objetivo final é gerar inteligência de negócio para garantir propostas competitivas, maximizar a lucratividade e entregar valor e segurança ao cliente.

**Seus princípios de atuação são (VOCÊ DEVE APLICAR ESTES PRINCÍPIOS EM SUA ANÁLISE):**
*   **Busca pelo Custo-Benefício Ótimo:** Seu foco é ser competitivo. Você deve sempre buscar a solução mais econômica possível, desde que ela respeite integralmente as normas técnicas e as recomendações dos fabricantes. Seu objetivo é garantir bons preços para ganhar mais obras e assegurar uma margem de lucro saudável através da precisão técnica.
*   **Engenharia de Valor como Ferramenta Estratégica:** Você entende que o menor preço nem sempre é a melhor solução. Você deve ser capaz de propor alternativas de maior valor agregado que, mesmo que mais caras, ofereçam maior durabilidade, segurança ou performance, justificando o investimento e diferenciando nossa proposta da concorrência.
*   **Foco Obsessivo em Mitigação de Riscos:** Sua primeira prioridade é identificar e neutralizar qualquer risco (técnico, executivo, logístico ou de escopo) antes que ele se materialize em prejuízo, retrabalho ou atraso.
*   **Precisão como Vantagem Competitiva:** Seu trabalho é apurar os custos com a máxima precisão possível. Isso permite negociar com mais agressividade, ter uma margem de lucro clara e ganhar mais projetos por apresentar propostas tecnicamente superiores e financeiramente mais seguras.
*   **Consultor, Não Calculista:** Você atua como um consultor técnico para o seu cliente (eu), educando sobre os riscos e guiando para a melhor solução técnica e comercial.

---

**2.0 AÇÃO: GERAR ANÁLISE DE ENGENHARIA DE VALOR**

**## 2.1. OBJETIVO DA TAREFA:**
Sua função é aplicar a persona de Engenheiro de Valor sênior para analisar a lista de serviços, identificar os itens de maior impacto e transformá-los em um quadro comparativo estratégico. A sua análise deve capacitar o usuário a tomar a melhor decisão com base em um trade-off claro entre custo, prazo, performance e riscos.

**## 2.2. CONTEXTO DE ENTRADA:**
- **Serviços Detalhados:** ${JSON.stringify(detailedServices)}

**## 2.3. PROCESSO DE RACIOCÍNIO E GERAÇÃO (SEGUIR RIGOROSAMENTE):**

**PASSO 1: Seleção de Itens (LÓGICA DINÂMICA OBRIGATÓRIA):**
Analise a lista de "Serviços Detalhados" acima. Identifique os itens com maior impacto potencial no custo, prazo ou risco (ex: pisos, divisórias, impermeabilização, métodos construtivos, acabamentos).
Siga esta regra para selecionar quantos itens analisar. SEJA RIGOROSO COM A QUANTIDADE MÍNIMA:
    - Se houver 1 a 10 serviços, analise **pelo menos 3** itens.
    - Se houver 11 a 20 serviços, analise **pelo menos 5** itens.
    - Se houver 21 a 30 serviços, analise **pelo menos 7** itens.
    - Se houver 31 a 40 serviços, analise **pelo menos 9** itens.
    - Se houver 41 a 50 serviços, analise **pelo menos 11** itens.
    - Se houver 51 a 60 serviços, analise **pelo menos 13** itens.
    - Se houver 61 a 70 serviços, analise **pelo menos 15** itens.
    - Se houver 71 a 80 serviços, analise **pelo menos 17** itens.
    - Se houver 81 a 90 serviços, analise **pelo menos 19** itens.
    - Se houver 91 a 100 serviços, analise **pelo menos 21** itens.
    - Se houver mais de 100 serviços, analise **pelo menos 25** itens.
Para cada item selecionado, preencha 'itemId' e 'itemName' no JSON de saída e execute o PASSO 2.

**PASSO 2: Brainstorming e Análise Comparativa (Para CADA item selecionado):**
Para cada item selecionado no Passo 1:
1.  Mantenha a especificação original como a primeira opção ("Solução Atual").
2.  Gere **no mínimo duas (2)** alternativas técnicas.
    - Se houver mais de duas alternativas técnicas viáveis e comuns no mercado (ex: 3 ou 4), **VOCÊ DEVE INCLUÍ-LAS**. O objetivo é ser exaustivo.
3.  Preencha as colunas de análise para CADA opção (a atual e as alternativas), seguindo a lógica detalhada no PASSO 3.

**PASSO 3: Preenchimento das Colunas (Lógica Detalhada e Obrigatória):**
Para cada solução, você **DEVE OBRIGATÓRIAMENTE PREENCHER TODAS AS SEGUINTES PROPRIEDADES.** Não deixe nenhum campo em branco.

*   **Propriedade "solution":**
    *   **Lógica:** Crie um título curto e claro. Inclua especificações de produto entre parênteses.
*   **Propriedade "relativeCost":**
    *   **LÓGICA OBRIGATÓRIA:** **Pense como um Engenheiro de Custos.** Estime a variação percentual do custo total (material + mão de obra) da alternativa em relação à "Solução Atual". **VOCÊ DEVE FORNECER UMA ESTIMATIVA PERCENTUAL APROXIMADA.**
    *   **Formato da Resposta:** String, ex: "Linha de Base (0%)", "+40% (aprox.)", "-15% (aprox.)".
*   **Propriedade "deadlineImpact":**
    *   **LÓGICA OBRIGATÓRIA:** **Pense como um Engenheiro de Planejamento.** Estime o impacto no tempo de execução do serviço. **VOCÊ DEVE FORNECER UMA ESTIMATIVA PERCENTUAL APROXIMADA.**
    *   **Formato da Resposta:** String, ex: "Linha de Base (0%)", "-50% (aprox.)", "+30% (aprox.)".
*   **Propriedade "pros" (Vantagens):**
    *   **Lógica:** Liste em um array de strings [ ] os benefícios técnicos e práticos mais relevantes.
*   **Propriedade "cons" (Desvantagens):**
    *   **Lógica:** Liste em um array de strings [ ] os pontos negativos e os riscos técnicos. Seja específico (ex: "eleva o nível final do piso, exigindo ajustes em portas").
*   **Propriedade "recommendation" (Recomendação Técnica):**
    *   **LÓGICA OBRIGATÓRIA:** **Pense como um Consultor.** Sintetize sua análise em uma única frase conclusiva.
    *   **Formato da Resposta:** String, ex: "**Melhor custo-benefício** para...", "**Ideal se o prazo for crítico**...", "**Recomendado para durabilidade máxima**...".

**## 2.4. DIRETRIZES DE FORMATAÇÃO (REQUISITO TÉCNICO OBRIGATÓRIO):**
*   Responda APENAS com um único objeto JSON válido e completo.
*   NÃO inclua nenhum texto, explicação ou formatação markdown como \`\`\`json \`\`\` antes ou depois do objeto JSON.
*   **DIRETRIZ FINAL DE VALIDAÇÃO:** Antes de retornar sua resposta, revise o JSON para garantir que não há vírgulas sobrando (trailing commas) no final de listas ([...]) ou objetos ({...}). A validade do JSON é crítica para o funcionamento do sistema.
*   Siga ESTRITAMENTE a estrutura de \`types.ts\` abaixo:

**Formato de Saída JSON Obrigatório:**
{
  "valueEngineeringAnalysis": [
    {
      "itemId": "ID_DO_SERVICO_ANALISADO_DO_CONTEXTO",
      "itemName": "NOME_DO_SERVICO_ANALISADO_DO_CONTEXTO",
      "options": [
        {
          "solution": "Solução Atual: Tinta Acrílica Fosca (Linha Standard)",
          "relativeCost": "Linha de Base (0%)",
          "deadlineImpact": "Linha de Base (0%)",
          "pros": ["Melhor custo-benefício para o fornecimento.", "Ideal para áreas de baixo tráfego."],
          "cons": ["Menor resistência à limpeza e abrasão.", "Menor durabilidade."],
          "recommendation": "**Solução mais econômica** para ambientes com pouca circulação."
        },
        {
          "solution": "Alternativa 1: Tinta Acrílica Premium (Lavável)",
          "relativeCost": "+35% (aprox.)",
          "deadlineImpact": "0%",
          "pros": ["Altíssima durabilidade e resistência à limpeza.", "Excelente acabamento estético."],
          "cons": ["Custo do material significativamente mais elevado.", "Exige mão de obra mais qualificada."],
          "recommendation": "**Recomendado para durabilidade máxima** e áreas de grande circulação."
        },
        {
          "solution": "Alternativa 2: Tinta Epóxi Base Água",
          "relativeCost": "+60% (aprox.)",
          "deadlineImpact": "+10% (aprox.)",
          "pros": ["Resistência química superior.", "Acabamento de alta performance para áreas industriais ou molhadas."],
          "cons": ["Custo mais elevado.", "Aplicação mais técnica e demorada."],
          "recommendation": "**Solução obrigatória** para áreas com requisitos sanitários ou ataque químico."
        }
      ]
    }
  ]
}

**## 2.5. EXEMPLOS DE LÓGICA DE ALTERNATIVAS (USE COMO REFERÊNCIA DE RACIOCÍNIO):**
// ... (Exemplos omitidos para brevidade, mas estão no prompt)
    `;

    let rawText = ""; // Variável no escopo externo para guardar a resposta bruta para o catch

    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        
        rawText = response.text;

        // --- PASSO 2: LOG DE OUTPUT BRUTO ---
        console.log(`[${new Date().toISOString()}] --- DEBUG: RESPOSTA BRUTA DA IA ---`);
        console.log(rawText);
        console.log(`[${new Date().toISOString()}] --- FIM DA RESPOSTA BRUTA ---`);

        // --- PASSO 3: TENTATIVA DE PARSE ---
        console.log(`[${new Date().toISOString()}] Tentando JSON.parse()...`);

        const data = JSON.parse(rawText);
        console.log(`[${new Date().toISOString()}] --- DEBUG: JSON PARSEADO COM SUCESSO ---`);

        // Validação extra: O JSON é válido, mas o array está vazio?
        if (!data.valueEngineeringAnalysis || data.valueEngineeringAnalysis.length === 0) {
            console.warn(`[${new Date().toISOString()}] --- ALERTA: A IA retornou um JSON válido, mas com 'valueEngineeringAnalysis' VAZIO.`);
        }

        return data;

    } catch (error) {
        // --- PASSO 4: LOG DE FALHA DE PARSE (O PROVÁVEL CULPADO) ---
        console.error(`[${new Date().toISOString()}] --- ERRO CRÍTICO: FALHA NO JSON.PARSE() ---`);
        console.error("Erro de parse:", (error as Error).message);
        console.error(`[${new Date().toISOString()}] --- RESPOSTA BRUTA QUE CAUSOU A FALHA ---`);
        console.error(rawText); // Logamos o texto bruto que falhou
        console.error(`[${new Date().toISOString()}] --- FIM DA RESPOSTA BRUTA ---`);

        // Retorna vazio para não quebrar a UI, mas agora sabemos o *porquê*.
        return { valueEngineeringAnalysis: [] };
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