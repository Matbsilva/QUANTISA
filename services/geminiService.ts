

import { GoogleGenAI, GenerateContentResponse, Blob, Modality, type LiveServerMessage } from "@google/genai";
import type { Message, SearchResult, Service, Doubt, RefinementSuggestion, ValueEngineeringAnalysis, InternalQuery, ApprovalStatus, Composicao, Insumo, ComposicaoInsumo, ComposicaoMaoDeObra } from '../types';

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

export type ParsedComposicao = Omit<Composicao, 'id' | 'codigo'>;


export const parseCompositions = async (text: string): Promise<ParsedComposicao[]> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const prompt = `
**1.0 PERSONA E OBJETIVOS ESTRATÉGICOS**

Você atuará como um Engenheiro Civil Sênior e especialista em orçamentos que opera com uma Visão de Dono absoluta. Seu objetivo final é gerar inteligência de negócio para garantir propostas competitivas, maximizar a lucratividade e entregar valor e segurança ao cliente. Seus princípios de atuação são:

*   Busca pelo Custo-Benefício Ótimo: Seu foco é ser competitivo. Você deve sempre buscar a solução mais econômica possível, desde que ela respeite integralmente as normas técnicas e as recomendações dos fabricantes.
*   Foco Obsessivo em Mitigação de Riscos: Sua primeira prioridade é identificar e neutralizar qualquer risco (técnico, executivo, logístico ou de escopo) antes que ele se materialize em prejuízo, retrabalho ou atraso.
*   Consultor, Não Calculista: Você atua como um consultor técnico, explicando o "porquê" de cada decisão, sinalizando riscos e guiando para a melhor solução.

**2.0 TAREFA PRINCIPAL**

Sua função é receber um texto de entrada e seu objetivo principal é sempre retornar um array de objetos JSON perfeitamente estruturados no formato Composicao final definido na Seção 4.0.

**3.0 REGRAS DE ADAPTAÇÃO E PARSING (REVISADAS E REFORÇADAS)**

*   **3.1. Regra de Validação de Entrada (PRIORIDADE MÁXIMA):**
    *   Primeiro, analise o texto de entrada. Se o texto for manifestamente inválido (curto, aleatório, sem nenhuma palavra-chave como "custo", "material", "serviço", "m²", etc.), sua tarefa é parar imediatamente. Neste caso, gere uma notaDaImportacao com a mensagem de erro: 'Alerta: O texto fornecido não parece ser uma composição de serviço. Não foi possível extrair dados. Por favor, verifique o texto e tente novamente.' e retorne um objeto Composicao com campos vazios ou nulos. NÃO tente criar uma composição a partir de um texto sem sentido.

*   **3..2. Lógica de Processamento e Extração Completa:**
    *   Se a entrada for válida, prossiga. É mandatório que você tente extrair todas as 7 seções do padrão, se presentes.
    *   Se o texto de entrada já estiver no formato "Composição Padrão Quantisa", faça o parsing direto.
    *   Se o texto estiver em um formato desconhecido, ative seu modo de adaptação inteligente.

*   **3.3. Transparência e Sugestão de Código (Regras Obrigatórias):**
    *   **Seja Conciso na notaDaImportacao:** Foque em resumir as principais adaptações e nos alertas de maior risco.
    *   **Sugira o Código (OBRIGATÓRIO):** Analise o título e os insumos e, na notaDaImportacao, sugira um Grupo e um Subgrupo.
    *   **Preencha os Campos de Grupo/Subgrupo:** Os valores que você sugerir para Grupo e Subgrupo devem também ser usados para preencher os campos grupo e subgrupo no objeto Composicao principal.

*   **3.4. Formatação de Saída (REGRAS ESPECÍFICAS COM EXEMPLOS):**
    *   **Fontes e Referências (Seção 7.2):** Ao gerar o texto para o campo analiseEngenheiro.fontesReferencias, formate-o obrigatoriamente com quebras de linha (duplo \\n para criar um novo parágrafo) e negrito (**) em Markdown. O título de cada coeficiente deve estar em uma nova linha. Siga os exemplos abaixo rigorosamente:
        *   **Exemplo 1 (Contrapiso):**
            \`\`\`markdown
            **Coeficientes de Consumo:** Traço de argamassa baseado em tabelas de referência (TCPO). Consumo de aditivo baseado em ficha técnica (Vedacit).

            **Coeficientes de Produtividade:** Índice de 1,20 HH/m² mantido da composição original, considerado adequado por envolver duas etapas distintas.
            \`\`\`
        *   **Exemplo 2 (Alvenaria):**
            \`\`\`markdown
            **Coeficientes de Consumo:** Consumo de blocos conforme padrão de mercado (12,5 un/m²). Traços de argamassa e concreto baseados em TCPO.

            **Coeficientes de Produtividade:** Índice de 1,40 HH/m² mantido, considerado conservador e adequado à complexidade e ao risco do trabalho em altura.
            \`\`\`

    *   **Quadro de Produtividade (Seção 7.3):** Para o campo \`analiseEngenheiro.quadroProdutividade\`, formate **SEMPRE** a saída como uma tabela Markdown simples e válida.
        *   **REGRAS OBRIGATÓRIAS PARA A TABELA:**
            1.  **CONTEÚDO MÍNIMO:** A tabela DEVE conter, no mínimo, **duas (2) linhas de dados**: a primeira linha para o \`**Índice Adotado**\` e a segunda (e subsequentes) para **pelo menos uma referência de mercado** (ex: SINAPI, TCPO, ou outra fonte pertinente).
            2.  **COMPARAÇÃO É ESSENCIAL:** O objetivo principal deste quadro é a **comparação**. Se você não encontrar uma referência direta, use uma referência de um serviço similar e justifique na \`nota\` da Análise do Engenheiro.
            3.  **PROIBIÇÃO:** **NÃO GERE UMA TABELA COM APENAS UMA LINHA DE DADOS.** Isso é considerado uma falha crítica.
            4.  **FORMATAÇÃO:** Siga os exemplos abaixo **rigorosamente**. NUNCA retorne este campo como texto contínuo ou \`[Object Object]\`.

        *   **EXEMPLOS (SEGUIR ESTRUTURA):**
            *   Exemplo 1 (Alvenaria):
                \`\`\`markdown
                | Fonte de Referência | Produtividade (HH/m²) | Custo M.O. (R$/m²) | Variação vs. Adotado |
                | :--- | :--- | :--- | :--- |
                | **Índice Adotado (Total)** | **1,40** | **R$ 43,75** | **-** |
                | SINAPI (Cód. 87282) | 0,71 | R$ 22,19 | -49,29% |
                \`\`\`
            *   Exemplo 2 (Impermeabilização):
                \`\`\`markdown
                | Fonte de Referência | Produtividade (HH/m²) | Custo M.O. (R$/m²) | Variação vs. Adotado |
                | :--- | :--- | :--- | :--- |
                | **Índice Adotado (Profis.+Ajud.)** | **0,87** | **R$ 27,45** | **-** |
                | TCPO (Ref. 04.30.20.15) | 0,75 | R$ 23,44 | -14,62% |
                \`\`\`

**4.0 ESTRUTURA DE DADOS ALVO (JSON de Saída)**

Sua saída deve aderir estritamente à seguinte estrutura TypeScript. Sempre retorne um array \`[]\`, mesmo que ele contenha apenas um único objeto.

\`\`\`typescript
export interface ComposicaoInsumo {
  item: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  pesoUnitario?: number;
  pesoTotal?: number;
}
export interface ComposicaoMaoDeObra {
  funcao: string;
  hhPorUnidade: number;
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
    funcao: string;
    hhPorUnidade: number;
    hhTotal: number;
}
export interface ComposicaoIndicadores {
  custoMateriais_porUnidade: number;
  custoEquipamentos_porUnidade: number;
  custoMaoDeObra_porUnidade: number;
  custoDiretoTotal_porUnidade: number;
  custoMateriais_total: number;
  custoEquipamentos_total: number;
  custoMaoDeObra_total: number;
  custoDiretoTotal_total: number;
  maoDeObraDetalhada: ComposicaoIndicadorMaoDeObra[];
  pesoMateriais_porUnidade: number;
  pesoMateriais_total: number;
  volumeEntulho_porUnidade: number;
  volumeEntulho_total: number;
}
export interface Composicao {
  codigo: string;
  titulo: string;
  unidade: string;
  quantidadeReferencia: number;
  grupo: string;
  subgrupo: string;
  tags: string[];
  classificacaoInterna: string;
  premissas: { escopo: string; metodo: string; incluso: string; naoIncluso: string; };
  insumos: { materiais: ComposicaoInsumo[]; equipamentos: ComposicaoInsumo[]; };
  maoDeObra: ComposicaoMaoDeObra[];
  quantitativosConsolidados: {
      listaCompraMateriais: ComposicaoListaCompraItem[];
      necessidadeEquipamentos: any[];
      quadroMaoDeObraTotal: any[];
  };
  indicadores: ComposicaoIndicadores;
  guias: { dicasExecucao: string; alertasSeguranca: string; criteriosQualidade: string; };
  analiseEngenheiro: {
    nota: string;
    fontesReferencias: string;
    quadroProdutividade: string;
    analiseRecomendacao: string;
    notaDaImportacao?: string;
  };
}
\`\`\`

**5.0 SAÍDA**

Sua resposta final deve ser um array de objetos \`Composicao\` bem-formado, pronto para ser validado pelo usuário. Não inclua nenhum texto ou explicação adicional fora da estrutura JSON solicitada.
    `;

    const fullPrompt = `${prompt}\n\n---\nTexto para Análise:\n---\n${text}`;

    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        
        let textToParse = response.text;
        
        const parsedData = JSON.parse(textToParse);
        
        // Enhanced validation
        if (Array.isArray(parsedData)) {
            return parsedData;
        }

        // Handle case where AI returns a single object instead of an array of one
        if (typeof parsedData === 'object' && parsedData !== null && 'titulo' in parsedData) {
            return [parsedData];
        }

        // Handle case where AI wraps the array in an object, e.g. { "key": [...] }
        if (typeof parsedData === 'object' && parsedData !== null) {
            const keys = Object.keys(parsedData);
            if (keys.length > 0 && Array.isArray(parsedData[keys[0]])) {
                return parsedData[keys[0]];
            }
        }

        throw new Error("A IA não retornou um array de composições no formato esperado.");

    } catch (error) {
        console.error("Erro ao processar composições:", error);
        throw new Error("Não foi possível interpretar o texto da composição. Verifique o formato e tente novamente.");
    }
};

