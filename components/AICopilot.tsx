'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useVoiceAgent, VoiceAgentCallbacks, CalendarContext } from '@/hooks/useVoiceAgent';
import {
  SolarLightbulbLinear,
  SolarChatRoundLinear,
  SolarTrashBinLinear,
  SolarCloseLinear,
  SolarMicrophone,
  SolarVolume,
  SolarLetterLinear,
} from '@/components/SolarIcons';
import { AIBriefPanel, GeneratedActivity } from '@/components/AIBriefPanel';

export type CopilotTab = 'chat' | 'brief';

interface AICopilotProps {
  calendarId: string;
  isOpen: boolean;
  onClose: () => void;
  voiceCallbacks?: VoiceAgentCallbacks;
  voiceContext?: CalendarContext | null;
  swimlanes: Array<{ id: string; name: string }>;
  onApplyBrief: (activities: GeneratedActivity[]) => void;
  initialTab?: CopilotTab;
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

export function AICopilot({ calendarId, isOpen, onClose, voiceCallbacks, voiceContext, swimlanes, onApplyBrief, initialTab }: AICopilotProps) {
  const [activeTab, setActiveTab] = useState<CopilotTab>(initialTab || 'chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Respond to initialTab changes (e.g. voice agent triggers "open brief")
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

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
    if (isOpen && activeTab === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, activeTab]);

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
        <div className="px-4 py-3 border-b border-card-border bg-card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent-purple/10 flex items-center justify-center">
                <SolarLightbulbLinear className="w-4 h-4 text-accent-purple" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">AI Copilot</h2>
                {statusLabel && (
                  <p className="text-[10px] text-muted-foreground">{statusLabel}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {activeTab === 'chat' && messages.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="p-1.5 text-gray-400 hover:text-foreground transition-colors rounded-md hover:bg-muted"
                  aria-label="Clear conversation"
                  title="Clear conversation"
                >
                  <SolarTrashBinLinear className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                aria-label="Close copilot"
                className="p-1.5 text-gray-400 hover:text-foreground transition-colors rounded-md hover:bg-muted"
              >
                <SolarCloseLinear className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'chat'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <SolarChatRoundLinear className="w-3.5 h-3.5" />
              Chat
            </button>
            <button
              onClick={() => setActiveTab('brief')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'brief'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <SolarLightbulbLinear className="w-3.5 h-3.5" />
              Brief
            </button>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'chat' ? (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.length === 0 && !isAnyLoading && (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <div className="w-12 h-12 rounded-full bg-accent-purple/10 flex items-center justify-center mx-auto mb-3">
                      <SolarChatRoundLinear className="w-6 h-6 text-accent-purple" />
                    </div>
                    <p className="text-sm text-foreground font-medium">AI Copilot</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                      Ask questions about your campaigns or use voice to take actions.
                      {voice.isSupported && hasVoice && ' Tap the mic button to speak a command.'}
                    </p>
                  </div>

                  {/* CTA Card for AI Brief */}
                  <button
                    onClick={() => setActiveTab('brief')}
                    className="w-full text-left p-3 rounded-lg border border-accent-purple/20 bg-accent-purple/5 hover:bg-accent-purple/10 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent-purple/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <SolarLightbulbLinear className="w-4 h-4 text-accent-purple" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">Plan a Campaign with AI Brief</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                          Describe your goal and get a full plan of activities, dates, and costs.
                        </p>
                        <span className="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wider text-accent-purple group-hover:underline">
                          Start Brief &rarr;
                        </span>
                      </div>
                    </div>
                  </button>

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
                        <SolarMicrophone className="w-3 h-3 text-white/70" />
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
                      <SolarVolume className="w-5 h-5" />
                    ) : (
                      <SolarMicrophone className="w-5 h-5" />
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
                  <SolarLetterLinear className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Brief tab */
          <AIBriefPanel
            calendarId={calendarId}
            swimlanes={swimlanes}
            onApply={onApplyBrief}
          />
        )}
      </div>
    </>
  );
}
