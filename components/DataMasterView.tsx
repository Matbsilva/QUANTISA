import React, { useState, useMemo } from 'react';
import type { Insumo } from '../types';
import { Button, SearchIcon, Spinner } from './Shared';
import { parseInsumos } from '../services/geminiService';


type ReviewableInsumo = Partial<Insumo> & {
    isNew: boolean;
};


export const DataMasterView: React.FC<{
    insumos: Insumo[];
    setInsumos: React.Dispatch<React.SetStateAction<Insumo[]>>;
    showToast: (message: string, type?: 'success' | 'error') => void;
}> = ({ insumos, setInsumos, showToast }) => {
    const [activeTab, setActiveTab] = useState<'pesquisar' | 'importar'>('pesquisar');
    const [searchQuery, setSearchQuery] = useState('');
    const [insumosText, setInsumosText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [insumosParaRevisao, setInsumosParaRevisao] = useState<ReviewableInsumo[] | null>(null);

    const filteredInsumos = useMemo(() => {
        if (!searchQuery) return insumos;
        return insumos.filter(i => 
            i.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
            i.tipo.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (i.marca && i.marca.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [insumos, searchQuery]);
    
    const handleProcessar = async () => {
        if (!insumosText.trim()) {
            showToast("O campo de texto não pode estar vazio.", 'error');
            return;
        }
        setIsProcessing(true);
        try {
            const parsed = await parseInsumos(insumosText);
            const reviewable = parsed.map(p => ({ ...p, isNew: true }));
            setInsumosParaRevisao(reviewable);
            showToast(`${parsed.length} insumo(s) processado(s) com sucesso. Por favor, revise abaixo.`);
        } catch (error) {
            console.error(error);
            showToast(error instanceof Error ? error.message : "Um erro desconhecido ocorreu.", 'error');
        } finally {
            setIsProcessing(false);
        }
    };
    
     const handleSalvar = () => {
        if (!insumosParaRevisao) return;
        const novosInsumos: Insumo[] = insumosParaRevisao.map(rev => ({
            ...rev,
            id: `ins-${Date.now()}-${Math.random()}`,
        } as Insumo));
        
        setInsumos(prev => [...prev, ...novosInsumos]);
        showToast(`${novosInsumos.length} novo(s) insumo(s) salvo(s) com sucesso!`);
        
        setInsumosParaRevisao(null);
        setInsumosText('');
        setActiveTab('pesquisar');
    };

    const handleItemChange = (index: number, field: keyof Insumo, value: string | number) => {
        if (!insumosParaRevisao) return;
        const updated = [...insumosParaRevisao];
        (updated[index] as any)[field] = value;
        setInsumosParaRevisao(updated);
    };

    const TabButton = ({ label, id, active }: { label: string, id: 'pesquisar' | 'importar', active: boolean }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-sm font-medium rounded-md ${active ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="p-4 md:p-8 flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                     <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Insumos</h1>
                     <div className="flex space-x-2 p-1 bg-gray-200 dark:bg-gray-900 rounded-lg">
                        <TabButton label="Pesquisar Insumos" id="pesquisar" active={activeTab === 'pesquisar'} />
                        <TabButton label="Importar / Adicionar" id="importar" active={activeTab === 'importar'} />
                    </div>
                </div>

                {activeTab === 'pesquisar' && (
                     <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
                        <div className="p-4 border-b dark:border-gray-700">
                           <div className="relative max-w-sm">
                               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                   <SearchIcon className="text-gray-400" />
                               </div>
                               <input 
                                   type="text" 
                                   placeholder="Buscar por nome, tipo ou marca..." 
                                   value={searchQuery}
                                   onChange={(e) => setSearchQuery(e.target.value)}
                                   className="w-full p-2 pl-10 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                               />
                           </div>
                       </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">Nome</th>
                                        <th scope="col" className="px-6 py-3">Marca</th>
                                        <th scope="col" className="px-6 py-3">Tipo</th>
                                        <th scope="col" className="px-6 py-3">Unidade</th>
                                        <th scope="col" className="px-6 py-3">Custo Atual</th>
                                        <th scope="col" className="px-6 py-3">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredInsumos.map((insumo) => (
                                        <tr key={insumo.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                            <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                                {insumo.nome}
                                            </th>
                                            <td className="px-6 py-4">{insumo.marca || '--'}</td>
                                            <td className="px-6 py-4">{insumo.tipo}</td>
                                            <td className="px-6 py-4">{insumo.unidade}</td>
                                            <td className="px-6 py-4 font-mono">
                                                {insumo.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <a href="#" className="font-medium text-primary hover:underline">Ver</a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                
                {activeTab === 'importar' && (
                    !insumosParaRevisao ? (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                            <h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">Importar Insumos em Massa</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                Cole uma lista de insumos abaixo. A IA irá interpretar, extrair marcas, calcular custos unitários e classificar os tipos automaticamente.
                            </p>
                            <textarea
                                value={insumosText}
                                onChange={(e) => setInsumosText(e.target.value)}
                                rows={15}
                                className="w-full p-2 border rounded-md font-mono text-sm bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                                placeholder="Aditivo (Bianco ou similar); L; 25.50&#10;Argamassa Colante AC-II; kg; 1.30&#10;Locação de Betoneira 400L; diária; 120.00"
                            />
                            <div className="mt-4 text-right">
                                <Button onClick={handleProcessar} isLoading={isProcessing}>
                                    {isProcessing ? 'Processando...' : 'Processar com IA'}
                                </Button>
                            </div>
                        </div>
                    ) : (
                         <div>
                            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Revisão e Confirmação</h2>
                             <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-left text-xs text-gray-700 uppercase bg-gray-200 dark:bg-gray-700 dark:text-gray-400">
                                        <tr>
                                            {['Nome', 'Tipo', 'Marca', 'Unidade', 'Custo Unitário', 'Observação IA'].map(h => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {insumosParaRevisao.map((insumo, index) => (
                                            <tr key={index}>
                                                <td className="p-1"><input type="text" value={insumo.nome || ''} onChange={e => handleItemChange(index, 'nome', e.target.value)} className="w-full bg-transparent p-1 rounded focus:bg-gray-100 dark:focus:bg-gray-700 outline-none text-gray-900 dark:text-gray-200"/></td>
                                                <td className="p-1"><input type="text" value={insumo.tipo || ''} onChange={e => handleItemChange(index, 'tipo', e.target.value as any)} className="w-full bg-transparent p-1 rounded focus:bg-gray-100 dark:focus:bg-gray-700 outline-none text-gray-900 dark:text-gray-200"/></td>
                                                <td className="p-1"><input type="text" value={insumo.marca || ''} onChange={e => handleItemChange(index, 'marca', e.target.value)} className="w-full bg-transparent p-1 rounded focus:bg-gray-100 dark:focus:bg-gray-700 outline-none text-gray-900 dark:text-gray-200"/></td>
                                                <td className="p-1"><input type="text" value={insumo.unidade || ''} onChange={e => handleItemChange(index, 'unidade', e.target.value)} className="w-20 bg-transparent p-1 rounded focus:bg-gray-100 dark:focus:bg-gray-700 outline-none text-gray-900 dark:text-gray-200"/></td>
                                                <td className="p-1"><input type="number" value={insumo.custo || 0} onChange={e => handleItemChange(index, 'custo', parseFloat(e.target.value))} className="w-24 bg-transparent p-1 rounded focus:bg-gray-100 dark:focus:bg-gray-700 outline-none text-gray-900 dark:text-gray-200"/></td>
                                                <td className="p-2 text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap">{insumo.observacao}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-6 flex justify-end items-center gap-4">
                               <Button variant="secondary" onClick={() => setInsumosParaRevisao(null)}>Cancelar</Button>
                               <Button size="lg" onClick={handleSalvar}>
                                   Salvar Insumos Aprovados
                               </Button>
                           </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};