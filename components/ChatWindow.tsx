
import React, { useRef, useEffect } from 'react';
import { SpinnerIcon, PaperAirplaneIcon, XMarkIcon, LightBulbIcon } from './Icons';

type Message = {
    role: 'user' | 'model';
    text: string;
};

interface ChatWindowProps {
    isOpen: boolean;
    onClose: () => void;
    history: Message[];
    input: string;
    onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSend: (e: React.FormEvent) => void;
    isLoading: boolean;
    isThinkingMode: boolean;
    onThinkingModeChange: (enabled: boolean) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ isOpen, onClose, history, input, onInputChange, onSend, isLoading, isThinkingMode, onThinkingModeChange }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [history, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-24 right-5 w-full max-w-sm h-full max-h-[calc(100vh-8rem)] bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/60 ring-1 ring-slate-400/30 z-[100] flex flex-col overflow-hidden animate-slide-up">
            <header className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
                <h3 className="font-semibold text-slate-200">שוחח עם Gemini</h3>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2" title={isThinkingMode ? "מצב חשיבה מתקדם מופעל (Gemini 2.5 Pro)" : "מצב חשיבה רגיל (Gemini 2.5 Flash)"}>
                    <LightBulbIcon className={`h-5 w-5 transition-colors ${isThinkingMode ? 'text-yellow-400' : 'text-slate-500'}`} />
                    <span className={`text-xs font-medium transition-colors ${isThinkingMode ? 'text-slate-200' : 'text-slate-500'}`}>מצב חשיבה</span>
                    <button
                        onClick={() => onThinkingModeChange(!isThinkingMode)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                        isThinkingMode ? 'bg-purple-600' : 'bg-slate-700'
                        }`}
                        aria-pressed={isThinkingMode}
                    >
                        <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isThinkingMode ? 'translate-x-5' : 'translate-x-0'
                        }`}
                        />
                    </button>
                    </div>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>
            </header>
            <div className="flex-grow p-4 overflow-y-auto space-y-4">
                {history.length === 0 && !isLoading && (
                    <div className="text-center text-slate-500 h-full flex flex-col justify-center items-center">
                        <p>אפשר לשאול אותי כל דבר!</p>
                        <p className="text-xs mt-1">לשאלות מורכבות, הפעילו "מצב חשיבה".</p>
                    </div>
                )}
                {history.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl ${msg.role === 'user' ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-br-lg' : 'bg-slate-700/50 text-slate-200 rounded-bl-lg'}`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                         <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl bg-slate-700/50 text-slate-200 rounded-bl-lg">
                             <div className="flex items-center gap-2">
                                 <SpinnerIcon className="h-4 w-4 animate-spin" />
                                 <span className="text-sm">חושב...</span>
                             </div>
                         </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <footer className="p-4 border-t border-white/10 flex-shrink-0">
                <form onSubmit={onSend} className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={onInputChange}
                        placeholder="שאל אותי משהו..."
                        className="flex-grow bg-slate-800/50 border-slate-700 rounded-full shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-slate-200 placeholder-slate-500 px-4 py-2"
                        disabled={isLoading}
                    />
                    <button type="submit" className="p-2.5 rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors" disabled={isLoading || !input.trim()}>
                        <PaperAirplaneIcon className="h-5 w-5" />
                    </button>
                </form>
            </footer>
             <style>{`
              @keyframes slide-up {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
              }
              .animate-slide-up {
                animation: slide-up 0.3s ease-out forwards;
              }
            `}</style>
        </div>
    );
};