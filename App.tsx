"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DashboardView } from './components/Dashboard';
import { WorkspaceView } from './components/Workspace';
import { ProjectDetailView } from './components/ProjectDetailView';
import { AnalysisView } from './components/AnalysisView';
import { AskView } from './components/AskView';
import { DataMasterView } from './components/DataMasterView';
import { SettingsView } from './components/SettingsView';
import { Modal, Button, SparklesIcon, MicIcon, Spinner, PlusIcon, SearchIcon, MoonIcon, SunIcon, ClipboardIcon } from './components/Shared';
import type { Project, Message, ReturnHistoryItem, Insumo, ParsedAnalysis } from './types';
import { Priority, KanbanStatus } from './types';
import { streamChat, createTranscriptionSession } from './services/geminiService';
import { mockProjects, mockInsumos } from './services/mockData';

type ActivePage = 'dashboard' | 'ask' | 'analysis' | 'datamaster' | 'settings';
type CurrentView = 'page' | 'workspace' | 'project-details';


// --- THEME TOGGLE ---
const ThemeToggle = () => {
    // Initialize state to null to ensure server and client render the same initial UI
    const [theme, setTheme] = useState<'light' | 'dark' | null>(null);

    // On client-side mount, determine the theme from localStorage or system preference
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            setTheme('dark');
        } else {
            setTheme('light');
        }
    }, []);

    // When theme state changes, update the document and localStorage
    useEffect(() => {
        if (theme) {
            if (theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            localStorage.setItem('theme', theme);
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    // Render a placeholder or nothing until the theme is determined on the client
    if (theme === null) {
        return <div className="w-10 h-10 rounded-full" />; // Placeholder to prevent layout shift
    }

    return (
        <Button onClick={toggleTheme} variant="ghost" className="rounded-full !p-2">
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </Button>
    );
};


// --- SIDEBAR ---
const Sidebar = ({ onNewProject, activePage, onNavigate }: { onNewProject: () => void; activePage: ActivePage; onNavigate: (page: ActivePage) => void; }) => {
    const navItems = [
        { id: 'ask', label: 'Home / Ask Quantisa', icon: <SearchIcon className="mr-3 w-5 h-5"/> },
        { id: 'analysis', label: 'Comece Por Aqui / Análise', icon: <span className="mr-3 text-lg">⚡</span> },
        { id: 'dashboard', label: 'Dashboard (Kanban)', icon: <span className="mr-3 text-lg">📊</span> },
        { id: 'datamaster', label: 'Data Master', icon: <span className="mr-3 text-lg">🗄️</span> },
        { id: 'settings', label: 'Settings', icon: <span className="mr-3 text-lg">⚙️</span> },
    ];

    return (
    <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-screen flex-shrink-0">
        <div className="p-4 h-16 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
             <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center font-bold text-white text-xl flex-shrink-0">Q</div>
            <h1 className="text-2xl font-bold text-primary dark:text-indigo-400">Quantisa</h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
             {navItems.map(item => (
                <a 
                    key={item.id}
                    href="#" 
                    onClick={(e) => { e.preventDefault(); onNavigate(item.id as ActivePage); }}
                    className={`flex items-center p-2 text-sm rounded-md transition-colors ${
                        activePage === item.id 
                        ? 'font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700' 
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                >
                    {item.icon} {item.label}
                </a>
            ))}
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Button onClick={onNewProject} className="w-full !bg-primary !hover:bg-indigo-700">
                <PlusIcon className="w-5 h-5 mr-2" />
                Novo Orçamento
            </Button>
        </div>
    </div>
    );
};


// --- NEW PROJECT FORM ---
const NewProjectForm = ({ onSave, onCancel, initialData }: { onSave: (project: Omit<Project, 'id' | 'status' | 'resumo_tecnico' | 'data_entrada' | 'services' | 'doubts' | 'keyMaterials' | 'valueEngineering' | 'preliminaryRisks'>) => void; onCancel: () => void; initialData?: ParsedAnalysis }) => {
    const [formData, setFormData] = useState({
        nome: initialData?.projectName || '',
        cliente: initialData?.clientName || '',
        data_limite: initialData?.deadline || new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
        prioridade: initialData?.priority || Priority.Medium,
        briefing: initialData?.briefingSummary || ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!formData.nome || !formData.data_limite) {
            alert("Nome do Projeto e Data Limite são obrigatórios.");
            return;
        }
        onSave(formData);
    };
    
    const inputClasses = "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400 p-3";

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nome do Projeto</label>
                <input type="text" name="nome" value={formData.nome} onChange={handleChange} required className={inputClasses}/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cliente</label>
                <input type="text" name="cliente" value={formData.cliente} onChange={handleChange} className={inputClasses}/>
            </div>
             <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data de Entrada</label>
                    <input type="date" name="data_entrada" value={new Date().toISOString().split('T')[0]} readOnly className={`${inputClasses} bg-gray-100 dark:bg-gray-700/50`}/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data Limite para Envio</label>
                    <input type="date" name="data_limite" value={formData.data_limite} onChange={handleChange} required className={inputClasses}/>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Prioridade</label>
                <select name="prioridade" value={formData.prioridade} onChange={handleChange} className={inputClasses}>
                    {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Briefing e Contexto do Projeto (Opcional)</label>
                <textarea name="briefing" rows={4} value={formData.briefing} onChange={handleChange} className={`${inputClasses} resize-y`} placeholder="Descreva o contexto, restrições, expectativas..."></textarea>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
                <Button type="submit">Salvar e Criar Tarefa</Button>
            </div>
        </form>
    );
};

// --- ADD RETURN FORM ---
const AddReturnForm = ({ onSave, onCancel }: { onSave: (notes: string) => void; onCancel: () => void; }) => {
    const [notes, setNotes] = useState('');
    return (
        <form onSubmit={(e) => { e.preventDefault(); onSave(notes); }}>
            <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                className="w-full p-2 border rounded-md bg-white text-gray-900 border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                placeholder="Digite as anotações do retorno..."
                required
            />
            <div className="flex justify-end space-x-2 mt-4">
                <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
                <Button type="submit">Salvar Retorno</Button>
            </div>
        </form>
    );
}

// --- CHATBOT ---
const ChatBot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [usePro, setUsePro] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;
        const newMessages: Message[] = [...messages, { role: 'user', text: input }];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        const modelResponse: Message = { role: 'model', text: '' };
        setMessages(prev => [...prev, modelResponse]);
        
        try {
            const stream = await streamChat(messages, input, usePro);
            for await (const chunk of stream) {
                modelResponse.text += chunk;
                setMessages(prev => [...prev.slice(0, -1), { ...modelResponse, thinking: usePro && modelResponse.text === '' }]);
            }
        } catch (error) {
            console.error(error);
            modelResponse.text = "Desculpe, ocorreu um erro.";
            setMessages(prev => [...prev.slice(0, -1), modelResponse]);
        } finally {
            setIsLoading(false);
             setMessages(prev => [...prev.slice(0, -1), { ...modelResponse, thinking: false }]);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 bg-primary text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-transform hover:scale-110 z-30"
                aria-label="Open AI Assistant"
            >
                <SparklesIcon />
            </button>
            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Quantisa AI Assistant">
                <div className="flex flex-col h-[60vh]">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`p-3 rounded-lg max-w-lg ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200'}`}>
                                    {msg.thinking && <div className="flex items-center"><Spinner className="w-5 h-5 mr-2" /><span>Pensando...</span></div>}
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                         <div ref={messagesEndRef} />
                    </div>
                    <div className="p-4 border-t dark:border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                                <input type="checkbox" checked={usePro} onChange={(e) => setUsePro(e.target.checked)} className="rounded text-primary focus:ring-primary" />
                                <span>Usar Gemini 2.5 Pro (Thinking Mode)</span>
                            </label>
                        </div>
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSend()}
                                className="flex-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                placeholder="Pergunte algo..."
                                disabled={isLoading}
                            />
                            <Button onClick={handleSend} isLoading={isLoading}>Enviar</Button>
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    );
};


// --- AUDIO TRANSCRIBER ---
const AudioTranscriber = ({ onCopy }: { onCopy: (message: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [transcription, setTranscription] = useState('');
    const sessionRef = useRef<{ start: () => void; stop: () => void } | null>(null);

    const onMessage = (text: string, isFinal: boolean) => {
        setTranscription(prev => prev + text);
        if (isFinal) {
            setTranscription(prev => prev + ' ');
        }
    };

    const onError = (error: Error) => {
        console.error("Transcription error:", error);
        setTranscription(prev => prev + `\n[ERRO: ${error.message}]`);
        setIsRecording(false);
    };

    useEffect(() => {
        if (isOpen) {
            sessionRef.current = createTranscriptionSession(onMessage, onError);
        }
        return () => {
            sessionRef.current?.stop();
        };
    }, [isOpen]);

    const toggleRecording = () => {
        if (isRecording) {
            sessionRef.current?.stop();
        } else {
            // Do not clear transcription on new recording to preserve user edits
            // setTranscription('');
            sessionRef.current?.start();
        }
        setIsRecording(!isRecording);
    };

    return (
        <>
            <button onClick={() => setIsOpen(true)} className="fixed bottom-24 right-6 bg-success text-white p-4 rounded-full shadow-lg hover:bg-green-600 transition-transform hover:scale-110 z-30" aria-label="Open Audio Transcription">
                <MicIcon />
            </button>
            <Modal isOpen={isOpen} onClose={() => { setIsOpen(false); if(isRecording) toggleRecording(); }} title="Transcrição de Áudio">
                <div className="flex flex-col items-center">
                    <Button onClick={toggleRecording} variant={isRecording ? 'danger' : 'primary'} className="mb-4">
                        {isRecording ? 'Parar Gravação' : 'Iniciar Gravação'}
                    </Button>
                    <div className="w-full h-64 p-2 border rounded-md bg-gray-50 flex flex-col overflow-y-auto dark:bg-gray-700 dark:border-gray-600">
                        <textarea
                            value={transcription}
                            onChange={(e) => setTranscription(e.target.value)}
                            className="flex-grow w-full bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-300 resize-none outline-none rounded-md p-2"
                            placeholder="A transcrição aparecerá aqui..."
                        />
                         <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                            {isRecording ? (
                                <div className="animate-pulse text-danger text-sm flex items-center">
                                    <span className="relative flex h-2 w-2 mr-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                    </span>
                                    Gravando...
                                </div>
                            ) : (
                                <div/>
                            )}
                            {transcription && !isRecording && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        navigator.clipboard.writeText(transcription);
                                        onCopy("Transcrição copiada para a área de transferência!");
                                    }}
                                >
                                    <ClipboardIcon className="w-4 h-4 mr-2" />
                                    Copiar Texto
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    );
};

// --- MAIN HEADER ---
const MainHeader: React.FC<{children?: React.ReactNode}> = ({ children }) => {
    return (
        <header className="flex-shrink-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 flex items-center justify-between h-16">
            {children}
        </header>
    );
};

// --- TOAST NOTIFICATION ---
const Toast = ({ message, onDismiss }: { message: string; onDismiss: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss();
        }, 3000); // Dismiss after 3 seconds

        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg z-[9999] animate-fade-in-down">
            {message}
        </div>
    );
};


// --- APP ---
const App: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [insumos, setInsumos] = useState<Insumo[]>([]);
    const [activePage, setActivePage] = useState<ActivePage>('analysis');
    const [currentView, setCurrentView] = useState<CurrentView>('page');
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [isAddReturnModalOpen, setIsAddReturnModalOpen] = useState(false);
    const [projectForReturn, setProjectForReturn] = useState<Project | null>(null);
    const [analysisForNewProject, setAnalysisForNewProject] = useState<ParsedAnalysis | null>(null);
    const [toastMessage, setToastMessage] = useState<string>('');
    const [workspaceInitialStep, setWorkspaceInitialStep] = useState(0);

    useEffect(() => {
        setProjects(mockProjects);
        setInsumos(mockInsumos);
    }, []);


    const handleSelectProject = (project: Project) => {
        setSelectedProject(project);
        setCurrentView('project-details');
    };

    const handleGoToWorkspace = (project: Project, initialStep: number = 0) => {
        setSelectedProject(project);
        setWorkspaceInitialStep(initialStep);
        setCurrentView('workspace');
    };
    
    const handleNavigate = (page: ActivePage) => {
        setActivePage(page);
        setCurrentView('page');
        setSelectedProject(null);
    };

    const handleBackToDashboard = () => {
        setSelectedProject(null);
        setCurrentView('page');
        setActivePage('dashboard');
    };
    
    const handleBackToDetails = () => {
        setCurrentView('project-details');
    }

    const handleNewProject = () => {
        setAnalysisForNewProject(null);
        setIsNewProjectModalOpen(true);
    };

    const handleSaveNewProject = (newProjectData: Omit<Project, 'id' | 'status' | 'resumo_tecnico' | 'data_entrada' | 'services' | 'doubts' | 'keyMaterials' | 'valueEngineering' | 'preliminaryRisks'>) => {
        const newProject: Project = {
            ...newProjectData,
            id: `proj-${Date.now()}`,
            status: KanbanStatus.Backlog,
            services: analysisForNewProject?.services || [],
            doubts: analysisForNewProject?.doubts || [],
            keyMaterials: analysisForNewProject?.keyMaterials || [],
            valueEngineering: analysisForNewProject?.valueEngineering || [],
            preliminaryRisks: analysisForNewProject?.preliminaryRisks || [],
            resumo_tecnico: newProjectData.briefing?.substring(0, 100) + '...' || 'Novo projeto criado.',
            data_entrada: new Date().toISOString().split('T')[0],
        };
        
        setProjects(prev => [newProject, ...prev]);
        setIsNewProjectModalOpen(false);
        
        if (analysisForNewProject) {
            handleGoToWorkspace(newProject, 1); // Go directly to step 1
            setAnalysisForNewProject(null); // Reset after use
        } else {
            setActivePage('dashboard');
            setCurrentView('page');
        }
    };
    
    const handleAdvanceFromAnalysis = (analysisData: ParsedAnalysis) => {
        setAnalysisForNewProject(analysisData);
        setIsNewProjectModalOpen(true);
    };

    const handleUpdateProject = (updatedProject: Project) => {
        setProjects(prevProjects => prevProjects.map(p => p.id === updatedProject.id ? updatedProject : p));
        if (selectedProject?.id === updatedProject.id) {
            setSelectedProject(updatedProject);
        }
    };

    const handleDeleteProject = (projectId: string) => {
        const project = projects.find(p => p.id === projectId);
        if (project) {
            setProjectToDelete(project);
        }
    };
    
    const confirmDeleteProject = () => {
        if (projectToDelete) {
            setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
            setProjectToDelete(null);
            if(currentView === 'project-details' || currentView === 'workspace') {
                handleBackToDashboard();
            }
        }
    };

    const handleAddReturn = (projectId: string) => {
        const project = projects.find(p => p.id === projectId);
        if (project) {
            setProjectForReturn(project);
            setIsAddReturnModalOpen(true);
        }
    };

    const handleSaveReturn = (notes: string) => {
        if (!projectForReturn) return;

        const newReturn: ReturnHistoryItem = {
            id: `ret-${Date.now()}`,
            date: new Date().toISOString(),
            notes,
        };

        const updateProjectWithReturn = (p: Project) => p.id === projectForReturn.id
                ? { ...p, returns: [...(p.returns || []), newReturn] }
                : p;

        setProjects(prev => prev.map(updateProjectWithReturn));
        
        if (selectedProject?.id === projectForReturn.id) {
             setSelectedProject(prev => prev ? updateProjectWithReturn(prev) : null);
        }

        setIsAddReturnModalOpen(false);
        setProjectForReturn(null);
    };

    const getHeaderTitle = () => {
        const pageTitles: Record<ActivePage, string> = {
            dashboard: "Dashboard (Kanban)",
            ask: "Ask Quantisa",
            analysis: "Iniciar Nova Análise de Escopo",
            datamaster: "Data Master",
            settings: "Settings",
        };
        if (currentView === 'project-details' && selectedProject) return `Detalhes: ${selectedProject.nome}`;
        if (currentView === 'workspace' && selectedProject) return `Workspace: ${selectedProject.nome}`;
        if (isNewProjectModalOpen) return "Criar Novo Orçamento";
        return pageTitles[activePage];
    };

    const renderPageContent = () => {
        switch (activePage) {
            case 'dashboard':
                return <DashboardView projects={projects} setProjects={setProjects} onSelectProject={handleSelectProject} onDeleteProject={handleDeleteProject} />;
            case 'ask':
                return <AskView />;
            case 'analysis':
                return <AnalysisView onAdvance={handleAdvanceFromAnalysis} />;
            case 'datamaster':
                return <DataMasterView insumos={insumos} />;
            case 'settings':
                return <SettingsView insumos={insumos} setInsumos={setInsumos} />;
            default:
                return <div className="p-8"><h2 className="text-2xl dark:text-white">Página de {activePage}</h2></div>;
        }
    }

    const renderCurrentView = () => {
        switch (currentView) {
            case 'project-details':
                return selectedProject ? <ProjectDetailView project={selectedProject} onBack={handleBackToDashboard} onDelete={() => handleDeleteProject(selectedProject.id)} onGoToWorkspace={() => handleGoToWorkspace(selectedProject)} onAddReturn={handleAddReturn} /> : null;
            case 'workspace':
                return selectedProject ? <WorkspaceView project={selectedProject} onBack={handleBackToDetails} updateProject={handleUpdateProject} showToast={setToastMessage} initialStep={workspaceInitialStep} /> : null;
            case 'page':
            default:
                return renderPageContent();
        }
    }

    return (
        <div className="flex h-screen font-sans text-gray-900 bg-light-bg dark:bg-gray-900">
            {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage('')} />}
            <Sidebar onNewProject={handleNewProject} activePage={activePage} onNavigate={handleNavigate} />
            <main className="flex-1 flex flex-col overflow-hidden">
                <MainHeader>
                    {activePage === 'dashboard' && currentView === 'page' ? (
                        <div className="flex items-center justify-between w-full">
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Dashboard (Kanban)</h1>
                            <div className="flex items-center gap-4">
                                <Button onClick={handleNewProject}><PlusIcon className="w-5 h-5 mr-2" /> Novo Orçamento</Button>
                                <ThemeToggle />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between w-full">
                           <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">{getHeaderTitle()}</h1>
                            <div className="flex items-center gap-4">
                               <ThemeToggle />
                           </div>
                       </div>
                    )}
                </MainHeader>
                {renderCurrentView()}
            </main>
            
            <Modal isOpen={isNewProjectModalOpen} onClose={() => setIsNewProjectModalOpen(false)} title="Criar Novo Orçamento">
                <NewProjectForm onSave={handleSaveNewProject} onCancel={() => setIsNewProjectModalOpen(false)} initialData={analysisForNewProject || undefined} />
            </Modal>
            
             <Modal isOpen={!!projectToDelete} onClose={() => setProjectToDelete(null)} title="Confirmar Exclusão" size="md">
                <div>
                    <p className="dark:text-gray-300">Tem certeza que deseja apagar o projeto "{projectToDelete?.nome}"?</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Essa ação não pode ser desfeita.</p>
                    <div className="flex justify-end space-x-2 mt-6">
                        <Button variant="secondary" onClick={() => setProjectToDelete(null)}>Cancelar</Button>
                        <Button variant="danger" onClick={confirmDeleteProject}>Apagar Card</Button>
                    </div>
                </div>
            </Modal>
            
            <Modal isOpen={isAddReturnModalOpen} onClose={() => setIsAddReturnModalOpen(false)} title={`Adicionar Retorno para "${projectForReturn?.nome}"`}>
                <AddReturnForm
                    onSave={handleSaveReturn}
                    onCancel={() => setIsAddReturnModalOpen(false)}
                />
            </Modal>

            <ChatBot />
            <AudioTranscriber onCopy={(message) => setToastMessage(message)} />
        </div>
    );
};

export default App;