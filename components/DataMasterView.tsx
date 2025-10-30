import React from 'react';
import type { Insumo } from '../types';

interface DataMasterViewProps {
    insumos: Insumo[];
}

export const DataMasterView: React.FC<DataMasterViewProps> = ({ insumos }) => {
    return (
        <div className="p-4 md:p-8 flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Insumos</h1>
                
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
                    <div className="p-4 border-b dark:border-gray-700">
                        <input 
                            type="text" 
                            placeholder="🔍 Buscar insumo..." 
                            className="w-full max-w-sm p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                        />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Nome</th>
                                    <th scope="col" className="px-6 py-3">Tipo</th>
                                    <th scope="col" className="px-6 py-3">Unidade</th>
                                    <th scope="col" className="px-6 py-3">Custo Atual</th>
                                    <th scope="col" className="px-6 py-3">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {insumos.map((insumo) => (
                                    <tr key={insumo.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                        <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                            {insumo.nome}
                                        </th>
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
            </div>
        </div>
    );
};