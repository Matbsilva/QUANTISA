

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


export const mockInsumos: Insumo[] = [
    { id: 'ins-1', nome: 'Tinta Acrílica Branca', unidade: 'Lata 18L', custo: 325.00, tipo: 'Material' },
    { id: 'ins-2', nome: 'Massa Corrida PVA', unidade: 'Saco 20kg', custo: 42.00, tipo: 'Material' },
    { id: 'ins-3', nome: 'Cimento CP II', unidade: 'Saco 50kg', custo: 28.50, tipo: 'Material' },
    { id: 'ins-4', nome: 'Pintor', unidade: 'HH', custo: 45.00, tipo: 'MaoObra' },
    { id: 'ins-5', nome: 'Ajudante', unidade: 'HH', custo: 30.00, tipo: 'MaoObra' },
    { id: 'ins-6', nome: 'Betoneira 400L', unidade: 'diária', custo: 85.00, tipo: 'Equipamento' },
];

export const mockComposicoes: Composicao[] = [];
