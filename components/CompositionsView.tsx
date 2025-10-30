



import React, { useState, useEffect } from 'react';
import type { Composicao, ComposicaoInsumo, ComposicaoMaoDeObra } from '../types';
import { Button, SearchIcon, Spinner } from './Shared';
import { parseCompositions, reviseParsedComposition, ParsedComposicao } from '../services/geminiService';

type ReviewableComposicao = ParsedComposicao & {
    reviewState: {
        isRevising: boolean;
        instruction: string;
        grupo: string;
        subgrupo: string;
    }
};

const MarkdownRenderer: React.FC<{ text: string | undefined, className?: string }> = ({ text, className }) => {
    if (!text) return <p className={className}></p>;
    // Simple renderer for **bold** text
    const parts = text.split(/(\*\*.*?\*\*)/g).filter(Boolean);
    return (
        <p className={className}>
            {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={i}>{part.slice(2, -2)}</strong>;
                }
                return part;
            })}
        </p>
    );
};

// --- Full Detail Display for Review ---
const CompositionDetailDisplay: React.FC<{
    composition: ReviewableComposicao;
    index: number;
    onRequestRevision: (index: number, instruction: string) => void;
    onFieldChange: (index: number, field: 'instruction' | 'grupo' | 'subgrupo', value: string) => void;
}> = ({ composition, index, onRequestRevision, onFieldChange }) => {

    const Section = ({ title, children }: { title: string, children?: React.ReactNode }) => (
        <div className="py-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b-2 border-primary pb-1 mb-3">{title}</h3>
            <div className="space-y-2 text-gray-800 dark:text-gray-300">{children}</div>
        </div>
    );
    
    const Table = ({ headers, children }: { headers: string[], children?: React.ReactNode }) => (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-700/50">
                    <tr>{headers.map(h => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{children}</tbody>
            </table>
        </div>
    );
    
    const renderInsumoRow = (insumo: ComposicaoInsumo, i: number) => (
         <tr key={i}><td className="px-4 py-1">{insumo.item}</td><td className="px-4 py-1">{insumo.unidade}</td><td className="px-4 py-1">{insumo.quantidade?.toFixed(3)}</td><td className="px-4 py-1 font-mono">{insumo.valorUnitario?.toFixed(2)}</td><td className="px-4 py-1 font-mono">{insumo.valorTotal?.toFixed(2)}</td></tr>
    );

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700 text-base text-gray-900 dark:text-gray-200">
            {/* Header */}
            <div>
                <p className="font-bold text-xl text-primary">{composition.codigo || 'CÓDIGO PENDENTE'} - {composition.titulo}</p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-400 mt-2">
                    <span><strong>Unidade:</strong> {composition.unidade}</span>
                    <span><strong>Qtd. Ref:</strong> {composition.quantidadeReferencia}</span>
                    <span><strong>Grupo:</strong> {composition.grupo}</span>
                    <span><strong>Tags:</strong> {composition.tags?.join(', ')}</span>
                    <span><strong>Classificação:</strong> {composition.classificacaoInterna}</span>
                </div>
            </div>

            {/* Import Note & Code Sugestion */}
            {composition.analiseEngenheiro?.notaDaImportacao && (
                <div className="my-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 rounded-md">
                    <h4 className="font-semibold text-sm text-yellow-800 dark:text-yellow-200">Nota da Importação (IA):</h4>
                     <MarkdownRenderer text={composition.analiseEngenheiro.notaDaImportacao} className="text-sm text-yellow-700 dark:text-yellow-300 whitespace-pre-wrap mt-1" />
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Grupo Sugerido (Editar)</label>
                            <input type="text" value={composition.reviewState.grupo} onChange={e => onFieldChange(index, 'grupo', e.target.value.toUpperCase())} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 p-2" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Subgrupo Sugerido (Editar)</label>
                             <input type="text" value={composition.reviewState.subgrupo} onChange={e => onFieldChange(index, 'subgrupo', e.target.value.toUpperCase())} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 p-2" />
                        </div>
                    </div>
                </div>
            )}

            <Section title="1. Premissas Técnicas e de Escopo">
                 <MarkdownRenderer text={`**Escopo:** ${composition.premissas?.escopo}`} />
                 <MarkdownRenderer text={`**Método:** ${composition.premissas?.metodo}`} />
                 <MarkdownRenderer text={`**Incluso:** ${composition.premissas?.incluso}`} />
                 <MarkdownRenderer text={`**Não Incluso:** ${composition.premissas?.naoIncluso}`} />
            </Section>
            
            <Section title={`2. Lista de Insumos (Coeficientes para 1,00 ${composition.unidade})`}>
                <h4 className="font-semibold text-sm mt-3 mb-1 text-gray-700 dark:text-gray-300">2.1 Materiais</h4>
                <Table headers={['Item', 'Un.', 'Qtd.', 'V.U.', 'V.T.']}>
                    {composition.insumos?.materiais?.map(renderInsumoRow)}
                </Table>
                <h4 className="font-semibold text-sm mt-4 mb-1 text-gray-700 dark:text-gray-300">2.2 Equipamentos</h4>
                <Table headers={['Item', 'Un.', 'Qtd.', 'V.U.', 'V.T.']}>
                    {composition.insumos?.equipamentos?.map(renderInsumoRow)}
                </Table>
            </Section>
            
            <Section title={`3. Estimativa de Mão de Obra (HH) (para 1,00 ${composition.unidade})`}>
                 <Table headers={['Função', 'HH/Unidade', 'Custo Unit.', 'Custo Total']}>
                     {composition.maoDeObra?.map((mo, i) => (
                         <tr key={i}><td className="px-4 py-1">{mo.funcao}</td><td className="px-4 py-1">{mo.hhPorUnidade}</td><td className="px-4 py-1 font-mono">{mo.custoUnitario?.toFixed(2)}</td><td className="px-4 py-1 font-mono">{mo.custoTotal?.toFixed(2)}</td></tr>
                     ))}
                 </Table>
            </Section>

             <Section title={`4. Quantitativos Consolidados (para ${composition.quantidadeReferencia} ${composition.unidade})`}>
                <h4 className="font-semibold text-sm mt-3 mb-1 text-gray-700 dark:text-gray-300">4.1 Lista de Compra de Materiais</h4>
                 <Table headers={['Item', 'Un. Compra', 'Qtd. Bruta', 'Qtd. a Comprar', 'Custo Estimado']}>
                     {composition.quantitativosConsolidados?.listaCompraMateriais?.map((item, i) => (
                         <tr key={i}><td className="px-4 py-1">{item.item}</td><td className="px-4 py-1">{item.unidadeCompra}</td><td className="px-4 py-1">{item.quantidadeBruta?.toFixed(2)}</td><td className="px-4 py-1 font-bold">{item.quantidadeAComprar}</td><td className="px-4 py-1 font-mono">{item.custoTotalEstimado?.toFixed(2)}</td></tr>
                     ))}
                 </Table>
            </Section>
            
            <Section title="5. Indicadores Chave de Custo e Planejamento">
                 <Table headers={['Indicador', 'Unidade', `Valor (por ${composition.unidade})`, `Valor Total (para ${composition.quantidadeReferencia} ${composition.unidade})`]}>
                    {composition.indicadores && Object.entries(composition.indicadores).map(([key, value]) => {
                        if (key === 'maoDeObraDetalhada') return null;
                        const label = key.replace(/_/g, ' ').replace(/porUnidade|total/, '').replace(/\b\w/g, l => l.toUpperCase());
                        if (key.endsWith('_porUnidade')) {
                             const totalKey = key.replace('_porUnidade', '_total') as keyof typeof composition.indicadores;
                             const totalValue = composition.indicadores[totalKey];
                            return (
                                <tr key={key}><td className="px-4 py-1 font-semibold">{label}</td><td className="px-4 py-1">{typeof value === 'number' ? 'R$' : ''}</td><td className="px-4 py-1 font-mono">{typeof value === 'number' ? value.toFixed(2) : ''}</td><td className="px-4 py-1 font-mono">{typeof totalValue === 'number' ? totalValue.toFixed(2) : ''}</td></tr>
                            )
                        }
                        return null;
                    })}
                     {composition.indicadores?.maoDeObraDetalhada?.map(mo => (
                         <tr key={mo.funcao}><td className="px-4 py-1 font-semibold">{mo.funcao}</td><td className="px-4 py-1">HH</td><td className="px-4 py-1 font-mono">{mo.hhPorUnidade?.toFixed(2)}</td><td className="px-4 py-1 font-mono">{mo.hhTotal?.toFixed(2)}</td></tr>
                     ))}
                 </Table>
            </Section>
            
            <Section title="6. Guias, Segurança e Qualidade">
                <MarkdownRenderer text={`**Dicas de Execução:** ${composition.guias?.dicasExecucao}`} />
                <MarkdownRenderer text={`**Alertas de Segurança:** ${composition.guias?.alertasSeguranca}`} />
                <MarkdownRenderer text={`**Critérios de Qualidade:** ${composition.guias?.criteriosQualidade}`} />
            </Section>

            <Section title="7. Análise Técnica do Engenheiro">
                 <MarkdownRenderer text={`**Nota:** ${composition.analiseEngenheiro?.nota}`} />
                 <MarkdownRenderer text={`**Fontes e Referências:** ${composition.analiseEngenheiro?.fontesReferencias}`} />
                 <MarkdownRenderer text={`**Quadro de Produtividade:** ${composition.analiseEngenheiro?.quadroProdutividade}`} />
                 <MarkdownRenderer text={`**Análise e Recomendação:** ${composition.analiseEngenheiro?.analiseRecomendacao}`} />
            </Section>


            {/* Revision Block */}
            <div className="mt-6 pt-4 border-t border-gray-300 dark:border-gray-600">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instruções de Correção</label>
                <textarea
                    value={composition.reviewState.instruction}
                    onChange={(e) => onFieldChange(index, 'instruction', e.target.value)}
                    rows={2}
                    className="w-full p-2 border rounded-md font-mono text-sm bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                    placeholder="Se houver erros, descreva a correção aqui. Ex: 'O custo do cimento está errado, use R$32,50'..."
                />
                <div className="text-right mt-2">
                    <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => onRequestRevision(index, composition.reviewState.instruction)}
                        isLoading={composition.reviewState.isRevising}
                    >
                        Revisar com IA
                    </Button>
                </div>
            </div>
        </div>
    );
};

