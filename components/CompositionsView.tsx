import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Composicao, ComposicaoInsumo, ComposicaoMaoDeObra } from '../types';
import { Button, SearchIcon, Spinner, Modal, TrashIcon, ClipboardIcon } from './Shared';
import { compositionService } from '../services/compositionService';
import { classifyComposition, parseCompositions, findRelevantCompositionsInBatch, reviseParsedComposition, type ParsedComposicao } from '../services/geminiService';

// Define types locally if needed for the view state, or import if exported
interface BatchRelevanceResult {
    idNovaComposicao: string;
    candidatos: {
        idExistente: string;
        titulo: string;
        escopoResumido: string;
        relevanciaScore: number;
        motivo: string;
    }[];
}

interface ReviewableComposicao extends ParsedComposicao {
    reviewState: {
        isRevising: boolean;
        instruction: string;
        codigo: string;
        grupo: string;
        subgrupo: string;
        justificativaIA?: string;
    };
}

const TabButton = ({ label, id, active, onClick }: { label: string, id: string, active: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${active
            ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
    >
        {label}
    </button>
);

// Componentes personalizados para o Markdown limpar a formatação de código (caixa preta)
const cleanMarkdownComponents = {
    pre: ({ node, ...props }: any) => <div className="whitespace-pre-wrap my-1" {...props} />,
    code: ({ node, ...props }: any) => <span className="bg-transparent text-current p-0 font-inherit" {...props} />
};

export const FullCompositionDetailView: React.FC<{ composition: Composicao, onCopyToClipboard: () => void }> = ({ composition, onCopyToClipboard }) => {
    const Section = ({ title, children, noTextColor = false }: { title: string, children?: React.ReactNode, noTextColor?: boolean }) => (
        <div className="py-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-quantisa-blue dark:text-blue-400 border-b-2 border-quantisa-blue dark:border-blue-400 pb-1 mb-3">{title}</h3>
            <div className={`space-y-2 ${noTextColor ? '' : 'text-gray-800 dark:text-gray-300'}`}>{children}</div>
        </div>
    );

    const Table = ({ headers, children }: { headers: string[], children?: React.ReactNode }) => (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-slate-200 dark:bg-slate-700">
                    <tr>{headers.map(h => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-gray-100">{children}</tbody>
            </table>
        </div>
    );

    const renderInsumoRow = (insumo: ComposicaoInsumo, i: number) => (
        <tr key={i}><td className="px-4 py-1">{insumo.item}</td><td className="px-4 py-1">{insumo.unidade}</td><td className="px-4 py-1">{insumo.quantidade?.toFixed(3)}</td><td className="px-4 py-1 font-mono">{insumo.valorUnitario?.toFixed(2)}</td><td className="px-4 py-1 font-mono">{insumo.valorTotal?.toFixed(2)}</td></tr>
    );

    return (
        <div className="p-2 text-base font-sans">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-xl text-primary">{composition.codigo} - {composition.titulo}</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-400 mt-2">
                        <span><strong>Unidade:</strong> {composition.unidade}</span>
                        <span><strong>Qtd. Ref:</strong> {composition.quantidadeReferencia}</span>
                        <span><strong>Grupo:</strong> {composition.grupo}</span>
                        <span><strong>Subgrupo:</strong> {composition.subgrupo}</span>
                    </div>
                </div>
                <Button
                    onClick={onCopyToClipboard}
                    className="!bg-blue-100 dark:!bg-blue-200 !text-slate-900 dark:!text-slate-900 hover:!bg-blue-200 dark:hover:!bg-blue-300 font-semibold !px-2 !py-1.5 !rounded-md !text-base !shadow-none gap-2"
                >
                    <ClipboardIcon className="w-5 h-5" />
                    Copiar Composição (Markdown)
                </Button>
            </div>

            <Section title="1. Premissas Técnicas e de Escopo">
                <p><strong>Escopo:</strong> {composition.premissas?.escopo}</p>
                <p><strong>Método:</strong> {composition.premissas?.metodo}</p>
                <p><strong>Incluso:</strong> {composition.premissas?.incluso}</p>
                <p><strong>Não Incluso:</strong> {composition.premissas?.naoIncluso}</p>
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
                        <tr key={i}>
                            <td className="px-4 py-1">{item.item}</td>
                            <td className="px-4 py-1">{item.unidadeCompra}</td>
                            <td className="px-4 py-1">{item.quantidadeBruta?.toFixed(2)}</td>
                            <td className="px-4 py-1">{item.quantidadeAComprar}</td>
                            <td className="px-4 py-1 font-mono">{item.custoTotalEstimado?.toFixed(2)}</td>
                        </tr>
                    )) || (
                            <tr>
                                <td colSpan={5} className="px-4 py-2 text-center text-gray-500">
                                    Nenhum item de lista de compra extraído
                                </td>
                            </tr>
                        )}
                </Table>
            </Section>

            <Section title="5. Indicadores Chave de Custo e Planejamento">
                <Table headers={['Indicador', 'Unidade', `Valor (por ${composition.unidade})`, `Valor Total (para ${composition.quantidadeReferencia} ${composition.unidade})`]}>
                    <tr>
                        <td className="px-4 py-1 font-semibold">Custo Materiais</td>
                        <td className="px-4 py-1">R$</td>
                        <td className="px-4 py-1 font-mono">{composition.indicadores?.custoMateriaisPorUnidade?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}</td>
                        <td className="px-4 py-1 font-mono">{composition.indicadores?.custoMateriaisTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}</td>
                    </tr>
                    <tr>
                        <td className="px-4 py-1 font-semibold">Custo Equipamentos</td>
                        <td className="px-4 py-1">R$</td>
                        <td className="px-4 py-1 font-mono">{composition.indicadores?.custoEquipamentosPorUnidade?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}</td>
                        <td className="px-4 py-1 font-mono">{composition.indicadores?.custoEquipamentosTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}</td>
                    </tr>
                    <tr>
                        <td className="px-4 py-1 font-semibold">Custo Mão de Obra</td>
                        <td className="px-4 py-1">R$</td>
                        <td className="px-4 py-1 font-mono">{composition.indicadores?.custoMaoDeObraPorUnidade?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}</td>
                        <td className="px-4 py-1 font-mono">{composition.indicadores?.custoMaoDeObraTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}</td>
                    </tr>
                    <tr className="bg-gray-100 dark:bg-gray-700 font-bold">
                        <td className="px-4 py-1">CUSTO DIRETO TOTAL</td>
                        <td className="px-4 py-1">R$</td>
                        <td className="px-4 py-1 font-mono">{composition.indicadores?.custoDiretoTotalPorUnidade?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}</td>
                        <td className="px-4 py-1 font-mono">{composition.indicadores?.custoDiretoTotalTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}</td>
                    </tr>
                    {composition.indicadores?.maoDeObraDetalhada?.map((mo, idx) => (
                        <tr key={`hh-${idx}`}>
                            <td className="px-4 py-1 font-semibold">{mo.funcao}</td>
                            <td className="px-4 py-1">HH</td>
                            <td className="px-4 py-1 font-mono">{mo.hhPorUnidade?.toFixed(2)}</td>
                            <td className="px-4 py-1 font-mono">{mo.hhTotal?.toFixed(2)}</td>
                        </tr>
                    ))}
                    <tr>
                        <td className="px-4 py-1 font-semibold">Peso dos Materiais</td>
                        <td className="px-4 py-1">kg</td>
                        <td className="px-4 py-1 font-mono">{composition.indicadores?.pesoMateriaisPorUnidade?.toFixed(2)}</td>
                        <td className="px-4 py-1 font-mono">{composition.indicadores?.pesoMateriaisTotal?.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td className="px-4 py-1 font-semibold">Volume de Entulho Gerado</td>
                        <td className="px-4 py-1">m³</td>
                        <td className="px-4 py-1 font-mono">{composition.indicadores?.volumeEntulhoPorUnidade?.toFixed(3)}</td>
                        <td className="px-4 py-1 font-mono">{composition.indicadores?.volumeEntulhoTotal?.toFixed(2)}</td>
                    </tr>
                </Table>
            </Section>

            <Section title="6. Guias, Segurança e Qualidade">
                <p><strong>Dicas de Execução:</strong> {composition.guias?.dicasExecucao}</p>
                <p><strong>Alertas de Segurança:</strong> {composition.guias?.alertasSeguranca}</p>
                <p><strong>Critérios de Qualidade:</strong> {composition.guias?.criteriosQualidade}</p>
            </Section>

            <Section title="7. Análise Técnica do Engenheiro" noTextColor>
                <div className="prose dark:prose-invert max-w-none text-sm">
                    <div>
                        <p><strong>Nota:</strong></p>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={cleanMarkdownComponents}>{composition.analiseEngenheiro?.nota || ''}</ReactMarkdown>
                    </div>
                    <div>
                        <p><strong>Fontes e Referências:</strong></p>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={cleanMarkdownComponents}>{composition.analiseEngenheiro?.fontesReferencias || ''}</ReactMarkdown>
                    </div>
                    <div>
                        <p><strong>Quadro de Produtividade:</strong></p>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={cleanMarkdownComponents}>{composition.analiseEngenheiro?.quadroProdutividade || ''}</ReactMarkdown>
                    </div>
                    <div>
                        <p><strong>Análise e Recomendação:</strong></p>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={cleanMarkdownComponents}>{composition.analiseEngenheiro?.analiseRecomendacao || ''}</ReactMarkdown>
                    </div>
                </div>
            </Section>
        </div>
    );
};

const CompositionDetailDisplay: React.FC<{
    composition: ReviewableComposicao;
    index: number;
    onRequestRevision: (index: number, instruction: string) => void;
    onFieldChange: (index: number, field: 'instruction' | 'codigo' | 'grupo' | 'subgrupo', value: string) => void;
}> = ({ composition, index, onRequestRevision, onFieldChange }) => {
    // Cast to Composicao for display purposes.
    const displayComp = composition as unknown as Composicao; 

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <div className="flex flex-wrap gap-4">
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Código Sugerido</label>
                        <input 
                            type="text" 
                            value={composition.reviewState.codigo} 
                            onChange={(e) => onFieldChange(index, 'codigo', e.target.value)}
                            className="bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded px-2 py-1 text-sm font-mono w-40 text-gray-900 dark:text-white"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Grupo</label>
                        <input 
                            type="text" 
                            value={composition.reviewState.grupo} 
                            onChange={(e) => onFieldChange(index, 'grupo', e.target.value)}
                            className="bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded px-2 py-1 text-sm w-40 text-gray-900 dark:text-white"
                        />
                     </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subgrupo</label>
                        <input 
                            type="text" 
                            value={composition.reviewState.subgrupo} 
                            onChange={(e) => onFieldChange(index, 'subgrupo', e.target.value)}
                            className="bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded px-2 py-1 text-sm w-40 text-gray-900 dark:text-white"
                        />
                     </div>
                 </div>
                 <div className="text-left md:text-right">
                     <span className="text-xs text-gray-500 italic block">Justificativa IA:</span>
                     <span className="text-xs text-gray-600 dark:text-gray-400">{composition.reviewState.justificativaIA}</span>
                 </div>
            </div>
            
            <div className="p-4">
                <FullCompositionDetailView composition={displayComp} onCopyToClipboard={() => {}} />
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700">
                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Solicitar Revisão com IA (Instrução)</label>
                 <div className="flex gap-2">
                    <textarea
                        value={composition.reviewState.instruction}
                        onChange={(e) => onFieldChange(index, 'instruction', e.target.value)}
                        rows={1}
                        className="flex-1 p-2 border rounded-md font-mono text-sm bg-white dark:bg-gray-600 dark:border-gray-500 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
                        placeholder="Ex: O custo de mão de obra parece baixo, ajuste para R$ 25/h..."
                    />
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onRequestRevision(index, composition.reviewState.instruction)}
                        isLoading={composition.reviewState.isRevising}
                    >
                        Revisar
                    </Button>
                 </div>
            </div>
        </div>
    );
};