export const reviseParsedComposition = async (composition: ParsedComposicao, instruction: string): Promise<ParsedComposicao> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const prompt = `
        **PERSONA:** Você é um assistente de IA especialista em correção de dados estruturados.
        
        **AÇÃO:** Sua tarefa é revisar um objeto JSON de composição de serviço que foi parseado incorretamente, usando as instruções do usuário para corrigi-lo. Retorne APENAS o objeto JSON corrigido.

        **CONTEXTO:**
        - **JSON Incorreto:** ${JSON.stringify(composition)}
        - **Instruções de Correção do Usuário:** "${instruction}"

        **FORMATO DE SAÍDA OBRIGATÓRIO:**
        Retorne APENAS o objeto JSON corrigido. Não adicione nenhum texto, explicação ou formatação markdown como \`\`\`json \`\`\` antes ou depois do objeto JSON. Sua resposta deve ser diretamente parseável.
    `;

    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            // FIX: Simplified 'contents' from [{ parts: [{ text: prompt }], role: 'user' }] to just prompt string for single-turn text.
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        let textToParse = response.text;
        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        const match = textToParse.match(jsonRegex);
        if (match && match[1]) {
            textToParse = match[1];
        }

        const parsedData: ParsedComposicao = JSON.parse(textToParse);
        
        // Basic validation
        if (!parsedData.titulo) {
             throw new Error("A IA retornou um objeto de composição inválido.");
        }

        return parsedData;

    } catch (error) {
        console.error("Erro ao revisar composição:", error);
        throw new Error("Não foi possível aplicar a correção na composição.");
    }
}

