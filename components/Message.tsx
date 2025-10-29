import React, { useState, useMemo } from 'react';
import { Message as MessageType, Sender } from '../types';
import CodeRenderer from './CodeRenderer';
import PythonRenderer from './PythonRenderer';

interface MessageProps {
  message: MessageType;
  isLoading?: boolean;
}

const LoadingIndicator: React.FC = () => (
  <div className="flex items-center space-x-1 p-2">
    <div className="w-2.5 h-2.5 bg-[var(--color-accent)] rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
    <div className="w-2.5 h-2.5 bg-[var(--color-accent)] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
    <div className="w-2.5 h-2.5 bg-[var(--color-accent)] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
  </div>
);

const Avatar: React.FC<{ sender: Sender }> = ({ sender }) => {
  const avatarClasses = sender === Sender.USER
    ? 'border-[var(--color-accent)] ml-3'
    : 'border-[var(--color-border)] mr-3';
  
  const textColor = 'text-[var(--color-text-primary)]';

  return (
    <div className={`w-10 h-10 border-2 flex items-center justify-center font-bold text-lg flex-shrink-0 bg-black/30 ${avatarClasses} ${textColor} font-[var(--font-primary)]`}
      style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} // Hexagon
    >
      {sender === Sender.USER ? 'U' : 'J'}
    </div>
  );
};

// Refactor ParsedPart to be a discriminated union
interface TextPart {
    type: 'text';
    content: string;
}

interface CodePart {
    type: 'code';
    content: string;
    lang: string; // `lang` is now mandatory for code blocks
}

type ParsedPart = TextPart | CodePart;

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125H9.375a1.125 1.125 0 01-1.125-1.125v-3.375m-1.5-1.5h11.25B7.5 10.5h-11.25c-.621 0-1.125-.504-1.125-1.125V5.25c0-.621.504-1.125 1.125-1.125h11.25c.621 0 1.125.504 1.125 1.125v3.375c0 .621-.504 1.125-1.125 1.125zm-1.5 1.5l1.125 1.125a1.5 1.5 0 002.121 0L17.25 12"></path>
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ParsedMessageContent: React.FC<{ parts: ParsedPart[] }> = ({ parts }) => {
  const [copiedStatus, setCopiedStatus] = useState<Record<number, boolean>>({}); // Map index to boolean (isCopied)

  const handleCopyCode = async (codeContent: string, index: number) => {
    try {
      await navigator.clipboard.writeText(codeContent);
      setCopiedStatus(prev => ({ ...prev, [index]: true }));
      setTimeout(() => {
        setCopiedStatus(prev => ({ ...prev, [index]: false }));
      }, 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err);
      // Optionally, show an error message to the user
    }
  };

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'text' && part.content) {
          return <p key={index} className="whitespace-pre-wrap break-words">{part.content}</p>;
        }
        if (part.type === 'code' && part.content) {
          return (
            <div key={index} className="my-2 bg-[var(--color-bg-primary)] rounded-md overflow-hidden border border-[var(--color-border)] relative group">
              <div className="bg-[rgba(0,0,0,0.2)] px-4 py-1 text-xs text-[var(--color-text-secondary)] font-[var(--font-code)] flex justify-between items-center">
                <span>{part.lang}</span>
                <button
                  onClick={() => handleCopyCode(part.content, index)}
                  className="p-1 text-[var(--color-text-secondary)] rounded-md hover:bg-[var(--color-accent)] hover:text-[var(--color-text-primary)] transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1"
                  aria-label="Copiar código para a área de transferência"
                  title="Copiar Código"
                >
                  {copiedStatus[index] ? (
                    <>
                      <CheckIcon /> Copiado!
                    </>
                  ) : (
                    <>
                      <CopyIcon /> Copiar
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 text-sm text-[var(--color-text-primary)] overflow-x-auto font-[var(--font-code)]">
                <code>{part.content}</code>
              </pre>
            </div>
          );
        }
        return null;
      })}
    </>
  );
};

interface WebRenderUnit {
  type: 'web';
  html: string;
  css: string;
  js: string;
}

interface JsRenderUnit {
  type: 'js';
  js: string;
}

interface JsonRenderUnit {
  type: 'json';
  json: string;
  id: string;
}

interface PythonRenderUnit {
  type: 'python';
  python: string;
  id: string;
}

