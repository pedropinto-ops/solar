'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { Logo } from '@/components/ui/logo';

interface ChatResponse {
  conversationId: string;
  reply: string;
  reservations?: Array<{ code: string }>;
}

interface Msg {
  role: 'user' | 'assistant';
  text: string;
}

export default function AssistentePage() {
  const { slug } = useParams<{ slug: string }>();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      text: 'Olá! Sou o atendente virtual do Solar Irará Hotel. Posso ajudar com sua reserva — me diga as datas e quantas pessoas vão se hospedar. 🌅',
    },
  ]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setError(null);
    setMessages((m) => [...m, { role: 'user', text }]);
    setSending(true);
    try {
      const res = await apiFetch<ChatResponse>('/public/assistant/chat', {
        method: 'POST',
        skipAuth: true,
        body: { slug, conversationId, message: text },
      });
      setConversationId(res.conversationId);
      setMessages((m) => [...m, { role: 'assistant', text: res.reply }]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-sand-50 flex flex-col">
      <header className="bg-cream border-b border-sand-200 px-4 py-3 flex items-center gap-3">
        <Logo className="w-10 h-auto" />
        <div>
          <div className="font-serif-display text-ink-950 leading-tight">Assistente de reservas</div>
          <div className="text-xs text-ink-500">Solar Irará Hotel · Irará-BA</div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-lg mx-auto w-full">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
          >
            <div
              className={
                m.role === 'user'
                  ? 'bg-teal-900 text-cream rounded-2xl rounded-br-sm px-4 py-2 text-sm max-w-[85%] whitespace-pre-wrap'
                  : 'bg-cream border border-sand-200 text-ink-900 rounded-2xl rounded-bl-sm px-4 py-2 text-sm max-w-[85%] whitespace-pre-wrap'
              }
            >
              {m.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-cream border border-sand-200 text-ink-400 rounded-2xl rounded-bl-sm px-4 py-2 text-sm">
              digitando…
            </div>
          </div>
        )}
        {error && (
          <div className="text-center text-xs text-red-600">{error}</div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-sand-200 bg-cream px-4 py-3">
        <div className="max-w-lg mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send();
            }}
            placeholder="Escreva sua mensagem…"
            className="flex-1 rounded-full border border-sand-200 px-4 min-h-touch-md bg-cream text-sm"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="bg-teal-900 text-cream font-semibold rounded-full px-5 min-h-touch-md hover:bg-teal-700 disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
        <p className="text-center text-[11px] text-ink-400 mt-2">
          Assistente por IA · pode cometer erros; a recepção confirma sua reserva.
        </p>
      </div>
    </div>
  );
}