export interface BatchRelevanceResult {
  idNovaComposicao: string; // ID temporário da composição importada
  candidatos: {
    idExistente: string;     // ID da composição existente que é similar
    titulo: string;          // Título da composição existente
    escopoResumido: string;  // Resumo do escopo da composição existente
    relevanciaScore: number; // Score de 0 a 100
    motivo: string;          // Breve explicação da IA
  }[];
}


export const findRelevantCompositionsInBatch = async (newCompositions: (ParsedComposicao & { id: string })[], existingCompositions: Composicao[]): Promise<BatchRelevanceResult[]> => {
    const aiInstance = getAiInstance();
    if (!aiInstance || newCompositions.length === 0) {
        return newCompositions.map(c => ({ idNovaComposicao: c.id, candidatos: [] }));
    }
     if (existingCompositions.length === 0) {
        return newCompositions.map(c => ({ idNovaComposicao: c.id, candidatos: [] }));
    }

    const newCompositionsForPrompt = newCompositions.map(c => ({ id: c.id, titulo: c.titulo }));
    const existingCompositionsForPrompt = existingCompositions.map(c => ({ id: c.id, titulo: c.titulo, escopo: c.premissas.escopo }));


    const prompt = `
**1.0 PERSONA E OBJETIVO ESTRATÉGICO**
Você atuará com uma persona híbrida e de alta especialização: um **Engenheiro de Custos Sênior com "Visão de Dono"** que também é um **Analista de Dados Sênior**, focado em saneamento e normalização de bancos de dados de engenharia. Seus princípios são:
*   **Precisão do Engenheiro:** Você entende o contexto de uma obra. Sua análise vai além do texto e considera a aplicabilidade prática. Erros de especificação (ex: tipo de cimento, resistência de concreto) são inaceitáveis.
*   **Rigor do Analista:** Você aplica técnicas de "Entity Resolution" de forma sistemática para identificar duplicatas semânticas, ignorando ruídos de formatação e sintaxe.
*   **Eficiência de Escala:** Sua missão é processar lotes de dados de forma rápida e precisa, fornecendo um resultado claro e acionável.
Seu objetivo final é ser a principal linha de defesa contra a poluição de dados em um sistema de orçamentação, garantindo que a base de composições seja íntegra, confiável e livre de duplicatas.

**2.0 TAREFA**
Você receberá um lote de "Novas Composições" e uma lista de "Composições Existentes". Para CADA nova composição, sua tarefa é encontrar as 5 composições existentes mais relevantes, ordená-las por relevância, e retornar os resultados em uma estrutura JSON consolidada. Para cada candidato, você deve incluir o texto COMPLETO do seu campo de escopo.

**3.0 DADOS DE ENTRADA (Exemplo de formato que você receberá)**
\`\`\`json
{
  "newCompositions": [
    { "id": "temp-1", "titulo": "Contrapiso c/ argamassa pronta (e=4cm)" },
    { "id": "temp-2", "titulo": "Demolição de parede de alvenaria" }
  ],
  "existingCompositions": [
    { "id": "db-101", "titulo": "Execução de Contrapiso (e=4cm) sobre Enchimento", "escopo": "Execução de contrapiso com argamassa industrializada para nivelamento de base, com espessura final de 4cm, sobre camada de enchimento leve existente. Não inclui a preparação da base." },
    { "id": "db-102", "titulo": "Enchimento Leve de Piso - EPS 10cm + Contrapiso 5cm", "escopo": "Sistema completo de regularização de piso, incluindo camada de 10cm de EPS e posterior contrapiso de 5cm de espessura." },
    { "id": "db-103", "titulo": "Demolição Manual de Alvenaria de Tijolos", "escopo": "Demolição manual de paredes de alvenaria de vedação com tijolos cerâmicos, sem aproveitamento. Inclui a remoção do material para área de descarte." }
  ]
}
\`\`\`

**4.0 REGRAS DE ANÁLISE DE RELEVÂNCIA (SEGUIR COM RIGOR)**
*   **Pré-Filtro de Categoria:** Primeiro, identifique a categoria principal do serviço (ex: Contrapiso, Alvenaria, Demolição). Compare apenas composições da mesma categoria para evitar resultados absurdos.
*   **Análise Semântica:** Dê alta relevância para títulos que compartilham especificações técnicas chave (espessuras, materiais, métodos). A ordem das palavras não importa.
*   **Penalização por Conflito Técnico:** Se dois títulos são semanticamente similares mas possuem uma especificação técnica **conflitante** (ex: "Contrapiso 4cm" vs "Contrapiso 5cm"), o score deve ser **significativamente reduzido**. Eles são relacionados, mas não são substitutos diretos.
*   **Score:** Atribua um \`relevanciaScore\` de 0 a 100.
*   **Motivo:** Forneça uma explicação curta e objetiva para cada candidato, justificando o score e comparando os pontos-chave. Ex: "Mesmo serviço (sóculo), mas material diferente (Bloco de Concreto vs. Bloco Cerâmico) e altura conflitante (15cm vs 19cm)."

**5.0 SAÍDA ESPERADA (Formato JSON OBRIGATÓRIO)**
Retorne um objeto JSON contendo uma chave "resultados" que é um array de objetos, um para cada nova composição analisada. Se para uma nova composição nenhum candidato for encontrado, retorne um array vazio de candidatos para ela.

\`\`\`json
{
  "resultados": [
    {
      "idNovaComposicao": "temp-1",
      "candidatos": [
        { "idExistente": "db-101", "titulo": "Execução de Contrapiso (e=4cm) sobre Enchimento", "escopoResumido": "Execução de contrapiso com argamassa industrializada para nivelamento de base, com espessura final de 4cm, sobre camada de enchimento leve existente. Não inclui a preparação da base.", "relevanciaScore": 98, "motivo": "Mesmo serviço e espessura (4cm)." },
        { "idExistente": "db-102", "titulo": "Enchimento Leve de Piso - EPS 10cm + Contrapiso 5cm", "escopoResumido": "Sistema completo de regularização de piso, incluindo camada de 10cm de EPS e posterior contrapiso de 5cm de espessura.", "relevanciaScore": 75, "motivo": "Serviço relacionado, mas com espessura (5cm vs 4cm) e método diferentes." }
      ]
    },
    {
      "idNovaComposicao": "temp-2",
      "candidatos": [
        { "idExistente": "db-103", "titulo": "Demolição Manual de Alvenaria de Tijolos", "escopoResumido": "Demolição manual de paredes de alvenaria de vedação com tijolos cerâmicos, sem aproveitamento. Inclui a remoção do material para área de descarte.", "relevanciaScore": 95, "motivo": "Mesmo serviço de demolição de alvenaria." }
      ]
    }
  ]
}
\`\`\`
    `;
    
    const payload = {
        newCompositions: newCompositionsForPrompt,
        existingCompositions: existingCompositionsForPrompt,
    };

    const fullPrompt = `${prompt}\n\n---\nEntrada JSON:\n---\n${JSON.stringify(payload, null, 2)}`;
    
     try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        const textToParse = response.text;
        const parsedData = JSON.parse(textToParse);

        if (parsedData && Array.isArray(parsedData.resultados)) {
            // Fallback for escopoResumido if AI fails to provide it
            return parsedData.resultados.map((res: any) => ({
                ...res,
                candidatos: res.candidatos.map((cand: any) => ({
                    ...cand,
                    escopoResumido: cand.escopoResumido || "Não foi possível extrair o escopo."
                }))
            }));
        }

        return newCompositions.map(c => ({ idNovaComposicao: c.id, candidatos: [] }));

    } catch (error) {
        console.error("Erro ao buscar composições relevantes em lote:", error);
        return newCompositions.map(c => ({ idNovaComposicao: c.id, candidatos: [] }));
    }
}

