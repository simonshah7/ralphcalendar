'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SolarCloseLinear } from './SolarIcons';

type AIProvider = 'anthropic' | 'gemini' | 'openai';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o',
};

const PROVIDER_LABELS: Record<AIProvider, string> = {
  anthropic: 'Anthropic (Claude)',
  gemini: 'Google (Gemini)',
  openai: 'OpenAI (GPT)',
};

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const [provider, setProvider] = useState<AIProvider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [driveFolderId, setDriveFolderId] = useState('');
  const [slackBotToken, setSlackBotToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin-settings');
      if (res.ok) {
        const data = await res.json();
        setProvider((data.ai_provider as AIProvider) || 'anthropic');
        setApiKey(data.ai_api_key || '');
        setModel(data.ai_model || '');
        setDriveFolderId(data.google_drive_folder_id || '');
        setSlackBotToken(data.slack_bot_token || '');
      }
    } catch {
      // Ignore load errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadSettings();
  }, [open, loadSettings]);

  const saveSetting = async (key: string, value: string) => {
    await fetch('/api/admin-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await Promise.all([
        saveSetting('ai_provider', provider),
        saveSetting('ai_api_key', apiKey),
        saveSetting('ai_model', model || DEFAULT_MODELS[provider]),
        saveSetting('google_drive_folder_id', driveFolderId),
        saveSetting('slack_bot_token', slackBotToken),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Handle error silently
    } finally {
      setSaving(false);
    }
  };

  const maskKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
  };

  const [showKey, setShowKey] = useState(false);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-card-border shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-card-border">
              <h2 className="text-lg font-semibold text-foreground">Settings</h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <SolarCloseLinear className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-accent-purple-btn border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* AI Provider Section */}
                  <section>
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
                      AI Provider
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Configure which AI provider powers the voice agent and other AI features.
                    </p>

                    {/* Provider Select */}
                    <label className="block text-sm font-medium text-foreground mb-1.5">Provider</label>
                    <select
                      value={provider}
                      onChange={(e) => {
                        const newProvider = e.target.value as AIProvider;
                        setProvider(newProvider);
                        if (!model || Object.values(DEFAULT_MODELS).includes(model)) {
                          setModel(DEFAULT_MODELS[newProvider]);
                        }
                      }}
                      className="w-full px-3 py-2 bg-muted border border-card-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent-purple-btn/50"
                    >
                      {(Object.entries(PROVIDER_LABELS) as [AIProvider, string][]).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>

                    {/* API Key */}
                    <label className="block text-sm font-medium text-foreground mt-4 mb-1.5">API Key</label>
                    <div className="relative">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={showKey ? apiKey : (apiKey ? maskKey(apiKey) : '')}
                        onChange={(e) => { setApiKey(e.target.value); setShowKey(true); }}
                        onFocus={() => setShowKey(true)}
                        onBlur={() => setShowKey(false)}
                        placeholder={`Enter your ${PROVIDER_LABELS[provider]} API key`}
                        className="w-full px-3 py-2 bg-muted border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-purple-btn/50 pr-16"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                      >
                        {showKey ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Falls back to ANTHROPIC_API_KEY env var if not set.
                    </p>

                    {/* Model */}
                    <label className="block text-sm font-medium text-foreground mt-4 mb-1.5">Model</label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder={DEFAULT_MODELS[provider]}
                      className="w-full px-3 py-2 bg-muted border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-purple-btn/50"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Default: {DEFAULT_MODELS[provider]}
                    </p>
                  </section>

                  {/* Divider */}
                  <div className="h-px bg-card-border" />

                  {/* Google Drive Section */}
                  <section>
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
                      Google Drive
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Connect to a Google Drive folder to browse marketing assets. Requires a Google Service Account (set GOOGLE_SERVICE_ACCOUNT_KEY env var).
                    </p>

                    <label className="block text-sm font-medium text-foreground mb-1.5">Folder ID</label>
                    <input
                      type="text"
                      value={driveFolderId}
                      onChange={(e) => setDriveFolderId(e.target.value)}
                      placeholder="e.g., 1A2B3C4D5E6F..."
                      className="w-full px-3 py-2 bg-muted border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-purple-btn/50"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      The folder ID from the Google Drive URL. Share this folder with your service account email.
                    </p>
                  </section>

                  {/* Divider */}
                  <div className="h-px bg-card-border" />

                  {/* Slack Section */}
                  <section>
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
                      Slack
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Connect Slack to send event notifications to dedicated channels.
                    </p>

                    <label className="block text-sm font-medium text-foreground mb-1.5">Bot Token</label>
                    <input
                      type="password"
                      value={slackBotToken}
                      onChange={(e) => setSlackBotToken(e.target.value)}
                      placeholder="xoxb-..."
                      className="w-full px-3 py-2 bg-muted border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-purple-btn/50"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Bot token from your Slack app. Requires <code className="text-xs">channels:read</code>, <code className="text-xs">groups:read</code>, and <code className="text-xs">chat:write</code> scopes.
                    </p>
                  </section>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-card-border flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-accent-purple-btn rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