// --- Summary Card for Search View ---
const CompositionSummaryCard: React.FC<{ composition: Composicao }> = ({ composition }) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4 border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">
                <p className="font-mono text-sm text-primary">{composition.codigo}</p>
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">{composition.titulo}</h3>
            </div>
             <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                <span><strong>Unidade:</strong> {composition.unidade}</span>
                <span><strong>Qtd. Ref:</strong> {composition.quantidadeReferencia} {composition.unidade}</span>
             </div>
             <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md mb-4">
                 <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">📋 PREMISSAS & ESCOPO</h4>
                 <MarkdownRenderer text={`**Escopo:** ${composition.premissas?.escopo}`} className="text-xs text-gray-600 dark:text-gray-400 italic" />
                 <MarkdownRenderer text={`**Incluso:** ${composition.premissas?.incluso}`} className="text-xs text-gray-600 dark:text-gray-400 italic" />
             </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                 <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">📊 INDICADORES-CHAVE (por {composition.unidade})</h4>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-800 dark:text-gray-300">
                     <span><strong>Mat:</strong> R$ {composition.indicadores?.custoMateriais_porUnidade?.toFixed(2)}</span>
                     <span><strong>M.O.:</strong> R$ {composition.indicadores?.custoMaoDeObra_porUnidade?.toFixed(2)}</span>
                     <span><strong>Equip:</strong> R$ {composition.indicadores?.custoEquipamentos_porUnidade?.toFixed(2)}</span>
                     {composition.indicadores?.maoDeObraDetalhada?.map(mo => (
                         <span key={mo.funcao}><strong>{mo.funcao.match(/\(([^)]+)\)/)?.[1] || mo.funcao.split(' ')[0]}:</strong> {mo.hhPorUnidade?.toFixed(2)} HH</span>
                     ))}
                 </div>
             </div>
             <div className="text-right mt-4">
                <Button variant="ghost" size="sm">Ver Detalhes Completos</Button>
             </div>
        </div>
    );
};