export const exportCompositionToMarkdown = (composition: Composicao): string => {
    let markdown = ``;

    const createTable = (headers: string[], rows: (string|number)[][]) => {
        if (rows.length === 0) return 'N/A\n';
        let table = `| ${headers.join(' | ')} |\n`;
        table += `|${headers.map(() => ' :--- ').join('|')}|\n`;
        rows.forEach(row => {
            table += `| ${row.join(' | ')} |\n`;
        });
        return table;
    };

    markdown += `# 1.0 METADADOS\n`;
    markdown += `**Título:** ${composition.titulo || ''}\n`;
    markdown += `**Unidade:** ${composition.unidade || ''}\n`;
    markdown += `**Quantidade de Referência:** ${composition.quantidadeReferencia || 1}\n\n`;

    markdown += `# 2.0 PREMISSAS TÉCNICAS E DE ESCOPO\n`;
    markdown += `**Escopo:** ${composition.premissas?.escopo || ''}\n`;
    markdown += `**Método:** ${composition.premissas?.metodo || ''}\n`;
    markdown += `**Incluso:** ${composition.premissas?.incluso || ''}\n`;
    markdown += `**Não Incluso:** ${composition.premissas?.naoIncluso || ''}\n\n`;

    markdown += `# 3.0 LISTA DE INSUMOS E MÃO DE OBRA (para 1,00 ${composition.unidade})\n\n`;
    
    markdown += `## 3.1 Materiais\n`;
    const materialRows = composition.insumos?.materiais?.map(i => [i.item, i.unidade, i.quantidade.toFixed(4), i.valorUnitario.toFixed(2), i.valorTotal.toFixed(2)]) || [];
    markdown += createTable(['Item', 'Un.', 'Qtd.', 'V.U.', 'V.T.'], materialRows) + '\n';
    
    markdown += `## 3.2 Equipamentos\n`;
    const equipRows = composition.insumos?.equipamentos?.map(i => [i.item, i.unidade, i.quantidade.toFixed(4), i.valorUnitario.toFixed(2), i.valorTotal.toFixed(2)]) || [];
    markdown += createTable(['Item', 'Un.', 'Qtd.', 'V.U.', 'V.T.'], equipRows) + '\n';

    markdown += `## 3.3 Mão de Obra\n`;
    const moRows = (composition.maoDeObra || []).map(mo => [mo.funcao, mo.hhPorUnidade.toFixed(4), mo.custoUnitario.toFixed(2), mo.custoTotal.toFixed(2)]);
    markdown += createTable(['Função', 'HH/Unidade', 'Custo Unit.', 'Custo Total'], moRows) + '\n\n';

    markdown += `# 4.0 GUIAS, SEGURANÇA E QUALIDADE\n`;
    markdown += `**Dicas de Execução:** ${composition.guias?.dicasExecucao || ''}\n`;
    markdown += `**Alertas de Segurança:** ${composition.guias?.alertasSeguranca || ''}\n`;
    markdown += `**Critérios de Qualidade:** ${composition.guias?.criteriosQualidade || ''}\n\n`;

    markdown += `# 5.0 ANÁLISE TÉCNICA DO ENGENHEIRO\n`;
    markdown += `**Nota:** ${composition.analiseEngenheiro?.nota || ''}\n\n`;
    markdown += `**Fontes e Referências:**\n${composition.analiseEngenheiro?.fontesReferencias || ''}\n\n`;
    markdown += `**Quadro de Produtividade:**\n${composition.analiseEngenheiro?.quadroProdutividade || ''}\n\n`;
    markdown += `**Análise e Recomendação:** ${composition.analiseEngenheiro?.analiseRecomendacao || ''}\n`;

    return markdown;
};

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
    - Se hover 91 a 100 serviços, analise **pelo menos 21** itens.
    - Se houver mais de 100 serviços, analise **pelo menos 25** itens.
