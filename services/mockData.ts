

import { Project, Priority, KanbanStatus, Insumo, Composicao } from '../types';

export const mockProjects: Project[] = [
    {
        id: 'proj-1',
        nome: 'Reforma Apto 302',
        cliente: 'Família Silva',
        data_entrada: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString().split('T')[0],
        data_limite: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString().split('T')[0],
        prioridade: Priority.High,
        status: KanbanStatus.InProgress,
        resumo_tecnico: 'Reforma completa de apartamento, incluindo pintura, elétrica e acabamentos.',
        initialAnalysis: 'Análise do escopo indica necessidade de demolição, construção de alvenaria, instalações elétricas e hidráulicas, além de acabamentos como pintura e instalação de piso.',
        services: [
            { id: 'serv-1', nome: 'Demolição de alvenaria', quantidade: 25, unidade: 'm²' },
            { id: 'serv-2', nome: 'Instalação de ponto elétrico', quantidade: 15, unidade: 'un' },
            { id: 'serv-3', nome: 'Pintura acrílica em paredes', quantidade: 120, unidade: 'm²' },
        ],
        doubts: [
            { id: 'dbt-1', question: 'A pintura será em superfície nova ou requer preparação (remoção de pintura antiga, correção de imperfeições)?' },
            { id: 'dbt-2', question: 'Qual o padrão de acabamento para os pontos elétricos (ex: linha Pial Plus, Tramontina Liz)?' },
            { id: 'dbt-3', question: 'A demolição inclui a remoção de entulho do local?' }
        ]
    },
    {
        id: 'proj-2',
        nome: 'Pintura Fachada Condomínio Sol',
        cliente: 'Condomínio Sol Nascente',
        data_entrada: new Date(new Date().setDate(new Date().getDate() - 5)).toISOString().split('T')[0],
        data_limite: new Date(new Date().setDate(new Date().getDate() + 12)).toISOString().split('T')[0],
        prioridade: Priority.Medium,
        status: KanbanStatus.InProgress,
        resumo_tecnico: 'Pintura externa de 2 torres, com tratamento de fissuras e aplicação de selador.'
    },
    {
        id: 'proj-3',
        nome: 'Instalação Elétrica Loja Centro',
        cliente: 'Varejo Moderno Ltda',
        data_entrada: new Date().toISOString().split('T')[0],
        data_limite: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString().split('T')[0],
        prioridade: Priority.High,
        status: KanbanStatus.Backlog,
        resumo_tecnico: 'Projeto elétrico completo para nova loja comercial, incluindo luminotécnica.'
    },
    {
        id: 'proj-4',
        nome: 'Construção Edícula Gourmet',
        cliente: 'Carlos Pereira',
        data_entrada: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0],
        data_limite: new Date(new Date().setDate(new Date().getDate() + 8)).toISOString().split('T')[0],
        prioridade: Priority.Low,
        status: KanbanStatus.Backlog,
        resumo_tecnico: 'Construção de área de lazer com churrasqueira, forno a lenha e bancada.'
    },
    {
        id: 'proj-5',
        nome: 'Manutenção Telhado Galpão Industrial',
        cliente: 'Logística Total S.A.',
        data_entrada: new Date(new Date().setDate(new Date().getDate() - 15)).toISOString().split('T')[0],
        data_limite: new Date(new Date().setDate(new Date().getDate() - 5)).toISOString().split('T')[0],
        prioridade: Priority.Medium,
        status: KanbanStatus.Sent,
        resumo_tecnico: 'Reparo de vazamentos, substituição de telhas danificadas e limpeza de calhas.',
        data_envio: new Date(new Date().setDate(new Date().getDate() - 3))
    },
     {
        id: 'proj-6',
        nome: 'Consultoria de Custos',
        cliente: 'Inovatech Engenharia',
        data_entrada: new Date(new Date().setDate(new Date().getDate() - 20)).toISOString().split('T')[0],
        data_limite: new Date(new Date().setDate(new Date().getDate() - 10)).toISOString().split('T')[0],
        prioridade: Priority.Low,
        status: KanbanStatus.Approved,
        resumo_tecnico: 'Análise e otimização de planilha orçamentária para licitação pública.'
    },
    {
        id: 'proj-7',
        nome: 'Orçamento Finalizado Cobertura',
        cliente: 'Construtora Principal',
        data_entrada: new Date(new Date().setDate(new Date().getDate() - 10)).toISOString().split('T')[0],
        data_limite: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0],
        prioridade: Priority.High,
        status: KanbanStatus.ReadyToSend,
        resumo_tecnico: 'Orçamento completo para impermeabilização de cobertura. Todos os 5 passos concluídos.'
    },
    {
        id: 'proj-8',
        nome: 'Revisão de Proposta',
        cliente: 'Startup Construtech',
        data_entrada: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        data_limite: new Date(new Date().setDate(new Date().getDate() - 20)).toISOString().split('T')[0],
        prioridade: Priority.Medium,
        status: KanbanStatus.Waiting,
        resumo_tecnico: 'Aguardando feedback do cliente sobre a proposta enviada há mais de uma semana.',
        data_envio: new Date(new Date().setDate(new Date().getDate() - 15)), // Older than 14 days
        returns: [
            { id: 'ret-1', date: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(), notes: 'Cliente solicitou revisão dos custos de acabamento.'}
        ]
    },
];

