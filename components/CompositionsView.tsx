import React, { useState } from 'react';
import type { Composicao } from '../types';
import { Button, SearchIcon } from './Shared';

interface CompositionsViewProps {
    composicoes: Composicao[];
    setComposicoes: React.Dispatch<React.SetStateAction<Composicao[]>>;
}

export const CompositionsView: React.FC<CompositionsViewProps> = ({ composicoes, setComposicoes }) => {
    const [compositionText, setCompositionText] = useState('');
    
    return (
        <div className="p-4 md:p-8 flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Section 1: Import */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Importar Novas Composições</h2>
                     <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Cole o texto de uma ou mais composições no padrão "Quantisa V1.1" abaixo. A IA irá processar e adicionar ao seu banco de dados.
                    </p>
                    <textarea
                        value={compositionText}
                        onChange={(e) => setCompositionText(e.target.value)}
                        rows={12}
                        className="w-full p-2 border rounded-md font-mono text-sm bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                        placeholder="Cole o texto das composições aqui..."
                    />
                    <div className="mt-4 text-right">
                        <Button onClick={() => { /* Logic to be implemented */ alert('Funcionalidade de processamento com IA a ser implementada.'); }}>
                            Processar com IA e Adicionar
                        </Button>
                    </div>
                </div>

                {/* Section 2: Existing */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
                     <div className="p-4 border-b dark:border-gray-700">
                        <div className="relative max-w-sm">
                             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <SearchIcon className="text-gray-400" />
                            </div>
                            <input 
                                type="text" 
                                placeholder="Buscar composição por nome ou código..." 
                                className="w-full p-2 pl-10 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                            />
                        </div>
                    </div>
                    <div className="p-6">
                        <p className="text-center text-gray-500 dark:text-gray-400">
                            A listagem das composições existentes aparecerá aqui.
                            <br/>
                            (Funcionalidade a ser implementada)
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};