Para cada item selecionado, preencha 'itemId' e 'itemName' no JSON de saída e execute o PASSO 2.

**PASSO 2: Brainstorming e Análise Comparativa (Para CADA item selecionado):**
Para cada item selecionado no Passo 1:
1.  Mantenha a especificação original como a primeira opção ("Solução Atual").
2.  Gere **no mínimo duas (2)** alternativas técnicas.
    - Se houver mais de duas alternativas técnicas viáveis e comuns no mercado (ex: 3 ou 4), **VOCÊ DEVE INCLUÍ-LAS**. O objetivo é ser exaustivo.
3.  Preencha as colunas de análise para CADA opção (a atual e as alternativas), seguindo a lógica detalhada no PASSO 3.

**PASSO 3: Preenchimento das Colunas (Lógica Detalhada e Obrigatória):**
Para cada solução, você **DEVE OBRIGATÓAMENTE PREENCHER TODAS AS SEGUINTES PROPRIEDADES.** Não deixe nenhum campo em branco.

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
                // FIX: Corrected model name from 'gemini-25-flash...' to 'gemini-2.5-flash...'
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

export const parseInsumos = async (text: string): Promise<Partial<Insumo>[]> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const prompt = `
// NOVO PROMPT V2.0 PARA parseInsumos - Foco na Unidade de Compra

**1.0 PERSONA E OBJETIVOS ESTRATÉGICOS**

Você atuará como um Engenheiro Civil Sênior e especialista em orçamentos que opera com uma Visão de Dono absoluta. Seu objetivo final é gerar dados estruturados e precisos para um catálogo de insumos, refletindo exatamente como os produtos são **COMPRADOS** no mercado. Seus princípios são:

*   **Precisão de Compra:** O custo do insumo deve refletir sua unidade de comercialização (saco, lata, rolo, barra, etc.).
*   **Clareza para o Orçamentista:** O nome do insumo deve ser padronizado para evitar ambiguidades.
*   **Mitigação de Riscos:** Dados ambíguos são um risco. Sua função é clarificar a informação.

**2.0 TAREFA PRINCIPAL**

Sua tarefa é receber um texto de entrada contendo uma lista de insumos e retornar um array de objetos JSON perfeitamente estruturados, com **ESTRITAMENTE UM objeto por linha de insumo**, aderindo às regras de inteligência abaixo.

**3.0 REGRAS DE INTELIGÊNCIA E PARSING (OBRIGATÓRIAS)**

*   **3.1. Parsing Flexível:** O texto de entrada pode ser mal formatado. Tente extrair os dados (\`Nome\`, \`Unidade\`, \`Custo\`).
*   **3.2. Foco Exclusivo na Unidade de Compra:** Ignore qualquer cálculo de unidade de consumo. A \`unidade\` extraída deve ser a unidade de comercialização (ex: "un", "saco", "lata", "rolo", "m", "kg", "m³"). **NÃO GERE MAIS DE UM REGISTRO POR LINHA.**
*   **3.3. Normalização de Nomes (REGRA ESSENCIAL):** Para garantir a consistência, **SEMPRE** normalize o nome do insumo para o formato: \`[Nome Base do Produto] ([Detalhe da Embalagem/Especificação])\`.
    *   **Exemplo 1:** Entrada \`Cimento saco 50kg\` deve ser normalizada para \`Cimento (Saco 50kg)\`.
    *   **Exemplo 2:** Entrada \`Tinta Acrílica Branca 18L\` deve ser \`Tinta Acrílica Branca (Lata 18L)\`.
*   **3.4. Extração de Dados Adicionais:**
    *   **Marca:** Se o nome do item contiver uma marca clara (ex: "Viaplus 7000", "Massa Acrílica (Suvinil)"), extraia-a para o campo \`marca\`.
*   **3.5. Inferência de Tipo:** Classifique o \`tipo\` do insumo com base em palavras-chave: 'HH', 'Profissional' -> \`'MaoObra'\`; 'Locação', 'Caminhão' -> \`'Equipamento'\`; Todos os outros -> \`'Material'\`.
*   **3.6. Tratamento de Erros:** Se uma linha for completamente ininteligível, ignore-a.

**4.0 ESTRUTURA DE DADOS ALVO E SAÍDA**
Sua saída deve ser um array \`[]\` de objetos que sigam esta interface. Não inclua nenhum texto ou explicação fora da estrutura JSON.
\`\`\`typescript
export interface Insumo {
  id: string; // Gerar um ID temporário, ex: "temp-1", "temp-2"
  nome: string;
  unidade: string;
  custo: number;
  tipo: 'Material' | 'MaoObra' | 'Equipamento';
  marca?: string;
  observacao?: string;
}
\`\`\`
**5.0 SAÍDA**
Retorne APENAS o array de objetos JSON.
`;

    const fullPrompt = `${prompt}\n\n---\nTexto para Análise:\n---\n${text}`;

    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
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

        const parsedData = JSON.parse(textToParse);
        if (Array.isArray(parsedData)) {
            return parsedData;
        }
        throw new Error("A IA não retornou um array de insumos.");

    } catch (error) {
        console.error("Erro ao processar insumos:", error);
        throw new Error("Não foi possível interpretar o texto dos insumos. Verifique o formato e tente novamente.");
    }
};