const CompositionSummaryCard: React.FC<{
    composition: Composicao,
    onViewDetails: () => void,
    onDelete: () => void
}> = ({ composition, onViewDetails, onDelete }) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 group transition-shadow hover:shadow-xl">
            <div className="p-4">
                <div
                    className="flex justify-between items-start border-b border-gray-200 dark:border-gray-700 pb-2 mb-3 cursor-pointer"
                    onClick={onViewDetails}
                >
                    <div>
                        <p className="font-mono text-sm text-primary group-hover:underline">{composition.codigo}</p>
                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">{composition.titulo}</h3>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="text-red-500 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 p-1 rounded-full"
                        aria-label={`Excluir composição ${composition.titulo}`}
                    >
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>
                <div
                    className="space-y-4 cursor-pointer"
                    onClick={onViewDetails}
                >
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span><strong>Unidade:</strong> {composition.unidade}</span>
                        <span><strong>Qtd. Ref:</strong> {composition.quantidadeReferencia} {composition.unidade}</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                        <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">📋 PREMISSAS & ESCOPO</h4>
                        <div className="text-sm text-gray-600 dark:text-gray-400 italic space-y-1">
                            <p><strong>Escopo:</strong> {composition.premissas?.escopo}</p>
                            <p><strong>Método:</strong> {composition.premissas?.metodo}</p>
                        </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                        <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">📊 INDICADORES-CHAVE (por {composition.unidade})</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-sm text-gray-800 dark:text-gray-300">
                            <span><strong>Mat:</strong> R$ {composition.indicadores?.custoMateriaisPorUnidade?.toFixed(2)}</span>
                            <span><strong>M.O.:</strong> R$ {composition.indicadores?.custoMaoDeObraPorUnidade?.toFixed(2)}</span>
                            <span><strong>Equip:</strong> R$ {composition.indicadores?.custoEquipamentosPorUnidade?.toFixed(2)}</span>
                            {composition.indicadores?.maoDeObraDetalhada?.map(mo => (
                                <span key={mo.funcao}><strong>{mo.funcao.match(/\(([^)]+)\)/)?.[1] || mo.funcao.split(' ')[0]}:</strong> {mo.hhPorUnidade?.toFixed(2)} HH</span>
                            ))}
                            <span><strong>Peso:</strong> {composition.indicadores?.pesoMateriaisPorUnidade?.toFixed(2)} kg</span>
                            <span><strong>Entulho:</strong> {composition.indicadores?.volumeEntulhoPorUnidade?.toFixed(3)} m³</span>
                        </div>
                    </div>
                    <div className="text-right pt-2">
                        <span className="font-bold text-primary dark:text-indigo-400 text-sm hover:underline">
                            Ver Detalhes Completos
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

