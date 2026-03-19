interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const VOICE_AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'create_activity',
    description: 'Create a new marketing activity/event on the calendar. Use this when the user wants to add, create, or schedule a new activity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Activity title' },
        startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' },
        swimlaneName: { type: 'string', description: 'Channel/swimlane name (e.g. "Social Media", "Email", "Paid")' },
        statusName: { type: 'string', description: 'Status name (e.g. "Considering", "Negotiating", "Committed")' },
        description: { type: 'string', description: 'Activity description' },
        cost: { type: 'number', description: 'Planned cost in dollars' },
        currency: { type: 'string', enum: ['USD', 'GBP', 'EUR'], description: 'Currency code' },
        region: { type: 'string', enum: ['US', 'EMEA', 'ROW'], description: 'Region' },
        campaignName: { type: 'string', description: 'Campaign name to associate with' },
      },
      required: ['title', 'startDate', 'endDate'],
    },
  },
  {
    name: 'update_activity',
    description: 'Update an existing activity. Use when the user wants to change, modify, or edit an activity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        activityTitle: { type: 'string', description: 'Title of the activity to update (used to find it)' },
        title: { type: 'string', description: 'New title' },
        startDate: { type: 'string', description: 'New start date YYYY-MM-DD' },
        endDate: { type: 'string', description: 'New end date YYYY-MM-DD' },
        description: { type: 'string', description: 'New description' },
        cost: { type: 'number', description: 'New cost' },
        statusName: { type: 'string', description: 'New status name' },
        swimlaneName: { type: 'string', description: 'New channel/swimlane name' },
      },
      required: ['activityTitle'],
    },
  },
  {
    name: 'delete_activity',
    description: 'Delete an activity. Use when the user wants to remove or delete an activity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        activityTitle: { type: 'string', description: 'Title of the activity to delete' },
      },
      required: ['activityTitle'],
    },
  },
  {
    name: 'switch_view',
    description: 'Switch the app to a different view. Use when the user wants to see timeline, calendar, table, or dashboard view.',
    input_schema: {
      type: 'object' as const,
      properties: {
        view: { type: 'string', enum: ['timeline', 'calendar', 'table', 'dashboard'], description: 'View to switch to' },
      },
      required: ['view'],
    },
  },
  {
    name: 'set_filter',
    description: 'Set search or filter criteria. Use when the user wants to search, filter, or find specific activities.',
    input_schema: {
      type: 'object' as const,
      properties: {
        searchQuery: { type: 'string', description: 'Text to search for in activity titles' },
        campaignName: { type: 'string', description: 'Campaign name to filter by' },
        statusName: { type: 'string', description: 'Status name to filter by' },
      },
    },
  },
  {
    name: 'clear_filters',
    description: 'Clear all active search and filter criteria.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'query_analytics',
    description: 'Answer questions about campaign performance, budgets, spending, ROI, and metrics. Use for any analytical or data questions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        question: { type: 'string', description: 'The analytics question to answer' },
      },
      required: ['question'],
    },
  },
  {
    name: 'list_activities',
    description: 'List current activities. Use when the user asks what activities exist, what is scheduled, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        swimlaneName: { type: 'string', description: 'Optional: filter by channel/swimlane' },
        campaignName: { type: 'string', description: 'Optional: filter by campaign' },
      },
    },
  },
  {
    name: 'open_copilot',
    description: 'Open the AI Copilot panel for detailed analytics chat.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'open_brief_generator',
    description: 'Open the AI Brief Generator to create activities from a marketing brief.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'send_slack_message',
    description: 'Send a message to a Slack channel. Use when the user wants to message, notify, or post to Slack.',
    input_schema: {
      type: 'object' as const,
      properties: {
        channel: { type: 'string', description: 'Slack channel name (without #)' },
        message: { type: 'string', description: 'Message content to send' },
      },
      required: ['channel', 'message'],
    },
  },
  {
    name: 'search_email',
    description: 'Search Gmail for emails. Use when the user wants to find, check, or look up emails.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query for Gmail' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_calendar_event',
    description: 'Create a Google Calendar event. Use when the user wants to add a meeting, event, or block time on their calendar.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Event title' },
        startTime: { type: 'string', description: 'Start time in ISO 8601 format' },
        endTime: { type: 'string', description: 'End time in ISO 8601 format' },
        description: { type: 'string', description: 'Event description' },
      },
      required: ['title', 'startTime', 'endTime'],
    },
  },
];
