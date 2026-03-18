'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

type ViewType = 'timeline' | 'calendar' | 'table' | 'dashboard';

export interface VoiceAgentCallbacks {
  onCreateActivity: (data: {
    title: string;
    startDate: string;
    endDate: string;
    swimlaneId: string;
    statusId: string;
    description?: string;
    cost?: number;
    currency?: string;
    region?: string;
    campaignId?: string | null;
  }) => Promise<void>;
  onUpdateActivity: (id: string, updates: Record<string, unknown>) => Promise<void>;
  onDeleteActivity: (id: string) => Promise<void>;
  onSwitchView: (view: ViewType) => void;
  onSetSearch: (query: string) => void;
  onSetCampaignFilter: (id: string | null) => void;
  onSetStatusFilter: (id: string | null) => void;
  onClearFilters: () => void;
  onOpenCopilot: () => void;
  onOpenBriefGenerator: () => void;
}

export interface CalendarContext {
  calendarId: string;
  swimlanes: Array<{ id: string; name: string }>;
  statuses: Array<{ id: string; name: string; color: string }>;
  campaigns: Array<{ id: string; name: string }>;
  activities: Array<{ id: string; title: string; swimlaneId: string; statusId: string; campaignId: string | null }>;
}

export interface ConversationEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

export function useVoiceAgent(
  callbacks: VoiceAgentCallbacks,
  context: CalendarContext | null
) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const callbacksRef = useRef(callbacks);
  const contextRef = useRef(context);

  // Keep refs in sync
  useEffect(() => { callbacksRef.current = callbacks; }, [callbacks]);
  useEffect(() => { contextRef.current = context; }, [context]);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const resolveNames = useCallback((params: Record<string, unknown>) => {
    const ctx = contextRef.current;
    if (!ctx) return params;

    const resolved = { ...params };

    if (params.swimlaneName) {
      const sw = ctx.swimlanes.find(
        (s) => s.name.toLowerCase() === (params.swimlaneName as string).toLowerCase()
      );
      resolved.swimlaneId = sw?.id || ctx.swimlanes[0]?.id;
      delete resolved.swimlaneName;
    }

    if (params.statusName) {
      const st = ctx.statuses.find(
        (s) => s.name.toLowerCase() === (params.statusName as string).toLowerCase()
      );
      resolved.statusId = st?.id || ctx.statuses[0]?.id;
      delete resolved.statusName;
    }

    if (params.campaignName) {
      const camp = ctx.campaigns.find(
        (c) => c.name.toLowerCase() === (params.campaignName as string).toLowerCase()
      );
      resolved.campaignId = camp?.id || null;
      delete resolved.campaignName;
    }

    return resolved;
  }, []);

  const executeAction = useCallback(async (tool: string, params: Record<string, unknown>) => {
    const cb = callbacksRef.current;
    const ctx = contextRef.current;

    switch (tool) {
      case 'create_activity': {
        const resolved = resolveNames(params);
        if (!resolved.swimlaneId && ctx?.swimlanes[0]) {
          resolved.swimlaneId = ctx.swimlanes[0].id;
        }
        if (!resolved.statusId && ctx?.statuses[0]) {
          resolved.statusId = ctx.statuses[0].id;
        }
        await cb.onCreateActivity({
          title: resolved.title as string,
          startDate: resolved.startDate as string,
          endDate: resolved.endDate as string,
          swimlaneId: resolved.swimlaneId as string,
          statusId: resolved.statusId as string,
          description: resolved.description as string | undefined,
          cost: resolved.cost as number | undefined,
          currency: resolved.currency as string | undefined,
          region: resolved.region as string | undefined,
          campaignId: resolved.campaignId as string | null | undefined,
        });
        break;
      }
      case 'update_activity': {
        const activityTitle = (params.activityTitle as string).toLowerCase();
        const activity = ctx?.activities.find(
          (a) => a.title.toLowerCase().includes(activityTitle)
        );
        if (activity) {
          const updates = { ...params };
          delete updates.activityTitle;
          const resolved = resolveNames(updates);
          await cb.onUpdateActivity(activity.id, resolved);
        }
        break;
      }
      case 'delete_activity': {
        const activityTitle = (params.activityTitle as string).toLowerCase();
        const activity = ctx?.activities.find(
          (a) => a.title.toLowerCase().includes(activityTitle)
        );
        if (activity) {
          await cb.onDeleteActivity(activity.id);
        }
        break;
      }
      case 'switch_view':
        cb.onSwitchView(params.view as ViewType);
        break;
      case 'set_filter': {
        if (params.searchQuery !== undefined) {
          cb.onSetSearch(params.searchQuery as string);
        }
        if (params.campaignName) {
          const camp = ctx?.campaigns.find(
            (c) => c.name.toLowerCase() === (params.campaignName as string).toLowerCase()
          );
          cb.onSetCampaignFilter(camp?.id || null);
        }
        if (params.statusName) {
          const st = ctx?.statuses.find(
            (s) => s.name.toLowerCase() === (params.statusName as string).toLowerCase()
          );
          cb.onSetStatusFilter(st?.id || null);
        }
        break;
      }
      case 'clear_filters':
        cb.onClearFilters();
        break;
      case 'open_copilot':
        cb.onOpenCopilot();
        break;
      case 'open_brief_generator':
        cb.onOpenBriefGenerator();
        break;
      // MCP tools: handled as info-only for now (the API route generates speech)
      case 'send_slack_message':
      case 'search_email':
      case 'create_calendar_event':
        // These are aspirational - returned as actions but require MCP server setup
        break;
    }
  }, [resolveNames]);

  const sendToAgent = useCallback(async (text: string) => {
    const ctx = contextRef.current;
    if (!text.trim() || !ctx) return;

    setIsProcessing(true);
    setError(null);

    const userEntry: ConversationEntry = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setConversation((prev) => [...prev, userEntry]);

    try {
      const response = await fetch('/api/ai/voice-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          calendarId: ctx.calendarId,
          context: {
            swimlanes: ctx.swimlanes.map((s) => ({ id: s.id, name: s.name })),
            statuses: ctx.statuses.map((s) => ({ id: s.id, name: s.name })),
            campaigns: ctx.campaigns.map((c) => ({ id: c.id, name: c.name })),
            activityCount: ctx.activities.length,
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to process voice command');
      }

      const result: { speech: string; actions: Array<{ tool: string; params: Record<string, unknown> }> } = await response.json();

      // Execute client-side actions
      for (const action of result.actions) {
        try {
          await executeAction(action.tool, action.params);
        } catch (e) {
          console.error(`Failed to execute action ${action.tool}:`, e);
        }
      }

      const assistantEntry: ConversationEntry = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.speech,
        timestamp: new Date(),
      };
      setConversation((prev) => [...prev, assistantEntry]);

      // Speak the response
      if (result.speech) {
        speak(result.speech);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong';
      setError(message);
      const errorEntry: ConversationEntry = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry, ${message}`,
        timestamp: new Date(),
      };
      setConversation((prev) => [...prev, errorEntry]);
    } finally {
      setIsProcessing(false);
    }
  }, [executeAction, speak]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Voice recognition is not supported in this browser. Please use Chrome or Safari.');
      return;
    }

    setError(null);
    setTranscript('');

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(finalTranscript);
        sendToAgent(finalTranscript);
      } else {
        setTranscript(interimTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`Voice recognition error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, sendToAgent]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const clearConversation = useCallback(() => {
    setConversation([]);
    setTranscript('');
    setError(null);
  }, []);

  return {
    isSupported,
    isListening,
    isProcessing,
    isSpeaking,
    transcript,
    error,
    conversation,
    toggleListening,
    stopListening,
    stopSpeaking,
    sendToAgent,
    clearConversation,
  };
}
