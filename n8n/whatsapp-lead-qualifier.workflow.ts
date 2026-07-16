import { workflow, node, trigger, sticky, placeholder, newCredential, ifElse, languageModel, memory, tool, fromAi, expr, nodeJson } from '@n8n/workflow-sdk';

const whatsAppTrigger = trigger({
  type: 'n8n-nodes-base.whatsAppTrigger',
  version: 1,
  config: {
    name: 'WhatsApp Trigger',
    parameters: { updates: ['messages'] },
    credentials: { whatsAppTriggerApi: newCredential('WhatsApp Trigger account') },
    position: [-400, 0]
  },
  output: [{
    messaging_product: 'whatsapp',
    metadata: { display_phone_number: '15550001111', phone_number_id: '123456789012345' },
    contacts: [{ profile: { name: 'Jane Prospect' }, wa_id: '33612345678' }],
    messages: [{ from: '33612345678', id: 'wamid.TEST', timestamp: '1752672000', text: { body: "Hi, I'm looking for a 2-bedroom apartment" }, type: 'text' }]
  }]
});

const isTextMessage = ifElse({
  version: 2.3,
  config: {
    name: 'Is Text Message?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{
          leftValue: expr('{{ $json.messages?.[0]?.text?.body ?? "" }}'),
          operator: { type: 'string', operation: 'notEmpty' },
          rightValue: ''
        }],
        combinator: 'and'
      }
    },
    position: [-160, 0]
  },
  output: [{
    messaging_product: 'whatsapp',
    contacts: [{ profile: { name: 'Jane Prospect' }, wa_id: '33612345678' }],
    messages: [{ from: '33612345678', id: 'wamid.TEST', timestamp: '1752672000', text: { body: "Hi, I'm looking for a 2-bedroom apartment" }, type: 'text' }]
  }]
});

const openAiModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'OpenAI Chat Model',
    parameters: {
      model: { __rl: true, mode: 'list', value: 'gpt-5.4-mini', cachedResultName: 'gpt-5.4-mini' },
      options: { temperature: 0.7 }
    },
    credentials: { openAiApi: newCredential('OpenAI account') },
    position: [-40, 260]
  }
});

const conversationMemory = memory({
  type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
  version: 1.4,
  config: {
    name: 'Per-Prospect Memory',
    parameters: {
      sessionIdType: 'customKey',
      sessionKey: nodeJson(whatsAppTrigger, 'messages.0.from'),
      contextWindowLength: 20
    },
    position: [120, 260]
  }
});

const saveLeadTool = tool({
  type: 'n8n-nodes-base.googleSheetsTool',
  version: 4.7,
  config: {
    name: 'save_lead',
    parameters: {
      resource: 'sheet',
      operation: 'appendOrUpdate',
      documentId: { __rl: true, mode: 'id', value: '', cachedResultName: 'Set your Leads spreadsheet here' },
      sheetName: { __rl: true, mode: 'name', value: 'Leads' },
      columns: {
        mappingMode: 'defineBelow',
        matchingColumns: ['phone'],
        value: {
          phone: nodeJson(whatsAppTrigger, 'messages.0.from'),
          name: fromAi('lead_name', "Prospect's full name, or empty string if unknown yet"),
          intent: fromAi('intent', 'What the prospect wants: buy, rent, or sell. Empty string if unknown.'),
          property_type: fromAi('property_type', 'Type of property they are interested in (apartment, house, land, commercial...). Empty string if unknown.'),
          budget: fromAi('budget', 'Their budget or expected price, as stated. Empty string if unknown.'),
          location: fromAi('location', 'Preferred area, neighborhood, or city. Empty string if unknown.'),
          timeline: fromAi('timeline', 'When they want to move / complete the transaction. Empty string if unknown.'),
          status: fromAi('status', 'Lead status: must be exactly one of new, in_progress, qualified'),
          notes: fromAi('notes', 'Any other useful detail the prospect shared. Empty string if none.'),
          last_contact: expr('{{ $now.toISO() }}')
        },
        schema: [
          { id: 'phone', displayName: 'phone', required: false, defaultMatch: true, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'name', displayName: 'name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: false },
          { id: 'intent', displayName: 'intent', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: false },
          { id: 'property_type', displayName: 'property_type', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: false },
          { id: 'budget', displayName: 'budget', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: false },
          { id: 'location', displayName: 'location', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: false },
          { id: 'timeline', displayName: 'timeline', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: false },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: false },
          { id: 'notes', displayName: 'notes', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: false },
          { id: 'last_contact', displayName: 'last_contact', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: false }
        ]
      }
    },
    credentials: { googleSheetsOAuth2Api: newCredential('Google Sheets account') },
    position: [280, 260]
  }
});

