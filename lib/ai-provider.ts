import { db, adminSettings } from '@/db';
import { eq } from 'drizzle-orm';

export type AIProvider = 'anthropic' | 'gemini' | 'openai';

interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ToolUseBlock {
  type: 'tool_use';
  name: string;
  input: Record<string, unknown>;
}

interface TextBlock {
  type: 'text';
  text: string;
}

export type ContentBlock = ToolUseBlock | TextBlock;

interface AIResponse {
  content: ContentBlock[];
}

const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o',
};

export async function getAISettings(): Promise<AISettings> {
  const rows = await db.select().from(adminSettings);
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }

  const provider = (map['ai_provider'] as AIProvider) || 'anthropic';
  const apiKey = map['ai_api_key'] || process.env.ANTHROPIC_API_KEY || '';
  const model = map['ai_model'] || DEFAULT_MODELS[provider];

  return { provider, apiKey, model };
}

export async function chatCompletion(
  systemPrompt: string,
  messages: AIMessage[],
  tools?: ToolDefinition[],
): Promise<AIResponse> {
  const settings = await getAISettings();

  if (!settings.apiKey) {
    throw new Error('No AI API key configured. Set one in Settings or via ANTHROPIC_API_KEY env var.');
  }

  switch (settings.provider) {
    case 'anthropic':
      return callAnthropic(settings, systemPrompt, messages, tools);
    case 'gemini':
      return callGemini(settings, systemPrompt, messages, tools);
    case 'openai':
      return callOpenAI(settings, systemPrompt, messages, tools);
    default:
      throw new Error(`Unknown AI provider: ${settings.provider}`);
  }
}

async function callAnthropic(
  settings: AISettings,
  systemPrompt: string,
  messages: AIMessage[],
  tools?: ToolDefinition[],
): Promise<AIResponse> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: settings.apiKey });

  const anthropicTools = tools?.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));

  const response = await client.messages.create({
    model: settings.model,
    max_tokens: 1024,
    system: systemPrompt,
    tools: anthropicTools as import('@anthropic-ai/sdk/resources/messages').Tool[] | undefined,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  return {
    content: response.content.map((block) => {
      if (block.type === 'text') {
        return { type: 'text' as const, text: block.text };
      } else if (block.type === 'tool_use') {
        return {
          type: 'tool_use' as const,
          name: block.name,
          input: block.input as Record<string, unknown>,
        };
      }
      return { type: 'text' as const, text: '' };
    }),
  };
}

async function callGemini(
  settings: AISettings,
  systemPrompt: string,
  messages: AIMessage[],
  tools?: ToolDefinition[],
): Promise<AIResponse> {
  const { GoogleGenerativeAI, SchemaType } = await import('@google/generative-ai');
  const ai = new GoogleGenerativeAI(settings.apiKey);

  const geminiSchemaType = (t: string): import('@google/generative-ai').SchemaType => {
    const map: Record<string, import('@google/generative-ai').SchemaType> = {
      string: SchemaType.STRING,
      number: SchemaType.NUMBER,
      integer: SchemaType.INTEGER,
      boolean: SchemaType.BOOLEAN,
      array: SchemaType.ARRAY,
      object: SchemaType.OBJECT,
    };
    return map[t] || SchemaType.STRING;
  };

  const model = ai.getGenerativeModel({
    model: settings.model,
    systemInstruction: systemPrompt,
    tools: tools
      ? ([
          {
            functionDeclarations: tools.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: {
                type: SchemaType.OBJECT,
                properties: Object.fromEntries(
                  Object.entries(t.input_schema.properties).map(([k, v]) => {
                    const schema = v as Record<string, unknown>;
                    const result: Record<string, unknown> = {
                      type: geminiSchemaType((schema.type as string) || 'string'),
                    };
                    if (schema.description) result.description = schema.description;
                    if (schema.enum) result.enum = schema.enum;
                    return [k, result];
                  }),
                ),
                required: t.input_schema.required || [],
              },
            })),
          },
        ] as unknown as import('@google/generative-ai').Tool[])
      : undefined,
  });

  const contents = messages.map((m) => ({
    role: (m.role === 'assistant' ? 'model' : 'user') as 'model' | 'user',
    parts: [{ text: m.content }],
  }));

  const response = await model.generateContent({ contents });
  const result = response.response;

  const content: ContentBlock[] = [];
  const candidate = result.candidates?.[0];
  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if (part.functionCall) {
        content.push({
          type: 'tool_use',
          name: part.functionCall.name,
          input: (part.functionCall.args || {}) as Record<string, unknown>,
        });
      } else if (part.text) {
        content.push({ type: 'text', text: part.text });
      }
    }
  }

  return { content };
}

async function callOpenAI(
  settings: AISettings,
  systemPrompt: string,
  messages: AIMessage[],
  tools?: ToolDefinition[],
): Promise<AIResponse> {
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: settings.apiKey });

  const openaiMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  const openaiTools = tools?.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema as Record<string, unknown>,
    },
  }));

  const response = await client.chat.completions.create({
    model: settings.model,
    messages: openaiMessages,
    tools: openaiTools,
    max_tokens: 1024,
  });

  const choice = response.choices[0];
  const content: ContentBlock[] = [];

  if (choice.message.content) {
    content.push({ type: 'text', text: choice.message.content });
  }

  if (choice.message.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      if (tc.type === 'function') {
        content.push({
          type: 'tool_use',
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      }
    }
  }

  return { content };
}