type ImportStage = 'input' | 'similarity_check' | 'review_and_confirm';

const SimilarityCheckView: React.FC<{
    parsedCompositions: (ParsedComposicao & { id: string })[];
    relevanceResults: BatchRelevanceResult[];
    onProceed: (compositionsToReview: ParsedComposicao[]) => void;
    onCancel: () => void;
    isLoadingClassifications?: boolean;
}> = ({ parsedCompositions, relevanceResults, onProceed, onCancel, isLoadingClassifications }) => {
    const [decisions, setDecisions] = useState<Record<string, 'add' | 'discard'>>(() =>
        Object.fromEntries(parsedCompositions.map(c => [c.id, 'add']))
    );

    const handleDecisionChange = (id: string, decision: 'add' | 'discard') => {
        setDecisions(prev => ({ ...prev, [id]: decision }));
    };

    const handleProceed = () => {
        const toReview = parsedCompositions.filter(c => decisions[c.id] === 'add');
        onProceed(toReview);
    };

    return (
        <div>
            <h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">Verificação de Similaridade</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">A IA analisou suas composições e encontrou algumas similares já existentes. Decida para cada item se deseja adicioná-lo como novo ou descartá-lo.</p>

            <div className="space-y-3">
                {parsedCompositions.map(comp => {
                    const result = relevanceResults.find(r => r.idNovaComposicao === comp.id);
                    return (
                        <div key={comp.id} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between items-start gap-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">Nova Composição: <span className="text-primary">{comp.titulo}</span></h3>
                                    </div>

                                    <div className="flex-shrink-0 flex items-center gap-4">
                                        <label className="flex items-center gap-2 text-sm"><input type="radio" name={`decision-${comp.id}`} checked={decisions[comp.id] === 'add'} onChange={() => handleDecisionChange(comp.id, 'add')} className="text-primary focus:ring-primary" />Adicionar</label>
                                        <label className="flex items-center gap-2 text-sm"><input type="radio" name={`decision-${comp.id}`} checked={decisions[comp.id] === 'discard'} onChange={() => handleDecisionChange(comp.id, 'discard')} className="text-primary focus:ring-primary" />Descartar</label>
                                    </div>
                                </div>

                                <div className="mt-4 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                                    <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Candidatos Similares Encontrados:</h4>
                                    {result && result.candidatos.length > 0 ? (
                                        <ul className="mt-2 space-y-3">
                                            {result.candidatos.map(cand => (
                                                <li key={cand.idExistente} className="p-3 bg-slate-100 dark:bg-slate-700 rounded-md">
                                                    <p className="font-bold text-slate-900 dark:text-slate-50 text-lg">{cand.titulo}</p>
                                                    <p className="italic text-sm text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-wrap">
                                                        <strong>Escopo:</strong> {cand.escopoResumido}
                                                    </p>
                                                    <p className="text-sm text-green-700 dark:text-green-500 mt-2"><span className="font-bold">{cand.relevanciaScore}%</span> - {cand.motivo}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Nenhuma composição similar encontrada.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 flex justify-end items-center gap-4">
                <Button variant="secondary" onClick={onCancel} disabled={isLoadingClassifications}>Cancelar Importação</Button>
                <Button size="lg" onClick={handleProceed} isLoading={isLoadingClassifications}>
                    {isLoadingClassifications ? 'Classificando com IA...' : 'Prosseguir para Revisão'}
                </Button>
            </div>
        </div>
    );
};

export const CompositionsView: React.FC<{
    composicoes: Composicao[];
    setComposicoes: React.Dispatch<React.SetStateAction<Composicao[]>>;
    showToast: (message: string, type?: 'success' | 'error') => void;
    onLoadMore?: () => void;
    hasMore?: boolean;
    isLoadingMore?: boolean;
}> = ({ composicoes, setComposicoes, showToast, onLoadMore, hasMore = false, isLoadingMore = false }) => {
    const [activeTab, setActiveTab] = useState<'importar' | 'pesquisar'>('importar');
    const [compositionText, setCompositionText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [importStage, setImportStage] = useState<ImportStage>('input');
    const [parsedCompositions, setParsedCompositions] = useState<(ParsedComposicao & { id: string })[]>([]);
    const [relevanceResults, setRelevanceResults] = useState<BatchRelevanceResult[]>([]);
    const [composicoesParaRevisao, setComposicoesParaRevisao] = useState<ReviewableComposicao[] | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [compositionToDelete, setCompositionToDelete] = useState<Composicao | null>(null);
    const [compositionToView, setCompositionToView] = useState<Composicao | null>(null);

    const filteredCompositions = useMemo(() => {
        if (!searchQuery) return composicoes;
        return composicoes.filter(c =>
            c.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.codigo.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [composicoes, searchQuery]);

    const handleCopyToClipboard = (composition: Composicao) => {
        const text = JSON.stringify(composition, null, 2);
        navigator.clipboard.writeText(text).then(() => showToast('Copiado para a área de transferência!'));
    };

    const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
        const target = e.target as HTMLTextAreaElement;
        target.style.height = 'auto';
        target.style.height = `${target.scrollHeight}px`;
    };

    const resetImportFlow = () => {
        setImportStage('input');
        setCompositionText('');
        setParsedCompositions([]);
        setRelevanceResults([]);
        setComposicoesParaRevisao(null);
    };

    const handleProcessar = async () => {
        if (!compositionText.trim()) {
            showToast("O campo de texto não pode estar vazio.", 'error');
            return;
        }
        setIsProcessing(true);
        try {
            const parsed = await parseCompositions(compositionText);

            const isInvalidInputAlert =
                parsed.length > 0 &&
                !parsed[0].titulo &&
                parsed[0].analiseEngenheiro?.notaDaImportacao?.includes('Alerta:');

            if (isInvalidInputAlert) {
                showToast(parsed[0].analiseEngenheiro!.notaDaImportacao!, 'error');
                setIsProcessing(false);
                return;
            }

            const parsedWithIds = parsed.map((p, i) => ({ ...p, id: `temp-${i}` }));
            setParsedCompositions(parsedWithIds);

            const relevance = await findRelevantCompositionsInBatch(parsedWithIds, composicoes);
            setRelevanceResults(relevance);

            setImportStage('similarity_check');

        } catch (error) {
            console.error(error);
            showToast(error instanceof Error ? error.message : "Um erro desconhecido ocorreu.", 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleProceedToReview = async (compositionsToReview: ParsedComposicao[]) => {
        if (compositionsToReview.length === 0) {
            showToast("Nenhuma composição selecionada.", 'error');
            return;
        }

        setIsProcessing(true);

        try {
            const existingCodes = composicoes.map(c => c.codigo);

            const enrichedCompositions = await Promise.all(compositionsToReview.map(async (p) => {
                try {
                    const classificacao = await classifyComposition(p.titulo || "Nova Composição", existingCodes);

                    return {
                        ...p,
                        reviewState: {
                            isRevising: false,
                            instruction: '',
                            codigo: classificacao.sugestaoCodigo,
                            grupo: classificacao.grupo,
                            subgrupo: classificacao.subgrupo,
                            justificativaIA: classificacao.justificativa
                        }
                    };
                } catch (err) {
                    return {
                        ...p,
                        reviewState: {
                            isRevising: false,
                            instruction: '',
                            codigo: p.codigo || '',
                            grupo: p.grupo || 'GERAL',
                            subgrupo: p.subgrupo || 'GERAL',
                            justificativaIA: 'Não foi possível classificar automaticamente.'
                        }
                    };
                }
            }));

            setComposicoesParaRevisao(enrichedCompositions);
            setImportStage('review_and_confirm');
        } catch (error) {
            console.error(error);
            showToast("Erro ao classificar composições.", 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFieldChange = (index: number, field: 'instruction' | 'codigo' | 'grupo' | 'subgrupo', value: string) => {
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
            showToast(error instanceof Error ? error.message : "Um erro desconhecido ocorreu na revisão.", 'error');
            setComposicoesParaRevisao(prev => {
                if (!prev) return null;
                const newComps = [...prev];
                newComps[index].reviewState.isRevising = false;
                return newComps;
            });
        }
    };

    const handleConfirmDelete = async () => {
        if (!compositionToDelete) return;
        try {
            await compositionService.delete(compositionToDelete.id);
            setComposicoes(prev => prev.filter(c => c.id !== compositionToDelete.id));
            showToast(`Composição "${compositionToDelete.titulo}" excluída com sucesso.`);
            setCompositionToDelete(null);
        } catch (error) {
            console.error('Erro ao excluir:', error);
            showToast('Erro ao excluir composição.', 'error');
        }
    };

    const handleSalvar = async () => {
        if (!composicoesParaRevisao) return;

        try {
            const novasComposicoes = composicoesParaRevisao.map(comp => {
                let finalCode = comp.reviewState.codigo;

                if (!finalCode) {
                    const maxSeq = composicoes
                        .filter(c => c.grupo === comp.reviewState.grupo && c.subgrupo === comp.reviewState.subgrupo)
                        .map(c => {
                            const parts = c.codigo.split('-');
                            return parseInt(parts[parts.length - 1], 10);
                        })
                        .reduce((max, current) => Math.max(max, current), 0);

                    const newSeq = (maxSeq + 1).toString().padStart(2, '0');
                    finalCode = `${comp.reviewState.grupo}-${comp.reviewState.subgrupo}-${newSeq}`;
                }

                const finalComp: Partial<Composicao> = { ...comp };
                delete (finalComp as any).reviewState;

                return {
                    ...finalComp,
                    codigo: finalCode,
                    grupo: comp.reviewState.grupo,
                    subgrupo: comp.reviewState.subgrupo,
                } as Omit<Composicao, 'id'>;
            });

            const savedCompositions = await Promise.all(novasComposicoes.map(c => compositionService.create(c)));

            setComposicoes(prev => [...prev, ...savedCompositions]);
            showToast(`${savedCompositions.length} nova(s) composição(ões) salva(s) com sucesso!`);

            resetImportFlow();
            setActiveTab('pesquisar');
        } catch (error) {
            console.error('Erro ao salvar:', error);
            showToast('Erro ao salvar composições.', 'error');
        }
    };

    const renderImportContent = () => {
        switch (importStage) {
            case 'input':
                return (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Importar Novas Composições</h2>
                        <textarea
                            value={compositionText}
                            onChange={(e) => setCompositionText(e.target.value)}
                            onInput={handleTextareaInput}
                            style={{ minHeight: '300px' }}
                            className="w-full p-2 border rounded-md font-mono text-sm bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 resize-none overflow-hidden"
                            placeholder="Cole o texto das composições aqui..."
                        />
                        <div className="mt-4 text-right">
                            <Button onClick={handleProcessar} isLoading={isProcessing}>
                                {isProcessing ? 'Processando...' : 'Processar e Verificar Similaridade'}
                            </Button>
                        </div>
                    </div>
                );
            case 'similarity_check':
                return (
                    <SimilarityCheckView
                        parsedCompositions={parsedCompositions}
                        relevanceResults={relevanceResults}
                        onProceed={handleProceedToReview}
                        onCancel={resetImportFlow}
                        isLoadingClassifications={isProcessing}
                    />
                );
            case 'review_and_confirm':
                return (
                    <div>
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Revisão e Confirmação</h2>
                        {composicoesParaRevisao?.map((comp, index) => (
                            <CompositionDetailDisplay
                                key={index}
                                composition={comp}
                                index={index}
                                onRequestRevision={handleRequestRevision}
                                onFieldChange={handleFieldChange}
                            />
                        ))}
                        <div className="mt-6 flex justify-between items-center">
                            <Button variant="secondary" onClick={() => setImportStage('similarity_check')}>Voltar</Button>
                            <Button size="lg" onClick={handleSalvar}>
                                Salvar Composições Aprovadas
                            </Button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="p-4 md:p-8 flex-1 overflow-y-auto text-base">
            <div className="max-w-screen-xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Gestão de Composições</h1>
                    <div className="flex space-x-2 p-1 bg-gray-200 dark:bg-gray-900 rounded-lg">
                        <TabButton label="Pesquisar" id="pesquisar" active={activeTab === 'pesquisar'} onClick={() => setActiveTab('pesquisar')} />
                        <TabButton label="Importar" id="importar" active={activeTab === 'importar'} onClick={() => setActiveTab('importar')} />
                    </div>
                </div>

                {activeTab === 'importar' && (
                    isProcessing && importStage === 'input' ? (
                        <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                            <Spinner className="w-8 h-8 mb-4" />
                            <h3 className="text-lg font-semibold dark:text-white">Analisando Composições...</h3>
                            <p className="text-gray-600 dark:text-gray-400">Verificando similaridade com a base de dados. Isso pode levar alguns instantes.</p>
                        </div>
                    ) : (
                        renderImportContent()
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
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full p-2 pl-10 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                                />
                            </div>
                        </div>
                        <div className="p-6">
                            {filteredCompositions.length > 0 ? (
                                <>
                                    <div className="space-y-4">
                                        {filteredCompositions.map(c => (
                                            <CompositionSummaryCard
                                                key={c.id}
                                                composition={c}
                                                onViewDetails={() => setCompositionToView(c)}
                                                onDelete={() => setCompositionToDelete(c)}
                                            />
                                        ))}
                                    </div>
                                    {!searchQuery && hasMore && onLoadMore && (
                                        <div className="mt-6 text-center">
                                            <Button
                                                variant="secondary"
                                                onClick={onLoadMore}
                                                isLoading={isLoadingMore}
                                                disabled={isLoadingMore}
                                            >
                                                {isLoadingMore ? 'Carregando...' : 'Carregar Mais'}
                                            </Button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                                    {searchQuery ? `Nenhuma composição encontrada para "${searchQuery}".` : 'Nenhuma composição no banco de dados. Use a aba "Importar" para adicionar.'}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <Modal isOpen={!!compositionToView} onClose={() => setCompositionToView(null)} title="Detalhes da Composição" size="xl">
                {compositionToView && <FullCompositionDetailView composition={compositionToView} onCopyToClipboard={() => handleCopyToClipboard(compositionToView)} />}
            </Modal>

            <Modal isOpen={!!compositionToDelete} onClose={() => setCompositionToDelete(null)} title="Confirmar Exclusão" size="md">
                {compositionToDelete && (
                    <div>
                        <p className="dark:text-gray-300">Tem certeza que deseja apagar a composição &quot;{compositionToDelete.titulo}&quot;?</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Essa ação não pode ser desfeita.</p>
                        <div className="flex justify-end space-x-2 mt-6">
                            <Button variant="secondary" onClick={() => setCompositionToDelete(null)}>Cancelar</Button>
                            <Button variant="danger" onClick={handleConfirmDelete}>Excluir</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