export const CompositionsView: React.FC<{
    composicoes: Composicao[];
    setComposicoes: React.Dispatch<React.SetStateAction<Composicao[]>>;
    showToast: (message: string) => void;
}> = ({ composicoes, setComposicoes, showToast }) => {
    const [activeTab, setActiveTab] = useState<'importar' | 'pesquisar'>('importar');
    const [compositionText, setCompositionText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [composicoesParaRevisao, setComposicoesParaRevisao] = useState<ReviewableComposicao[] | null>(null);

    const handleProcessar = async () => {
        if (!compositionText.trim()) {
            showToast("O campo de texto não pode estar vazio.");
            return;
        }
        setIsProcessing(true);
        try {
            const parsed = await parseCompositions(compositionText);

            const reviewable = parsed.map(p => {
                let suggestedGrupo = 'GERAL';
                let suggestedSubgrupo = 'GERAL';
                const nota = p.analiseEngenheiro?.notaDaImportacao || '';
                const match = nota.match(/Grupo: (.*?), Subgrupo: (.*?)\./);
                if (match) {
                    suggestedGrupo = match[1].trim();
                    suggestedSubgrupo = match[2].trim();
                }

                return {
                    ...p,
                    reviewState: { 
                        isRevising: false, 
                        instruction: '',
                        grupo: suggestedGrupo,
                        subgrupo: suggestedSubgrupo,
                    }
                }
            });

            setComposicoesParaRevisao(reviewable);
            showToast(`${parsed.length} composição(ões) processada(s) com sucesso. Por favor, revise abaixo.`);
        } catch (error) {
            console.error(error);
            showToast(error instanceof Error ? error.message : "Um erro desconhecido ocorreu.");
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleFieldChange = (index: number, field: 'instruction' | 'grupo' | 'subgrupo', value: string) => {
        setComposicoesParaRevisao(prev => {
            if (!prev) return null;
            const newComps = [...prev];
            newComps[index].reviewState[field] = value;
            return newComps;
        });
    };

    const handleRequestRevision = async (index: number, instruction: string) => {
        if (!composicoesParaRevisao) return;

        setComposicoesParaRevisao(prev => {
            if (!prev) return null;
            const newComps = [...prev];
            newComps[index].reviewState.isRevising = true;
            return newComps;
        });

        try {
            const composicaoOriginal: ParsedComposicao = { ...composicoesParaRevisao[index] };
            delete (composicaoOriginal as any).reviewState;
            
            const revised = await reviseParsedComposition(composicaoOriginal, instruction);
            
            setComposicoesParaRevisao(prev => {
                if (!prev) return null;
                const newComps = [...prev];
                const oldReviewState = newComps[index].reviewState;
                newComps[index] = { ...revised, reviewState: { ...oldReviewState, isRevising: false, instruction: '' } };
                return newComps;
            });
            showToast(`Composição revisada com sucesso.`);
        } catch (error) {
            console.error(error);
            showToast(error instanceof Error ? error.message : "Um erro desconhecido ocorreu na revisão.");
            setComposicoesParaRevisao(prev => {
                 if (!prev) return null;
                const newComps = [...prev];
                newComps[index].reviewState.isRevising = false;
                return newComps;
            });
        }
    };
    
    const handleSalvar = () => {
        if (!composicoesParaRevisao) return;

        const novasComposicoes: Composicao[] = composicoesParaRevisao.map(comp => {
            // Find the max sequence for the current group/subgroup combination
            const maxSeq = composicoes
                .filter(c => c.grupo === comp.reviewState.grupo && c.subgrupo === comp.reviewState.subgrupo)
                .map(c => parseInt(c.codigo.split('-')[2], 10))
                .reduce((max, current) => Math.max(max, current), 0);
            
            const newSeq = (maxSeq + 1).toString().padStart(2, '0');
            const newCode = `${comp.reviewState.grupo}-${comp.reviewState.subgrupo}-${newSeq}`;

            const finalComp: Partial<Composicao> = { ...comp };
            delete (finalComp as any).reviewState;
            
            return {
                ...finalComp,
                id: `comp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                codigo: newCode,
                grupo: comp.reviewState.grupo,
                subgrupo: comp.reviewState.subgrupo,
            } as Composicao;
        });
        
        setComposicoes(prev => [...prev, ...novasComposicoes]);
        showToast(`${novasComposicoes.length} nova(s) composição(ões) salva(s) com sucesso!`);
        
        setComposicoesParaRevisao(null);
        setCompositionText('');
        setActiveTab('pesquisar');
    };

    const TabButton = ({ label, id, active }: { label: string, id: 'importar' | 'pesquisar', active: boolean }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-sm font-medium rounded-md ${active ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="p-4 md:p-8 flex-1 overflow-y-auto text-base">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                     <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Gestão de Composições</h1>
                     <div className="flex space-x-2 p-1 bg-gray-200 dark:bg-gray-900 rounded-lg">
                        <TabButton label="Pesquisar" id="pesquisar" active={activeTab === 'pesquisar'} />
                        <TabButton label="Importar" id="importar" active={activeTab === 'importar'} />
                    </div>
                </div>

                {activeTab === 'importar' && (
                    !composicoesParaRevisao ? (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Importar Novas Composições</h2>
                            <textarea
                                value={compositionText}
                                onChange={(e) => setCompositionText(e.target.value)}
                                rows={12}
                                className="w-full p-2 border rounded-md font-mono text-sm bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                                placeholder="Cole o texto das composições aqui..."
                            />
                            <div className="mt-4 text-right">
                                <Button onClick={handleProcessar} isLoading={isProcessing}>
                                    {isProcessing && <Spinner className="w-4 h-4 mr-2" />}
                                    {isProcessing ? 'Processando...' : 'Processar com IA'}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Revisão e Confirmação</h2>
                            {composicoesParaRevisao.map((comp, index) => (
                                <CompositionDetailDisplay
                                    key={index}
                                    composition={comp}
                                    index={index}
                                    onRequestRevision={handleRequestRevision}
                                    onFieldChange={handleFieldChange}
                                />
                            ))}
                             <div className="mt-6 text-center">
                                <Button size="lg" onClick={handleSalvar}>
                                    Salvar Composições Aprovadas
                                </Button>
                            </div>
                        </div>
                    )
                )}

                {activeTab === 'pesquisar' && (
                     <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
                         <div className="p-4 border-b dark:border-gray-700">
                            <div className="relative max-w-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <SearchIcon className="text-gray-400" />
                                </div>
                                <input 
                                    type="text" 
                                    placeholder="Buscar por nome ou código..." 
                                    className="w-full p-2 pl-10 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                                />
                            </div>
                        </div>
                        <div className="p-6">
                            {composicoes.length > 0 ? (
                                <div className="space-y-4">
                                    {composicoes.map(c => (
                                        <CompositionSummaryCard key={c.id} composition={c} />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                                    Nenhuma composição no banco de dados. Use a aba "Importar" para adicionar.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};