const createInsumo = (id: string, nome: string, unidade: string, custo: number, tipo: Insumo['tipo']): Insumo => ({
    id,
    nome,
    unidade,
    custo,
    tipo,
    priceHistory: [{ date: new Date().toISOString(), cost: custo }]
});

export const mockInsumos: Insumo[] = [
    // Tabela 1: Custos de Mão de Obra
    createInsumo('ins-1', 'Profissional (qualquer especialidade)', 'HH', 40.00, 'MaoObra'),
    createInsumo('ins-2', 'Ajudante (Servente)', 'HH', 22.50, 'MaoObra'),
    createInsumo('ins-3', 'Técnico / Engenheiro para Teste', 'HH', 90.00, 'MaoObra'),
    // Tabela 2: Custos de Materiais
    createInsumo('ins-4', 'Abraçadeira tipo "D" 3/4" com cunha', 'un', 2.50, 'Material'),
    createInsumo('ins-5', 'Adesivo Estrutural Epóxi', 'kit (1kg)', 103.50, 'Material'),
    createInsumo('ins-6', 'Aditivo (Bianco ou similar)', 'L', 25.50, 'Material'),
    createInsumo('ins-7', 'Aditivo para Argamassa CCA', 'L', 23.75, 'Material'),
    createInsumo('ins-8', 'Álcool Isopropílico', 'frasco (1L)', 31.50, 'Material'),
    createInsumo('ins-9', 'Arco de Serra Manual 12"', 'un', 25.00, 'Material'),
    createInsumo('ins-10', 'Argamassa Colante AC-II', 'kg', 1.30, 'Material'),
    createInsumo('ins-11', 'Argamassa Colante ACIII', 'kg', 1.90, 'Material'),
    createInsumo('ins-12', 'Argamassa Pronta Matrix 4201 Contrapiso', 'saco (40kg)', 28.00, 'Material'),
    createInsumo('ins-13', 'Areia Fina', 'saco (20kg)', 6.00, 'Material'),
    createInsumo('ins-14', 'Areia Média', 'saco (20kg)', 5.50, 'Material'),
    createInsumo('ins-15', 'Asfalto a Frio', 'saco (25kg)', 62.00, 'Material'),
    createInsumo('ins-16', 'Bandeja para pintura pequena', 'un', 6.00, 'Material'),
    createInsumo('ins-17', 'BGS (Brita Graduada Simples)', 'm³', 143.33, 'Material'),
    createInsumo('ins-18', 'Bloco Cerâmico 14x19x29cm', 'un', 2.73, 'Material'),
    createInsumo('ins-19', 'Bloco de Concreto 14x19x39cm', 'un', 4.55, 'Material'),
    createInsumo('ins-20', 'Bloco de Concreto 19x19x39cm', 'un', 4.73, 'Material'),
    createInsumo('ins-21', 'Bloco de Concreto Celular (CCA) 60x30x10cm', 'un', 26.33, 'Material'),
    createInsumo('ins-22', 'Brita 1', 'saco (20kg)', 6.50, 'Material'),
    createInsumo('ins-23', 'Cabos Elétricos 2,5mm² (Flexível, F+N+T)', 'm', 6.83, 'Material'),
    createInsumo('ins-24', 'Cimento (50 kg)', 'saco', 33.87, 'Material'),
    createInsumo('ins-25', 'Conector para Sealtube 3/4"', 'un', 5.50, 'Material'),
    createInsumo('ins-26', 'Disco Diamantado 4.1/2"', 'un', 35.00, 'Material'),
    createInsumo('ins-27', 'Disco de Corte Fino (para metal, 4.1/2")', 'un', 8.00, 'Material'),
    createInsumo('ins-28', 'Dispenser de Acrílico', 'un', 47.67, 'Material'),
    createInsumo('ins-29', 'Disjuntor Termomagnético 20A (Monopolar)', 'un', 18.33, 'Material'),
    createInsumo('ins-30', 'Eletroduto Aço Inox 3/4"', 'm', 48.33, 'Material'),
    createInsumo('ins-31', 'Emulsão Asfáltica (imprimação)', 'balde (18L)', 173.33, 'Material'),
    createInsumo('ins-32', 'EPS com Isolamento Térmico T1F (100mm)', 'm²', 39.00, 'Material'),
    createInsumo('ins-33', 'EPS 15cm', 'm²', 59.00, 'Material'),
    createInsumo('ins-34', 'EPS Reciclado (90mm)', 'm²', 21.50, 'Material'),
    createInsumo('ins-35', 'EPS Reciclado (100mm)', 'm²', 24.00, 'Material'),
    createInsumo('ins-36', 'Fita Adesiva Larga (Silver Tape)', 'rolo', 24.33, 'Material'),
    createInsumo('ins-37', 'Fita crepe 18mm x 50m', 'rolo', 7.50, 'Material'),
    createInsumo('ins-38', 'Fita Dupla Face Alta Aderência (VHB)', 'ml', 16.50, 'Material'),
    createInsumo('ins-39', 'Fita de Papel para Juntas Drywall', 'rolo (150m)', 20.33, 'Material'),
    createInsumo('ins-40', 'Fita Isolante', 'rolo', 11.00, 'Material'),
    createInsumo('ins-41', 'Fundo Epóxi', 'galão (3,6L)', 260.00, 'Material'),
    createInsumo('ins-42', 'Gás GLP (Botijão P13)', 'un', 115.00, 'Material'),
    createInsumo('ins-43', 'Guia / Montante Aço Galvanizado 70mm', 'barra (3m)', 45.00, 'Material'),
    createInsumo('ins-44', 'Impermeabilizante (Viaplus 7000)', 'cx (18kg)', 191.67, 'Material'),
    createInsumo('ins-45', 'Lâmina de Serra Sabre (para madeira)', 'un', 21.50, 'Material'),
    createInsumo('ins-46', 'Lâmina de Serra Sabre (para metal)', 'un', 23.50, 'Material'),
    createInsumo('ins-47', 'Lixa para massa grão 150', 'folha', 1.80, 'Material'),
    createInsumo('ins-48', 'Lona Plástica para Proteção (fina)', 'm²', 2.00, 'Material'),
    createInsumo('ins-49', 'Lona Plástica Transparente (Rolo 4x25m)', 'un', 95.00, 'Material'),
    createInsumo('ins-50', 'Lona Plástica 200 Micra', 'm²', 4.17, 'Material'),
    createInsumo('ins-51', 'Massa para Juntas Drywall', 'balde (15kg)', 93.33, 'Material'),
    createInsumo('ins-52', 'Massa Premium Santa Luzia', 'pote', 26.50, 'Material'),
    createInsumo('ins-53', 'Manta Asfáltica 4mm (Tipo II)', 'm²', 35.67, 'Material'),
    createInsumo('ins-54', 'Manta Asfáltica Autoadesiva', 'm²', 48.33, 'Material'),
    createInsumo('ins-55', 'Membrana de Poliuretano (PU)', 'kg', 65.00, 'Material'),
    createInsumo('ins-56', 'Painel Lã de Rocha (144 kg/m³)', 'm²', 130.00, 'Material'),
    createInsumo('ins-57', 'Papel Kraft ou Filme PE', 'm²', 1.83, 'Material'),
    createInsumo('ins-58', 'Parafuso com bucha S6', 'kit (c/ 10)', 4.50, 'Material'),
    createInsumo('ins-59', 'Parafusos e buchas para fixação (kit S8)', 'cj', 11.00, 'Material'),
    createInsumo('ins-60', 'Parafusos para Drywall (T.A. e T.L.)', 'caixa', 33.33, 'Material'),
    createInsumo('ins-61', 'Perfil e Acessórios para Fire Stop', 'ml', 30.00, 'Material'),
    createInsumo('ins-62', 'Perfil de Junta Plástico', 'ml', 8.67, 'Material'),
    createInsumo('ins-63', 'Placa de Gesso Acartonado RU', 'un', 42.67, 'Material'),
    createInsumo('ins-64', 'Primer Asfáltico', 'L', 20.67, 'Material'),
    createInsumo('ins-65', 'Primer Epóxi', 'kg', 76.67, 'Material'),
    createInsumo('ins-66', 'Raspador manual de rejunte', 'un', 19.67, 'Material'),
    createInsumo('ins-67', 'Revestimento cerâmico (genérico)', 'pç', 14.50, 'Material'),
    createInsumo('ins-68', 'Rodapé Poliestireno S. Luzia', 'ml', 37.00, 'Material'),
    createInsumo('ins-69', 'Rolo de lã para epóxi 9cm', 'un', 12.00, 'Material'),
    createInsumo('ins-70', 'Saco de ráfia', 'un', 2.50, 'Material'),
    createInsumo('ins-71', 'Sealtubo Metálico 3/4"', 'm', 11.33, 'Material'),
    createInsumo('ins-72', 'Selante PU', 'tubo (300ml)', 32.33, 'Material'),
    createInsumo('ins-73', 'Super Adesivo Santa Luzia', 'tubo', 48.00, 'Material'),
    createInsumo('ins-74', 'Tábua de Pinus Bruta (fôrma)', 'm²', 43.33, 'Material'),
    createInsumo('ins-75', 'Tampão PVC p/ Água (1/2")', 'un', 2.40, 'Material'),
    createInsumo('ins-76', 'Tampão PVC p/ Água (3/4" ou 1")', 'un', 3.50, 'Material'),
    createInsumo('ins-77', 'Tampão PVC p/ Esgoto (DN 40mm)', 'un', 2.40, 'Material'),
    createInsumo('ins-78', 'Tampão PVC p/ Esgoto (DN 50mm)', 'un', 4.50, 'Material'),
    createInsumo('ins-79', 'Tampão PVC p/ Esgoto (DN 100mm)', 'un', 7.20, 'Material'),
    createInsumo('ins-80', 'Tela de Poliéster para Impermeabilização', 'm²', 7.33, 'Material'),
    createInsumo('ins-81', 'Tela hexagonal tipo "galinheiro"', 'm²', 6.00, 'Material'),
    createInsumo('ins-82', 'Tela Soldada Q61', 'painel', 88.33, 'Material'),
    createInsumo('ins-83', 'Tela Soldada Q92', 'm²', 25.00, 'Material'),
    createInsumo('ins-84', 'Tinta Intumescente', 'L', 180.00, 'Material'),
    createInsumo('ins-85', 'Tinta Epóxi', 'galão (3,6L)', 310.00, 'Material'),
    createInsumo('ins-86', 'Tomada Industrial 2P+T (16A)', 'un', 45.00, 'Material'),
    createInsumo('ins-87', 'Trincha 1"', 'un', 5.00, 'Material'),
    createInsumo('ins-88', 'Tubo PPR 25mm', 'm', 12.00, 'Material'),
    createInsumo('ins-89', 'Tubo PVC Esgoto 40mm', 'm', 8.00, 'Material'),
    createInsumo('ins-90', 'Vergalhão CA-50 10mm (3/8")', 'kg', 9.00, 'Material'),
    // Tabela 3: Custos de Equipamentos e Serviços
    createInsumo('ins-91', 'Carrinho de Carga Plataforma 300kg', 'diária', 40.00, 'Equipamento'),
    createInsumo('ins-92', 'Locação Caminhão Munck', 'hora', 266.67, 'Equipamento'),
    createInsumo('ins-93', 'Locação de Betoneira 400L', 'diária', 120.00, 'Equipamento'),
    createInsumo('ins-94', 'Locação de Chapa de Aço 1/2"', 'diária', 45.00, 'Equipamento'),
    createInsumo('ins-95', 'Locação de Esmerilhadeira', 'diária', 56.67, 'Equipamento'),
    createInsumo('ins-96', 'Locação de Martelete (30kg)', 'diária', 181.67, 'Equipamento'),
    createInsumo('ins-97', 'Locação de Martelete Leve', 'diária', 96.67, 'Equipamento'),
    createInsumo('ins-98', 'Locação de Martelete Médio (10-15kg)', 'diária', 136.67, 'Equipamento'),
    createInsumo('ins-99', 'Locação de Martelete Pequeno', 'diária', 76.67, 'Equipamento'),
    createInsumo('ins-100', 'Locação de Parafusadeira/Desparafusadeira', 'diária', 50.00, 'Equipamento'),
    createInsumo('ins-101', 'Locação de Placa Vibratória ("Sapo")', 'diária', 110.00, 'Equipamento'),
    createInsumo('ins-102', 'Locação de Rompedor Pesado (>25kg)', 'diária', 228.33, 'Equipamento'),
    createInsumo('ins-103', 'Locação de Rolo Compactador Liso (Manual)', 'diária', 250.00, 'Equipamento'),
    createInsumo('ins-104', 'Locação de Serra Clipper', 'diária', 136.67, 'Equipamento'),
    createInsumo('ins-105', 'Locação de Termofusora para PPR', 'diária', 96.67, 'Equipamento'),
    createInsumo('ins-106', 'Locação de Vibrador de Imersão', 'diária', 77.50, 'Equipamento'),
    createInsumo('ins-107', 'Plataforma de Andaime Tubular', 'diária', 70.00, 'Equipamento'),
    createInsumo('ins-108', 'Remoção de Entulho (Bota-Fora)', 'm³', 90.00, 'Equipamento'),
    createInsumo('ins-109', 'Ventosas de Sucção para Vidro (par)', 'diária', 80.00, 'Equipamento'),
];

