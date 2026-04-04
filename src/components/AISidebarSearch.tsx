import { useState } from 'react';
import { Search, Sparkles, Save, X, Loader2, Brain, Zap, MessageSquare } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

interface Props {
  isSidebarOpen: boolean;
}

type AIModel = 'gemini' | 'chatgpt' | 'claude';

export default function AISidebarSearch({ isSidebarOpen }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>('gemini');

  const handleAISearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setShowModal(true);

    try {
      // Fetch all data for context
      const collections = ['students', 'users', 'classes', 'attendance', 'planning', 'projects', 'transactions'];
      const contextData: any = {};

      for (const col of collections) {
        const snap = await getDocs(collection(db, col));
        contextData[col] = snap.docs.map(d => d.data());
      }

      const systemPrompt = `Você é um assistente analista de dados para uma escola (EBD). 
      Abaixo estão os dados atuais do sistema em formato JSON:
      ${JSON.stringify(contextData)}
      
      O usuário perguntou: "${query}"
      
      Responda de forma profissional, gere relatórios se solicitado, e forneça insights baseados nos dados. 
      Use Markdown para formatar a resposta.`;

      let aiResponse = '';

      if (selectedModel === 'gemini') {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: systemPrompt,
        });
        aiResponse = response.text || '';
      } else if (selectedModel === 'chatgpt') {
        const openai = new OpenAI({
          apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
          dangerouslyAllowBrowser: true // Required for client-side usage
        });
        const completion = await openai.chat.completions.create({
          messages: [{ role: "system", content: systemPrompt }],
          model: "gpt-4o-mini",
        });
        aiResponse = completion.choices[0].message.content || '';
      } else if (selectedModel === 'claude') {
        const anthropic = new Anthropic({
          apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
          dangerouslyAllowBrowser: true // Required for client-side usage
        });
        const message = await anthropic.messages.create({
          model: "claude-3-5-sonnet-20240620",
          max_tokens: 1024,
          messages: [{ role: "user", content: systemPrompt }],
        });
        // Claude 3 SDK returns an array of content blocks
        if (message.content[0].type === 'text') {
          aiResponse = message.content[0].text;
        }
      }

      setResult(aiResponse || 'Não foi possível gerar uma resposta.');
    } catch (err: any) {
      console.error(err);
      setResult(`Erro ao processar sua solicitação com a IA (${selectedModel}). Verifique se a chave de API está configurada corretamente.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAction = async () => {
    if (!result) return;
    try {
      await addDoc(collection(db, 'ai_actions'), {
        query,
        result,
        createdAt: new Date().toISOString()
      });
      alert('Ação arquivada com sucesso!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'ai_actions');
    }
  };

  if (!isSidebarOpen) return null;

  return (
    <div className="px-4 py-2 space-y-3">
      <div className="flex items-center justify-between ml-1">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Assistente IA</p>
        <div className="flex gap-1">
          <button
            onClick={() => setSelectedModel('gemini')}
            className={cn(
              "p-1 rounded-md transition-all",
              selectedModel === 'gemini' ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-500 hover:text-slate-300"
            )}
            title="Gemini"
          >
            <Sparkles className="w-3 h-3" />
          </button>
          <button
            onClick={() => setSelectedModel('chatgpt')}
            className={cn(
              "p-1 rounded-md transition-all",
              selectedModel === 'chatgpt' ? "bg-green-600 text-white" : "bg-slate-800 text-slate-500 hover:text-slate-300"
            )}
            title="ChatGPT"
          >
            <MessageSquare className="w-3 h-3" />
          </button>
          <button
            onClick={() => setSelectedModel('claude')}
            className={cn(
              "p-1 rounded-md transition-all",
              selectedModel === 'claude' ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-500 hover:text-slate-300"
            )}
            title="Claude"
          >
            <Brain className="w-3 h-3" />
          </button>
        </div>
      </div>

      <form onSubmit={handleAISearch} className="relative group">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          {selectedModel === 'gemini' && <Sparkles className="w-4 h-4 text-indigo-400" />}
          {selectedModel === 'chatgpt' && <MessageSquare className="w-4 h-4 text-green-400" />}
          {selectedModel === 'claude' && <Brain className="w-4 h-4 text-amber-400" />}
        </div>
        <input
          type="text"
          placeholder={`Perguntar ao ${selectedModel === 'gemini' ? 'Gemini' : selectedModel === 'chatgpt' ? 'ChatGPT' : 'Claude'}...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
        />
        <button 
          type="submit"
          disabled={loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <Search className="w-3 h-3 text-slate-400" />
        </button>
      </form>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold">Análise da IA</h3>
                    <p className="text-xs text-indigo-100 italic">"{query}"</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                {loading ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-4 py-12">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                    <p className="text-slate-500 font-medium animate-pulse">Analisando banco de dados e gerando relatório...</p>
                  </div>
                ) : (
                  <div className="prose prose-slate max-w-none">
                    <ReactMarkdown>{result || ''}</ReactMarkdown>
                  </div>
                )}
              </div>

              {!loading && result && (
                <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-all"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={handleSaveAction}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all"
                  >
                    <Save className="w-5 h-5" />
                    Salvar Ação
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