const Message: React.FC<MessageProps> = ({ message, isLoading = false }) => {
  const isUser = message.sender === Sender.USER;
  const [imageLoading, setImageLoading] = useState(true); // State for image loading

  // Reset imageLoading state if a new image URL arrives
  React.useEffect(() => {
    if (message.imageUrl) {
      setImageLoading(true);
    }
  }, [message.imageUrl]);

  const [renderingState, setRenderingState] = useState<Record<string, boolean>>({});

  const { parsedParts, webUnit, jsUnit, jsonUnits, pythonUnits } = useMemo(() => {
    // Only parse text if it exists
    if (!message.text) {
      return { parsedParts: [], webUnit: null, jsUnit: null, jsonUnits: [], pythonUnits: [] };
    }

    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    const parts: ParsedPart[] = [];
    let lastIndex = 0;
    let match;
    const text = message.text;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: text.substring(lastIndex, match.index).trim() });
      }
      // Ensure `lang` is always a string for CodePart
      parts.push({ type: 'code', lang: match[1]?.toLowerCase() || 'plaintext', content: match[2].trim() });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.substring(lastIndex).trim() });
    }
    
    // Ensure `finalParts` is typed as `ParsedPart[]`
    const finalParts: ParsedPart[] = parts.length > 0 ? parts : [{ type: 'text', content: text }];
    
    // Filter for CodePart explicitly
    const allCodeParts = finalParts.filter((p): p is CodePart => p.type === 'code');
  
    const html = allCodeParts.filter(p => p.lang === 'html').map(p => p.content).join('\n\n');
    const css = allCodeParts.filter(p => p.lang === 'css').map(p => p.content).join('\n\n');
    const js = allCodeParts.filter(p => (p.lang === 'javascript' || p.lang === 'js')).map(p => p.content).join('\n\n');
    
    let webUnitResult: WebRenderUnit | null = null;
    let jsUnitResult: JsRenderUnit | null = null;

    if (html || css) {
      webUnitResult = { type: 'web', html, css, js };
    } else if (js) {
      jsUnitResult = { type: 'js', js };
    }

    const jsonUnitsResult: JsonRenderUnit[] = allCodeParts
      .filter(p => p.lang === 'json')
      .map((p, index) => ({
        type: 'json',
        json: p.content,
        id: `json-${message.id}-${index}`
      }));

    const pythonUnitsResult: PythonRenderUnit[] = allCodeParts
      .filter(p => p.lang === 'python')
      .map((p, index) => ({
        type: 'python',
        python: p.content,
        id: `python-${message.id}-${index}`
      }));
      
    return { parsedParts: finalParts, webUnit: webUnitResult, jsUnit: jsUnitResult, jsonUnits: jsonUnitsResult, pythonUnits: pythonUnitsResult };
  }, [message.text, message.id]);

  const toggleRenderer = (id: string) => {
    setRenderingState(prev => ({...prev, [id]: !prev[id]}));
  };

  const wrapperClasses = isUser ? 'flex justify-end' : 'flex justify-start';
  const bubbleClasses = isUser
    ? 'bg-[var(--color-user-bubble)] border-2 text-white'
    : 'bg-[var(--color-ai-bubble)] border-2 text-[var(--color-text-primary)]';
  
  // More aggressive, fractured-panel like clip paths
  const userClipPath = 'polygon(0% 0%, 100% 0%, 100% 85%, 85% 100%, 0% 100%, 0% 15%)';
  const aiClipPath = 'polygon(15% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 15%)';

  const hasRenderables = !isUser && (webUnit || jsUnit || jsonUnits.length > 0 || pythonUnits.length > 0);
  const hasSources = !isUser && message.sources && message.sources.length > 0;

  return (
    <div className={`w-full flex items-start ${wrapperClasses}`}>
      {!isUser && <Avatar sender={Sender.AI} />}
      <div className="flex flex-col max-w-full w-full sm:max-w-md lg:max-w-xl"> {/* max-w adjusted for responsiveness */}
        <div 
          className={`p-4 shadow-md ${bubbleClasses} ${isUser ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]'}`}
          style={{ 
            clipPath: isUser ? userClipPath : aiClipPath,
            textShadow: isUser ? '0 0 3px rgba(0,0,0,0.8), 0 0 5px var(--color-accent)' : '0 0 3px rgba(0,0,0,0.8), 0 0 5px var(--color-border)',
          }}
        >
          {isLoading ? <LoadingIndicator /> : (
            <>
              {message.text && <ParsedMessageContent parts={parsedParts} />}
              {message.imageUrl && (
                <div className="relative mt-2 max-w-full h-auto border border-[var(--color-border)] rounded-md overflow-hidden">
                  {imageLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] text-sm animate-pulse">
                      <div className="w-8 h-8 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mb-2"></div>
                      Carregando imagem...
                    </div>
                  )}
                  <img 
                    src={message.imageUrl} 
                    alt={message.text || "Generated image"} 
                    className={`max-w-full h-auto rounded-md transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`} 
                    onLoad={() => setImageLoading(false)}
                    onError={() => { 
                      setImageLoading(false); 
                      // Optionally, update the message to show an error state for the image specifically
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {(hasRenderables || hasSources) && (
          <div className="mt-2 flex flex-col items-start gap-3">
            {hasRenderables && (
                <div className="flex flex-wrap gap-2 justify-start">
                    {webUnit && (
                        <button 
                            onClick={() => toggleRenderer('web')}
                            className="px-3 py-1.5 text-xs font-semibold text-[var(--color-accent)] bg-[var(--color-ai-bubble)] border border-[var(--color-border)] rounded-md hover:bg-[var(--color-accent-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                            {renderingState['web'] ? 'Fechar Web' : 'Renderizar Web'}
                        </button>
                    )}
                    {jsUnit && (
                        <button 
                            onClick={() => toggleRenderer('js')}
                            className="px-3 py-1.5 text-xs font-semibold text-[var(--color-accent)] bg-[var(--color-ai-bubble)] border border-[var(--color-border)] rounded-md hover:bg-[var(--color-accent-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                            {renderingState['js'] ? 'Fechar JS' : 'Executar JS'}
                        </button>
                    )}
                    {jsonUnits.map((unit, index) => (
                        <button 
                            key={unit.id}
                            onClick={() => toggleRenderer(unit.id)}
                            className="px-3 py-1.5 text-xs font-semibold text-[var(--color-accent)] bg-[var(--color-ai-bubble)] border border-[var(--color-border)] rounded-md hover:bg-[var(--color-accent-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                            {renderingState[unit.id] ? `Fechar JSON ${index + 1}` : `Renderizar JSON ${index + 1}`}
                        </button>
                    ))}
                    {pythonUnits.map((unit, index) => (
                        <button 
                            key={unit.id}
                            onClick={() => toggleRenderer(unit.id)}
                            className="px-3 py-1.5 text-xs font-semibold text-[var(--color-accent)] bg-[var(--color-ai-bubble)] border border-[var(--color-border)] rounded-md hover:bg-[var(--color-accent-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                            {renderingState[unit.id] ? `Fechar Python ${index + 1}` : `Executar Python ${index + 1}`}
                        </button>
                    ))}
                </div>
            )}
            {hasSources && (
              <div className="text-xs text-[var(--color-text-secondary)] w-full">
                <h4 className="font-semibold text-[var(--color-text-primary)] mb-1">Fontes:</h4>
                <ul className="list-disc list-inside space-y-1 mt-1 pl-4">
                  {message.sources?.map((source, index) => (
                    <li key={index}>
                      <a 
                        href={source.uri} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="underline hover:text-[var(--color-accent)] transition-colors"
                        title={source.uri}
                      >
                        {source.title || source.uri}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {webUnit && renderingState['web'] && (
          <div className="mt-2 w-full">
            <CodeRenderer htmlCode={webUnit.html} cssCode={webUnit.css} jsCode={webUnit.js} jsonCode="" />
          </div>
        )}
        {jsUnit && renderingState['js'] && (
          <div className="mt-2 w-full">
            <CodeRenderer htmlCode="" cssCode="" jsCode={jsUnit.js} jsonCode="" />
          </div>
        )}
        {jsonUnits.map(unit => (
          renderingState[unit.id] && (
            <div key={`${unit.id}-renderer`} className="mt-2 w-full">
              <CodeRenderer htmlCode="" cssCode="" jsCode="" jsonCode={unit.json} />
            </div>
          )
        ))}
        {pythonUnits.map(unit => (
          renderingState[unit.id] && (
            <div key={`${unit.id}-renderer`} className="mt-2 w-full">
              <PythonRenderer pythonCode={unit.python} />
            </div>
          )
        ))}
      </div>
      {isUser && <Avatar sender={Sender.USER} />}
    </div>
  );
};

export default Message;