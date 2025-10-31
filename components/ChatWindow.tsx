
import React, { useRef, useEffect, useState } from 'react';
import { SpinnerIcon, PaperAirplaneIcon, XMarkIcon, TrophyIcon, ClipboardIcon, CheckIcon, ArrowCounterClockwiseIcon } from './Icons';

type Message = {
    role: 'user' | 'model';
    text: string;
};

interface ChatWindowProps {
    isOpen: boolean;
    onClose: () => void;
    history: Message[];
    onSend: (message: string) => void;
    isLoading: boolean;
    isThinkingMode: boolean;
    onThinkingModeChange: (enabled: boolean) => void;
    onClear: () => void;
}

const ThinkingIndicator = () => (
    <div className="flex justify-start">
        <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl bg-slate-800/80 rounded-bl-lg">
            <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 bg-slate-400 rounded-full thinking-dot"></div>
                <div className="h-2 w-2 bg-slate-400 rounded-full thinking-dot"></div>
                <div className="h-2 w-2 bg-slate-400 rounded-full thinking-dot"></div>
            </div>
        </div>
    </div>
);

const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="chat-code-block">
            <div className="code-header">
                <span>{language || 'code'}</span>
                <button onClick={handleCopy} className="flex items-center gap-1.5 px-2 py-1 -my-1 rounded-md text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
                    {copied ? <CheckIcon className="h-3 w-3 text-green-400" /> : <ClipboardIcon className="h-3 w-3" />}
                    <span className="text-xs">{copied ? 'הועתק!' : 'העתק'}</span>
                </button>
            </div>
            <pre>
                <code className={`language-${language}`}>{code}</code>
            </pre>
        </div>
    );
};

const renderMarkdown = (text: string) => {
    const processInlineMarkdown = (line: string) => {
        return line
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code class="bg-slate-700/50 text-slate-200 font-mono px-1.5 py-0.5 rounded-md text-sm">$1</code>');
    };

    const parts = text.split(/(```[\s\S]*?```)/g).filter(Boolean);

    return parts.map((part, index) => {
        if (part.startsWith('```')) {
            const content = part.replace(/^```|```$/g, '').trim();
            const firstLineEnd = content.indexOf('\n');
            const language = firstLineEnd === -1 ? '' : content.substring(0, firstLineEnd).trim();
            const code = firstLineEnd === -1 ? content : content.substring(firstLineEnd + 1);
            return <CodeBlock key={index} language={language} code={code} />;
        }

        const lines = part.trim().split('\n');
        // FIX: Cannot find namespace 'JSX'.
        const elements: React.ReactElement[] = [];
        // FIX: Cannot find namespace 'JSX'.
        let currentList: React.ReactElement[] = [];

        const flushList = () => {
            if (currentList.length > 0) {
                elements.push(<ul key={`ul-${elements.length}-${index}`} className="list-disc list-outside pr-5 space-y-1 my-2">{currentList}</ul>);
                currentList = [];
            }
        };

        lines.forEach((line, lineIndex) => {
            if (line.trim().startsWith('- ')) {
                const itemContent = line.trim().substring(2);
                currentList.push(<li key={`li-${lineIndex}`} dangerouslySetInnerHTML={{ __html: processInlineMarkdown(itemContent) }} />);
            } else {
                flushList();
                if (line.trim()) {
                     elements.push(<p key={`p-${lineIndex}`} dangerouslySetInnerHTML={{ __html: processInlineMarkdown(line) }} />);
                }
            }
        });
        
        flushList();

        return <div key={index} className="chat-bubble-content space-y-2">{elements}</div>;
    });
};

export const ChatWindow: React.FC<ChatWindowProps> = ({ isOpen, onClose, history, onSend, isLoading, isThinkingMode, onThinkingModeChange, onClear }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [input, setInput] = useState('');

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            setTimeout(() => textareaRef.current?.focus(), 100);
        }
    }, [history, isOpen, isLoading]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSend(input);
            setInput('');
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(e);
        }
    };
    
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`; // Max height of 128px (8rem)
        }
    }, [input]);

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-24 right-5 w-full max-w-sm h-full max-h-[calc(100vh-8rem)] bg-gradient-to-br from-slate-900 via-slate-950 to-black backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/60 ring-1 ring-slate-400/30 z-[100] flex flex-col overflow-hidden animate-slide-up">
            <header className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
                <h3 className="font-semibold text-slate-200">שוחח עם Gemini</h3>
                <div className="flex items-center gap-2">
                    <button onClick={onClear} className="p-1 text-slate-400 hover:text-white transition-colors" title="נקה שיחה">
                        <ArrowCounterClockwiseIcon className="h-5 w-5" />
                    </button>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors" title="סגור חלון">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>
            </header>
            <div className="flex-grow p-4 overflow-y-auto space-y-4 chat-history-scrollbar">
                {history.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl ${msg.role === 'user' ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-br-lg' : 'bg-slate-800/80 text-slate-300 rounded-bl-lg'}`}>
                            <div className="text-sm prose prose-invert prose-sm max-w-none">{renderMarkdown(msg.text)}</div>
                        </div>
                    </div>
                ))}
                {isLoading && <ThinkingIndicator />}
                <div ref={messagesEndRef} />
            </div>
            <footer className="p-3 border-t border-white/10 flex-shrink-0 bg-slate-950/50">
                 <div className="px-1 mb-2">
                    <label
                        htmlFor="thinking-mode-toggle"
                        className="flex items-center justify-between w-full cursor-pointer p-2 rounded-lg transition-colors hover:bg-slate-800/50"
                        title={isThinkingMode ? "Gemini 2.5 Pro (יצירתי יותר, איטי יותר)" : "Gemini 2.5 Flash (מהיר ויעיל)"}
                    >
                        <div className="flex items-center gap-3">
                            <TrophyIcon className={`h-5 w-5 transition-colors ${isThinkingMode ? 'text-yellow-400' : 'text-slate-500'}`} />
                            <span className={`text-sm font-medium transition-colors ${isThinkingMode ? 'text-slate-200' : 'text-slate-400'}`}>מצב חשיבה מתקדם</span>
                        </div>

                        <div className="relative">
                            <input
                                id="thinking-mode-toggle"
                                type="checkbox"
                                className="sr-only peer"
                                checked={isThinkingMode}
                                onChange={() => onThinkingModeChange(!isThinkingMode)}
                                aria-label="מצב חשיבה מתקדם"
                            />
                            <div className="w-12 h-7 bg-slate-700 rounded-full peer-checked:bg-purple-600 transition-colors duration-300"></div>
                            <div className="absolute top-1 right-1 bg-white rounded-full h-5 w-5 shadow transform transition-transform duration-300 ease-in-out peer-checked:-translate-x-5"></div>
                        </div>
                    </label>
                </div>
                <form onSubmit={handleSend} className="flex items-start gap-2">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="שאל אותי משהו..."
                        className="flex-grow bg-slate-800/50 border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm text-slate-200 placeholder-slate-500 px-4 py-2 resize-none"
                        disabled={isLoading}
                        rows={1}
                    />
                    <button type="submit" className="p-2.5 rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors self-end flex-shrink-0" disabled={isLoading || !input.trim()}>
                        <PaperAirplaneIcon className="h-5 w-5" />
                    </button>
                </form>
            </footer>
             <style>{`
              @keyframes slide-up {
                from { opacity: 0; transform: translateY(20px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
              }
              .animate-slide-up {
                animation: slide-up 0.3s cubic-bezier(0.25, 1, 0.5, 1) forwards;
              }
            `}</style>
        </div>
    );
};
