"use client";

import React, { useState, useEffect } from 'react';
import { Button, Modal, Spinner, SearchIcon, SparklesIcon } from './Shared';
import { answerQueryFromCompositions } from '../services/geminiService';
import { compositionService } from '../services/compositionService';
import type { GeminiResponse, Composicao } from '../types';
import ReactMarkdown from 'react-markdown';

export const AskView = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [result, setResult] = useState<GeminiResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [compositions, setCompositions] = useState<Composicao[]>([]);

    // Carrega as composições para alimentar a IA como contexto
    useEffect(() => {
        const loadData = async () => {
            const data = await compositionService.fetchAll();
            setCompositions(data);
        };
        loadData();
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!searchQuery.trim()) return;
        
        setIsLoading(true);
        setResult(null);

        try {
            // Usa a função unificada que tem acesso a tools: googleSearch + contexto interno
            const response = await answerQueryFromCompositions(searchQuery, compositions);
            setResult(response);
            setIsModalOpen(true);
        } catch (error) {
            console.error(error);
            // Fallback para erro
        } finally {
            setIsLoading(false);
        }
    };

    const renderResponse = (response: GeminiResponse) => {
        switch (response.tipoResposta) {
            case 'resposta_direta':
            case 'resposta_analitica':
                return (
                    <div className="space-y-4">
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                             <ReactMarkdown>{response.texto}</ReactMarkdown>
                        </div>
                        {response.tipoResposta === 'resposta_analitica' && response.idsReferenciados.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Composições de Referência Usadas:</h4>
                                <div className="flex flex-wrap gap-2">
                                    {response.idsReferenciados.map(id => {
                                        const comp = compositions.find(c => c.id === id);
                                        return (
                                            <span key={id} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800">
                                                {comp ? comp.codigo : id}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'lista_composicoes':
                return (
                    <div>
                        <p className="mb-4 text-gray-700 dark:text-gray-300 font-medium">{response.textoIntroducao}</p>
                        <div className="grid gap-3">
                            {response.ids.map(id => {
                                const comp = compositions.find(c => c.id === id);
                                if (!comp) return null;
                                return (
                                    <div key={id} className="p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm">
                                        <div className="flex justify-between">
                                            <span className="font-mono text-xs text-primary">{comp.codigo}</span>
                                            <span className="text-xs text-gray-500">{comp.unidade}</span>
                                        </div>
                                        <h4 className="font-bold text-sm mt-1 text-gray-900 dark:text-gray-100">{comp.titulo}</h4>
                                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex gap-4">
                                            <span>Mat: R$ {comp.indicadores.custoMateriaisPorUnidade.toFixed(2)}</span>
                                            <span>M.O.: R$ {comp.indicadores.custoMaoDeObraPorUnidade.toFixed(2)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            case 'nao_encontrado':
                return (
                    <div className="text-center py-8">
                        <p className="text-gray-500 dark:text-gray-400">{response.texto}</p>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="p-4 md:p-8 flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
            <div className="max-w-3xl w-full mx-auto text-center">
                <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
                    Ask Quantisa <span className="text-primary text-2xl align-top">AI</span>
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10">
                    Sua inteligência central de custos. Pergunte sobre seus dados internos ou peça comparações com o mercado em tempo real.
                </p>
                
                 <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
                    <div className="relative group">
                        <div className="absolute -inset-0.5 rounded-full blur opacity-30 group-hover:opacity-50 transition duration-200 bg-gradient-to-r from-primary via-purple-500 to-blue-500"></div>
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Ex: Compare meu custo de alvenaria com o preço de mercado atual..."
                            className="relative w-full p-5 pl-8 pr-14 border-none rounded-full text-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 shadow-xl focus:ring-2 focus:ring-primary focus:outline-none placeholder-gray-400 dark:placeholder-gray-500"
                        />
                        <button 
                            type="submit"
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 hover:text-primary transition-colors"
                        >
                            {isLoading ? <Spinner className="w-6 h-6" /> : <SparklesIcon className="w-6 h-6"/>}
                        </button>
                    </div>
                    <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                        Dica: Tente &quot;Meu custo de cimento está caro?&quot; ou &quot;Liste composições de piso&quot;.
                    </p>
                </form>
            </div>
            
             <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Análise Inteligente: "${searchQuery}"`} size="xl">
                 {isLoading && <div className="flex justify-center py-12"><Spinner /></div>}
                 
                {!isLoading && result && (
                    <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg max-h-[60vh] overflow-y-auto">
                        {renderResponse(result)}
                    </div>
                )}
            </Modal>
        </div>
    );
};