const notifyRealtorTool = tool({
  type: 'n8n-nodes-base.whatsAppTool',
  version: 1.1,
  config: {
    name: 'notify_realtor',
    parameters: {
      resource: 'message',
      operation: 'send',
      phoneNumberId: placeholder("Business phone number ID (same as the trigger's)"),
      recipientPhoneNumber: placeholder("Realtor's own WhatsApp number, with country code, e.g. +33612345678"),
      messageType: 'text',
      textBody: fromAi('summary', 'Hot lead summary for the realtor: name, phone, intent, property type, budget, location, timeline, and any key notes')
    },
    credentials: { whatsAppApi: newCredential('WhatsApp account') },
    position: [440, 260]
  }
});

const leadQualifierAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Lead Qualifier Agent',
    parameters: {
      promptType: 'define',
      text: expr('New WhatsApp message.\n' +
        'Prospect name (from WhatsApp profile): {{ $("WhatsApp Trigger").item.json.contacts?.[0]?.profile?.name ?? "unknown" }}\n' +
        'Prospect phone: {{ $("WhatsApp Trigger").item.json.messages[0].from }}\n' +
        'Received at: {{ $now.toISO() }}\n\n' +
        'Message:\n{{ $("WhatsApp Trigger").item.json.messages[0].text.body }}'),
      options: {
        systemMessage: 'You are the virtual assistant of a real estate agency, chatting with prospects on WhatsApp.\n\n' +
          '## Your job\n' +
          '1. Greet warmly and answer questions about buying, renting, selling, viewings, and the agency\'s services. If you don\'t know a specific detail (exact listings, fees), say a human agent will confirm it.\n' +
          '2. Qualify the lead by naturally collecting, over the course of the conversation:\n' +
          '   - name\n   - intent (buy, rent, or sell)\n   - property type\n   - budget (or expected sale price)\n   - preferred location/area\n   - timeline to move or transact\n' +
          '   Ask at most ONE question per reply. Never interrogate; weave questions into a helpful conversation.\n\n' +
          '## Tools — use them exactly like this\n' +
          '- save_lead: call it EVERY time you learn a new piece of qualification data, passing everything known so far. Set status to "new" on first contact, "in_progress" while collecting, and "qualified" once ALL six fields are known.\n' +
          '- notify_realtor: call it ONCE, only at the moment the lead becomes qualified. Send a short summary: name, phone, intent, property type, budget, location, timeline, plus key notes. Never call it twice for the same prospect (check the conversation history).\n\n' +
          '## Style\n' +
          '- Reply in the same language the prospect writes in.\n' +
          '- Short, friendly, WhatsApp-style messages (2-4 sentences). No markdown, no bullet lists, emojis sparingly.\n' +
          '- After the lead is qualified, tell them the agent will contact them shortly, and keep answering questions politely.\n' +
          '- Never invent property listings, prices, or legal advice.',
        maxIterations: 10
      }
    },
    subnodes: {
      model: openAiModel,
      memory: conversationMemory,
      tools: [saveLeadTool, notifyRealtorTool]
    },
    position: [120, 0]
  },
  output: [{ output: "Great, a 2-bedroom apartment! Which area are you looking in, and do you have a budget in mind?" }]
});

const replyToProspect = node({
  type: 'n8n-nodes-base.whatsApp',
  version: 1.1,
  config: {
    name: 'Reply on WhatsApp',
    parameters: {
      resource: 'message',
      operation: 'send',
      phoneNumberId: placeholder("Business phone number ID (same as the trigger's)"),
      recipientPhoneNumber: nodeJson(whatsAppTrigger, 'messages.0.from'),
      messageType: 'text',
      textBody: expr('{{ $json.output }}')
    },
    credentials: { whatsAppApi: newCredential('WhatsApp account') },
    position: [520, 0]
  },
  output: [{ messaging_product: 'whatsapp', contacts: [{ input: '33612345678', wa_id: '33612345678' }], messages: [{ id: 'wamid.REPLY' }] }]
});

const setupNote = sticky(
  '## Setup checklist\n' +
  '1. Connect the **WhatsApp Trigger** credential (Meta app: Client ID + Client Secret) and the **WhatsApp account** credential (Access Token + Business Account ID).\n' +
  '2. Fill the **Phone Number ID** on "Reply on WhatsApp" and "notify_realtor".\n' +
  '3. Set the **realtor\'s WhatsApp number** on "notify_realtor".\n' +
  '4. Connect **OpenAI** and **Google Sheets** credentials.\n' +
  '5. Point "save_lead" at your Leads spreadsheet (tab named "Leads" with headers: phone, name, intent, property_type, budget, location, timeline, status, notes, last_contact).\n' +
  '6. Customize the agency name/details in the agent\'s system message, then **activate** the workflow.',
  [],
  { color: 4 }
);

export default workflow('whatsapp-real-estate-lead-qualifier', 'WhatsApp Real Estate Lead Qualifier')
  .add(whatsAppTrigger)
  .to(isTextMessage.onTrue(leadQualifierAgent.to(replyToProspect)))
  .add(setupNote);