const createMockComposicao = (
  id: string,
  codigo: string,
  titulo: string,
  unidade: string,
  grupo: string,
  subgrupo: string
): Composicao => {
  // basic numbers for indicators
  const custoMat = Math.random() * 100 + 20;
  const custoMo = Math.random() * 50 + 15;
  const custoEq = Math.random() * 10 + 5;
  const custoTotalUn = custoMat + custoMo + custoEq;
  const qtdRef = Math.floor(Math.random() * 50) + 10;

  return {
    id,
    codigo,
    titulo,
    unidade,
    quantidadeReferencia: qtdRef,
    grupo,
    subgrupo,
    tags: [grupo, subgrupo],
    classificacaoInterna: 'Padrão',
    premissas: {
      escopo: `Execução de ${titulo.toLowerCase()} conforme especificações.`,
      metodo: 'Método executivo padrão de mercado.',
      incluso: 'Fornecimento de materiais, mão de obra e equipamentos necessários.',
      naoIncluso: 'Licenças, taxas e remoção de entulho fora da área de trabalho.',
    },
    insumos: {
      materiais: [
        { item: 'Insumo Material Genérico 1', unidade: 'un', quantidade: 1.05, valorUnitario: custoMat * 0.6, valorTotal: custoMat * 0.6 * 1.05 },
        { item: 'Insumo Material Genérico 2', unidade: 'kg', quantidade: 0.5, valorUnitario: custoMat * 0.4, valorTotal: custoMat * 0.4 * 0.5 },
      ],
      equipamentos: [
        { item: 'Equipamento Leve (consumo)', unidade: 'h', quantidade: 0.1, valorUnitario: custoEq * 10, valorTotal: custoEq },
      ],
    },
    maoDeObra: [
      { funcao: 'Profissional', hhPorUnidade: 0.8, custoUnitario: custoMo / 0.8, custoTotal: custoMo },
    ],
    quantitativosConsolidados: {
      listaCompraMateriais: [],
      necessidadeEquipamentos: [],
      quadroMaoDeObraTotal: [],
    },
    indicadores: {
      custoMateriaisPorUnidade: custoMat,
      custoEquipamentosPorUnidade: custoEq,
      custoMaoDeObraPorUnidade: custoMo,
      custoDiretoTotalPorUnidade: custoTotalUn,
      custoMateriaisTotal: custoMat * qtdRef,
      custoEquipamentosTotal: custoEq * qtdRef,
      custoMaoDeObraTotal: custoMo * qtdRef,
      custoDiretoTotalTotal: custoTotalUn * qtdRef,
      maoDeObraDetalhada: [{ funcao: 'Profissional', hhPorUnidade: 0.8, hhTotal: 0.8 * qtdRef }],
      pesoMateriaisPorUnidade: Math.random() * 10,
      pesoMateriaisTotal: Math.random() * 10 * qtdRef,
      volumeEntulhoPorUnidade: Math.random() * 0.01,
      volumeEntulhoTotal: Math.random() * 0.01 * qtdRef,
    },
    guias: {
      dicasExecucao: 'Seguir as boas práticas de execução para este tipo de serviço.',
      alertasSeguranca: 'Utilizar todos os EPIs necessários, como capacete, luvas e óculos de proteção.',
      criteriosQualidade: 'Verificar o alinhamento, prumo e nível conforme projeto.',
    },
    analiseEngenheiro: {
      nota: 'Composição de custo padrão, baseada em produtividade média de mercado.',
      fontesReferencias: `**Coeficientes de Consumo:** Baseado em consumo de mercado.\n\n**Coeficientes de Produtividade:** Índice de 0.80 HH/${unidade}, considerado padrão.`,
      quadroProdutividade: `| Fonte de Referência | Produtividade (HH/${unidade}) | Custo M.O. (R$/${unidade}) | Variação vs. Adotado |\n| :--- | :--- | :--- | :--- |\n| **Índice Adotado (Total)** | **0.80** | **R$ ${custoMo.toFixed(2).replace('.',',')}** | **-** |\n| Fonte de Mercado (Ex.) | 0.75 | R$ ${(custoMo / 0.8 * 0.75).toFixed(2).replace('.',',')} | -6.25% |`,
      analiseRecomendacao: 'Recomendado para orçamentos preliminares. Ajustar produtividade conforme complexidade da obra.',
    },
  };
};

