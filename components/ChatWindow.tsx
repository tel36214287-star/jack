import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message as MessageType, Sender, AIChatResponse } from '../types';
import { sendMessageToGemini } from '../services/geminiService';
import Message from './Message';
import UserInput from './UserInput';

const ChatWindow: React.FC = () => {
  const [messages, setMessages] = useState<MessageType[]>([
    {
      id: 'initial',
      text: 'Olá! Eu sou a Jack Brito GPT. Como posso te ajudar hoje?',
      sender: Sender.AI,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = useCallback(async (inputText: string) => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: MessageType = {
      id: Date.now().toString(),
      text: inputText,
      sender: Sender.USER,
    };

    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setIsLoading(true);

    try {
      const aiResponse: AIChatResponse = await sendMessageToGemini(inputText);
      let aiMessage: MessageType;

      if (aiResponse.errorMessage) {
        aiMessage = {
          id: (Date.now() + 1).toString(),
          text: aiResponse.errorMessage,
          sender: Sender.AI,
        };
      } else if (aiResponse.imageUrl) {
        aiMessage = {
          id: (Date.now() + 1).toString(),
          imageUrl: aiResponse.imageUrl,
          // If geminiService provides text, use it. Otherwise, generate a default.
          text: aiResponse.text || (inputText.startsWith('/imagem') 
            ? `Aqui está a imagem que criei para você com o prompt: "${inputText.substring('/imagem '.length).trim()}"` 
            : `Aqui está a imagem que editei para você!`), // Default for edits
          sender: Sender.AI,
        };
      } else { // Default to text response
        aiMessage = {
          id: (Date.now() + 1).toString(),
          text: aiResponse.text || "Não recebi uma resposta válida.",
          sender: Sender.AI,
          sources: aiResponse.sources,
        };
      }
      setMessages((prevMessages) => [...prevMessages, aiMessage]);
    } catch (error) {
      const errorMessage: MessageType = {
        id: (Date.now() + 1).toString(),
        text: "Desculpe, ocorreu um erro inesperado ao processar sua solicitação. Tente novamente.",
        sender: Sender.AI,
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col bg-[var(--color-bg-secondary)] rounded-md shadow-2xl border-2 border-[var(--color-border)] overflow-hidden" 
         style={{ boxShadow: '0 0 25px var(--color-border), inset 0 0 15px var(--color-chat-inset-shadow)'}}>
      <div className="flex-grow p-4 overflow-y-auto space-y-6">
        {messages.map((msg) => (
          <Message key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <Message message={{ id: 'loading', text: '', sender: Sender.AI }} isLoading={true} />
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 bg-[var(--color-bg-secondary)] border-t-2 border-[var(--color-border)]">
        <UserInput onSendMessage={handleSendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default ChatWindow;