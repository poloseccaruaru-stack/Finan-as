import { OpenAI } from 'openai';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';

export default async function handleChat(req, res) {
  const { provider, message, history = [] } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    switch (provider) {
      case 'openai':
        return await handleOpenAI(message, history, res);
      case 'gemini':
        return await handleGemini(message, history, res);
      case 'claude':
        return await handleClaude(message, history, res);
      default:
        return res.status(400).json({ error: 'Invalid provider' });
    }
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

async function handleOpenAI(message, history, res) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const openai = new OpenAI({ apiKey });
  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
  });

  res.json({ text: response.choices[0].message.content });
}

async function handleGemini(message, history, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const genAI = new GoogleGenAI({ apiKey });
  const model = 'gemini-3-flash-preview';

  const contents = [
    ...history.map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }]
    })),
    { role: 'user', parts: [{ text: message }] }
  ];

  const response = await genAI.models.generateContent({
    model,
    contents
  });

  res.json({ text: response.text });
}

async function handleClaude(message, history, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  const anthropic = new Anthropic({ apiKey });
  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ];

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20240620',
    max_tokens: 1024,
    messages,
  });

  res.json({ text: response.content[0].text });
}