const mockComposicoesList: Composicao[] = [
    // 1. ACABAMENTOS E LOGÍSTICA
    createMockComposicao('comp-1', 'ACAB-REG-01', 'Execução de Regularização de Parede com Argamassa (e=3cm)', 'm²', 'ACABAMENTOS', 'REGULARIZACAO'),
    createMockComposicao('comp-2', 'ACAB-LOG-01', 'Montagem e Desmontagem de Torre de Andaime Tubular', 'un', 'ACABAMENTOS', 'LOGISTICA'),
    createMockComposicao('comp-3', 'ACAB-INST-01', 'Instalação de Rodapé de Poliestireno', 'ml', 'ACABAMENTOS', 'INSTALACAO'),
    createMockComposicao('comp-4', 'ACAB-REG-02', 'Regularização de Parede com Argamassa Colante ACIII (e=1cm)', 'm²', 'ACABAMENTOS', 'REGULARIZACAO'),
    createMockComposicao('comp-5', 'ACAB-PREP-01', 'Chapisco em Superfícies de Alvenaria (3mm de espessura)', 'm²', 'ACABAMENTOS', 'PREPARACAO'),
    createMockComposicao('comp-6', 'ACAB-PREP-02', 'Execução de chapisco armado em rodapés para base de impermeabilização', 'ml', 'ACABAMENTOS', 'PREPARACAO'),
    createMockComposicao('comp-7', 'ACAB-PINT-01', 'Pintura Epóxi sobre Drywall em Sala Limpa (Fundo e Acabamento)', 'm²', 'ACABAMENTOS', 'PINTURA'),
    createMockComposicao('comp-8', 'ACAB-REG-03', 'Regularização de Parede - 2cm (Chapisco + Reboco)', 'm²', 'ACABAMENTOS', 'REGULARIZACAO'),
    createMockComposicao('comp-9', 'ACAB-REG-04', 'Regularização de Parede - 3cm (Chapisco + Reboco)', 'm²', 'ACABAMENTOS', 'REGULARIZACAO'),
    createMockComposicao('comp-10', 'ACAB-ACAB-01', 'Requadro de Vãos (Portas/Janelas)', 'ml', 'ACABAMENTOS', 'ACABAMENTO'),

    // 2. ACESSÓRIOS E COMUNICAÇÃO VISUAL
    createMockComposicao('comp-11', 'ACESS-PEL-01', 'Aplicação de Película de Vidro Leitosa (Jateada)', 'm²', 'ACESSORIOS', 'PELICULA'),
    createMockComposicao('comp-12', 'ACESS-DISP-01', 'Fornecimento e Instalação de Dispenser de Acrílico para Paramentação', 'un', 'ACESSORIOS', 'DISPENSER'),

    // 3. ALVENARIA E VEDAÇÕES
    createMockComposicao('comp-13', 'ALV-MUR-01', 'Execução de Septo (Mureta H=15cm) em Bloco de Concreto com Regularização', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-14', 'ALV-SOC-01', 'Execução de Bacia de Contenção (Sóculo) com Alvenaria, Regularização e Impermeabilização', 'un', 'ALVENARIA', 'SOCULO'),
    createMockComposicao('comp-15', 'ALV-VED-01', 'Instalação de Sistema de Vedação Corta-Fogo (Fire Stop) TRRF 2h', 'ml', 'ALVENARIA', 'VEDACAO'),
    createMockComposicao('comp-16', 'ALV-MUR-02', 'Execução de Mureta em Bloco de Concreto (h=15cm) com Chapisco e Reboco', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-17', 'ALV-SOC-02', 'Execução de Sóculo em Bloco de Concreto (h=15cm) com Regularização Total', 'ml', 'ALVENARIA', 'SOCULO'),
    createMockComposicao('comp-18', 'ALV-PAR-01', 'Alvenaria de Vedação em Bloco de Concreto (inclui argamassa de assentamento e reboco)', 'm²', 'ALVENARIA', 'PAREDE'),
    createMockComposicao('comp-19', 'ALV-BASE-01', 'Base de Concreto Estrutural para Maquinário (FCK 40 MPa), Armada e Ancorada', 'm³', 'ALVENARIA', 'BASE'),
    createMockComposicao('comp-20', 'ALV-BASE-02', 'Base de Concreto Estrutural sobre Laje - 4,50m x 4,50m x 0,10m (para até 10 Toneladas)', 'un', 'ALVENARIA', 'BASE'),
    createMockComposicao('comp-21', 'ALV-BASE-03', 'Base de Concreto Estrutural sobre Laje - 4,50m x 4,50m x 0,20m (para até 40 Toneladas)', 'un', 'ALVENARIA', 'BASE'),
    createMockComposicao('comp-22', 'ALV-MUR-03', 'Execução de Mureta de Bloco de Concreto (H=15cm) com Regularização', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-23', 'ALV-DRY-01', 'Execução de Parede em Drywall (Placa RU + Lã de Rocha)', 'm²', 'ALVENARIA', 'DRYWALL'),
    createMockComposicao('comp-24', 'ALV-MUR-04', 'Mureta de Bloco de Concreto - 1 Fiada (10cm ou 20cm de altura) - Assentamento SEM CAL', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-25', 'ALV-MUR-05', 'Mureta de Bloco de Concreto Celular (H=10cm) - Assentamento', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-26', 'ALV-MUR-06', 'Mureta de Bloco de Concreto Celular (H=10cm) com Regularização e Impermeabilização', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-27', 'ALV-MUR-07', 'Mureta de Bloco de Concreto Celular (60x30x10cm) - 10cm de altura COM REGULARIZAÇÃO', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-28', 'ALV-MUR-08', 'Mureta de Bloco de Concreto Celular (60x30x10cm) - 30cm de altura (1 Fiada - Bloco Deitado)', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-29', 'ALV-MUR-09', 'Mureta de Bloco de Concreto Celular (60x30x10cm) - 30cm de altura COM REGULARIZAÇÃO', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-30', 'ALV-MUR-10', 'Mureta de Bloco de Concreto H=20cm c/ Regularização (1 fiada Bloco 19x19x39cm)', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-31', 'ALV-MUR-11', 'Mureta Dupla de Alvenaria H=1,20m - 2x Bloco Concreto 19cm (Rebocada Faces Ext. e Topos)', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-32', 'ALV-SOC-03', 'Sóculo em U (3x2m) com Regularização e Contrapiso', 'un', 'ALVENARIA', 'SOCULO'),
    createMockComposicao('comp-33', 'ALV-SOC-04', 'Sóculo em bloco cerâmico (altura 19 cm)', 'ml', 'ALVENARIA', 'SOCULO'),
    createMockComposicao('comp-34', 'ALV-SOC-05', 'Sóculo em bloco cerâmico (altura 19 cm) - por m² de face', 'm²', 'ALVENARIA', 'SOCULO'),
    createMockComposicao('comp-35', 'ALV-SOC-06', 'Sóculo de Contenção até 2,90m² em Formato de U (Muretas H=15cm + Contrapiso 2cm)', 'un', 'ALVENARIA', 'SOCULO'),
];


export const mockComposicoes: Composicao[] = [...mockComposicoesList];