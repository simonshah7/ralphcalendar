'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useVoiceAgent, VoiceAgentCallbacks, CalendarContext } from '@/hooks/useVoiceAgent';

interface AICopilotProps {
  calendarId: string;
  isOpen: boolean;
  onClose: () => void;
  voiceCallbacks?: VoiceAgentCallbacks;
  voiceContext?: CalendarContext | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: Record<string, unknown>[];
  source?: 'text' | 'voice';
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  "What's our total budget?",
  'Which campaigns are over budget?',
  'Top performing campaigns',
  'Activities needing metrics',
  'Compare US vs EMEA',
];

const VOICE_SUGGESTIONS = [
  'Create an activity for next week',
  'Switch to dashboard view',
  'How much have we spent?',
];

export function AICopilot({ calendarId, isOpen, onClose, voiceCallbacks, voiceContext }: AICopilotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice agent integration
  const defaultCallbacks: VoiceAgentCallbacks = {
    onCreateActivity: async () => {},
    onUpdateActivity: async () => {},
    onDeleteActivity: async () => {},
    onSwitchView: () => {},
    onSetSearch: () => {},
    onSetCampaignFilter: () => {},
    onSetStatusFilter: () => {},
    onClearFilters: () => {},
    onOpenCopilot: () => {},
    onOpenBriefGenerator: () => {},
  };

  const voice = useVoiceAgent(voiceCallbacks || defaultCallbacks, voiceContext || null);
  const hasVoice = !!voiceCallbacks;

  // Sync voice conversation entries into our messages
  const lastSyncedVoiceCount = useRef(0);
  useEffect(() => {
    if (voice.conversation.length > lastSyncedVoiceCount.current) {
      const newEntries = voice.conversation.slice(lastSyncedVoiceCount.current);
      const newMessages: ChatMessage[] = newEntries.map((entry) => ({
        id: entry.id,
        role: entry.role,
        content: entry.content,
        source: 'voice' as const,
        timestamp: entry.timestamp,
      }));
      setMessages((prev) => [...prev, ...newMessages]);
      lastSyncedVoiceCount.current = voice.conversation.length;
    }
  }, [voice.conversation]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, voice.isProcessing, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Send text message through copilot API (analytics queries)
  const sendTextMessage = async (question: string) => {
    if (!question.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question.trim(),
      source: 'text',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId, question: question.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const result: { answer: string; data?: Record<string, unknown>[] } = await response.json();

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.answer,
        data: result.data,
        source: 'text',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Send a voice command (action) through the voice agent
  const sendVoiceCommand = useCallback((text: string) => {
    if (!text.trim() || voice.isProcessing || isLoading) return;
    // sendToAgent adds entries to voice.conversation, which syncs to our messages
    voice.sendToAgent(text.trim());
  }, [voice, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage(input);
    }
  };

  const handleClearAll = () => {
    setMessages([]);
    voice.clearConversation();
    lastSyncedVoiceCount.current = 0;
  };

  const renderDataTable = (data: Record<string, unknown>[]) => {
    if (!data.length) return null;
    const columns = Object.keys(data[0]);

    return (
      <div className="mt-2 overflow-x-auto rounded border border-card-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-2 py-1.5 text-left font-semibold text-foreground uppercase tracking-wider whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-t border-card-border">
                {columns.map((col) => (
                  <td key={col} className="px-2 py-1.5 text-foreground whitespace-nowrap">
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const isAnyLoading = isLoading || voice.isProcessing;

  const statusLabel = voice.isListening
    ? 'Listening...'
    : voice.isProcessing
    ? 'Thinking...'
    : voice.isSpeaking
    ? 'Speaking...'
    : null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[400px] sm:max-w-full bg-card border-l border-card-border shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-card-border bg-card">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-purple/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">AI Copilot</h2>
              {statusLabel && (
                <p className="text-[10px] text-muted-foreground">{statusLabel}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={handleClearAll}
                className="p-1.5 text-gray-400 hover:text-foreground transition-colors rounded-md hover:bg-muted"
                aria-label="Clear conversation"
                title="Clear conversation"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close copilot"
              className="p-1.5 text-gray-400 hover:text-foreground transition-colors rounded-md hover:bg-muted"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !isAnyLoading && (
            <div className="space-y-4">
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-accent-purple/10 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                </div>
                <p className="text-sm text-foreground font-medium">AI Copilot</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  Ask questions about your campaigns or use voice to take actions.
                  {voice.isSupported && hasVoice && ' Tap the mic button to speak a command.'}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Suggested questions
                </p>
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendTextMessage(q)}
                    className="block w-full text-left px-3 py-2 text-sm text-foreground bg-muted rounded-lg hover:bg-accent-purple/10 hover:text-accent-purple transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {hasVoice && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Voice commands
                  </p>
                  {VOICE_SUGGESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendVoiceCommand(q)}
                      className="block w-full text-left px-3 py-2 text-sm text-foreground bg-muted rounded-lg hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                    >
                      &ldquo;{q}&rdquo;
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 ${
                  msg.role === 'user'
                    ? 'bg-accent-purple text-white'
                    : 'bg-muted text-foreground'
                }`}
              >
                {msg.source === 'voice' && msg.role === 'user' && (
                  <div className="flex items-center gap-1 mb-0.5">
                    <svg className="w-3 h-3 text-white/70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    </svg>
                    <span className="text-[10px] text-white/60">Voice</span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.data && msg.data.length > 0 && renderDataTable(msg.data)}
                <p
                  className={`text-[10px] mt-1 ${
                    msg.role === 'user' ? 'text-white/60' : 'text-gray-400'
                  }`}
                >
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}

          {/* Live transcript while listening */}
          {voice.isListening && voice.transcript && (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-lg px-3 py-2 bg-accent-purple/60 text-white/80">
                <p className="text-sm italic">{voice.transcript}</p>
              </div>
            </div>
          )}

          {isAnyLoading && (
            <div className="flex justify-start">
              <div className="bg-muted text-foreground rounded-lg px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-accent-purple rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-accent-purple rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-accent-purple rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested chips when there are messages */}
        {messages.length > 0 && !isAnyLoading && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS.slice(0, 3).map((q) => (
              <button
                key={q}
                onClick={() => sendTextMessage(q)}
                className="text-[11px] px-2 py-1 rounded-full border border-card-border text-gray-500 dark:text-gray-400 hover:border-accent-purple hover:text-accent-purple transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Voice error display */}
        {voice.error && (
          <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
            <p className="text-xs text-red-500">{voice.error}</p>
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-card-border bg-card">
          <div className="flex items-center gap-2">
            {/* Mic button */}
            {voice.isSupported && hasVoice && (
              <button
                onClick={voice.isSpeaking ? voice.stopSpeaking : voice.toggleListening}
                disabled={isLoading || voice.isProcessing}
                className={`relative flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-50 ${
                  voice.isListening
                    ? 'bg-red-500 text-white'
                    : voice.isSpeaking
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-card-hover'
                }`}
                title={voice.isListening ? 'Stop listening' : voice.isSpeaking ? 'Stop speaking' : 'Start listening'}
              >
                {voice.isListening && (
                  <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-50" />
                )}
                {voice.isSpeaking ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>
            )}

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your campaigns..."
              disabled={isAnyLoading || voice.isListening}
              className="flex-1 px-3 py-2 text-sm border border-card-border rounded-lg bg-background text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-accent-purple disabled:opacity-50"
            />
            <button
              onClick={() => sendTextMessage(input)}
              disabled={!input.trim() || isAnyLoading}
              aria-label="Send message"
              className="px-3 py-2 bg-accent-purple text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