export interface BatchSimilarityResult {
  newInsumoId: string;
  existingInsumoId: string;
  similarityScore: number;
  reasoning: string;
}

export const findSimilarInsumosInBatch = async (newInsumos: Partial<Insumo>[], existingInsumos: Insumo[]): Promise<BatchSimilarityResult[]> => {
    const aiInstance = getAiInstance();
    if (!aiInstance || newInsumos.length === 0 || existingInsumos.length === 0) {
        return [];
    }
    
    // Map to simple objects for the prompt to keep it clean
    const newInsumosForPrompt = newInsumos.map(i => ({ id: i.id, nome: i.nome }));
    const existingInsumosForPrompt = existingInsumos.map(i => ({ id: i.id, nome: i.nome }));

    const prompt = `// PROMPT MESTRE V2.5 - Comparação em Lote (com Trava Flexibilizada)

**1.0 PERSONA E OBJETIVO ESTRATÉGICO**
Você atuará com uma persona híbrida e de alta especialização: um **Engenheiro Civil Sênior com "Visão de Dono"** que também é um **Analista de Dados Sênior**, focado em saneamento e normalização de bancos de dados. Seus princípios são:
*   **Precisão do Engenheiro:** Você entende o contexto de uma obra. Sua análise vai além do texto e considera a aplicabilidade prática do insumo. Erros de especificação (ex: bitola de fio, tipo de cimento) são inaceitáveis.
*   **Rigor do Analista:** Você aplica técnicas de "Entity Resolution" de forma sistemática para identificar duplicatas semânticas, ignorando ruídos de formatação e sintaxe.
*   **Eficiência de Escala:** Sua missão é processar lotes de dados de forma rápida e precisa, fornecendo um resultado claro e acionável.
Seu objetivo final é ser a principal linha de defesa contra a poluição de dados em um sistema de orçamentação, garantindo que a base de insumos seja íntegra, confiável e livre de duplicatas.


**2.0 TAREFA PRINCIPAL**
Você receberá um objeto JSON contendo duas chaves: \`newInsumos\` e \`existingInsumos\`. Sua tarefa é comparar CADA item da lista \`newInsumos\` com TODOS os itens da lista \`existingInsumos\`. No final, você deve retornar um array de objetos JSON contendo **APENAS OS PARES** que você considera semanticamente similares (com um score de similaridade >= 85).


**3.0 REGRAS DE ANÁLISE (Combinando Visão de Engenharia e Análise de Dados)**

*   **3.1. Pré-Filtro de Categoria de Produto (NOVA VERSÃO REFINADA - TRAVA DE SEGURANÇA):** Antes de realizar uma comparação detalhada, avalie se os dois insumos pertencem à mesma **categoria fundamental de produto**. A sua primeira tarefa é identificar o substantivo principal que define o item (ex: Cimento, Vergalhão, Tinta, Cabo, Argamassa). Se os substantivos principais forem claramente diferentes, considere a similaridade como 0. **O objetivo desta regra é APENAS evitar comparações absurdas (ex: "Areia" vs. "Cimento").** Se os itens pertencerem à mesma categoria (ex: dois tipos de cimento, duas bitolas de cabo), você DEVE prosseguir com a análise detalhada usando as regras abaixo.
*   **3.2. Foco no Significado, Não na Sintaxe:** Ignore diferenças de maiúsculas/minúsculas, acentuação, caracteres especiais (parênteses, hífens) e a ordem das palavras descritivas.
*   **3.3. Equivalência de Unidades:** Trate sinônimos e abreviações de unidades como idênticos (ex: 'kg'='quilo', 'L'='Litro', 'm'='metro').
*   **3.4. Equivalência de Especificações Técnicas:** Reconheça e trate sinônimos técnicos comuns na construção civil como idênticos. **Exemplos críticos: '10mm' = '3/8"', '12.5mm' = '1/2"', '100mm' = 'DN100'**.
*   **3.5. Comparação Crítica de Quantidade/Volume:** A especificação de quantidade é crucial. "Saco 50kg" e "(50 kg)" são idênticos. No entanto, "Lata 18L" vs "Galão 3.6L" são **produtos de compra diferentes**.
*   **3.6. Ponderação de Conflitos Técnicos:** Esta é a regra mais importante para a precisão do score. Se dois insumos possuem uma especificação técnica crucial (bitola, dimensão, tipo, etc.) que **conflita diretamente** (ex: \`2,5mm²\` vs. \`4,0mm²\`; \`CPII\` vs. \`CPV\`), você deve aplicar uma **penalização severa ao score final**. O score não deve ser zerado, mas deve ser significativamente reduzido para refletir que, embora o produto base seja similar, eles não são intercambiáveis. Um score final para esses casos deveria ficar, idealmente, **entre 60 e 80**, sinalizando alta similaridade contextual mas uma diferença crítica que impede a fusão automática.

**4.0 ESTRUTURA DE DADOS ALVO E SAÍDA**
Sua saída deve ser APENAS o objeto JSON, sem nenhum texto ou explicação adicional.
\`\`\`json
{
  "similarityScore": <number>,
  "isSimilar": <boolean>,
  "reasoning": "<string>"
}
\`\`\`
`;
    
    const payload = {
        newInsumos: newInsumosForPrompt,
        existingInsumos: existingInsumosForPrompt,
    };

    const fullPrompt = `${prompt}\n\n---\nEntrada JSON:\n---\n${JSON.stringify(payload, null, 2)}`;

    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        
        const textToParse = response.text;
        const parsedData: BatchSimilarityResult[] = JSON.parse(textToParse);

        if (Array.isArray(parsedData)) {
            return parsedData;
        }
        
        return [];

    } catch (error) {
        console.error("Erro ao calcular similaridade de insumos em lote:", error);
        // Do not throw, return empty array to allow the flow to continue
        // The calling function will handle showing a toast message.
        return [];
    }
};