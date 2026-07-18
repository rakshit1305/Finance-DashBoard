import { useState, useRef } from "react";
import { Send, MessageCircle } from "lucide-react";
import { askQuestion } from "../lib/api";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { ChartCard } from "./ChartsPanel";

const SUGGESTIONS = [
    "What are the biggest profit drivers?",
    "Show me a chart of the top performers",
    "Any risks in this data?",
];

export default function QAChat({ datasetId, aiConfigured }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);

    const send = async (text) => {
        const question = (text ?? input).trim();
        if (!question || !datasetId) return;
        if (!aiConfigured) {
            setMessages((m) => [
                ...m,
                { role: "user", text: question },
                { role: "ai", text: "Add your OpenAI API key to backend/.env (OPENAI_API_KEY) and restart the backend to unlock Q&A." },
            ]);
            setInput("");
            return;
        }
        setMessages((m) => [...m, { role: "user", text: question }]);
        setInput("");
        setLoading(true);
        try {
            const { answer, chart } = await askQuestion(datasetId, question);
            setMessages((m) => [...m, { role: "ai", text: answer, chart: chart || null }]);
        } catch (e) {
            setMessages((m) => [
                ...m,
                {
                    role: "ai",
                    text:
                        e?.response?.data?.detail ||
                        e.message ||
                        "Sorry, something went wrong.",
                },
            ]);
        } finally {
            setLoading(false);
            requestAnimationFrame(() => {
                scrollRef.current?.scrollTo({ top: 1e6, behavior: "smooth" });
            });
        }
    };

    return (
        <div
            className="rounded-2xl border border-zinc-200 bg-white p-6 tactile-shadow"
            data-testid="qa-panel"
        >
            <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-zinc-900" />
                <h2 className="font-heading text-xl font-bold text-zinc-900">Ask about your data</h2>
            </div>
            <p className="mt-1 text-sm text-zinc-500">Type any finance question in plain English.</p>

            <div
                ref={scrollRef}
                className="chat-scroll mt-4 max-h-[28rem] overflow-y-auto space-y-3 pr-1"
                data-testid="qa-messages"
            >
                {messages.length === 0 && (
                    <div className="flex flex-wrap gap-2">
                        {SUGGESTIONS.map((s) => (
                            <button
                                key={s}
                                onClick={() => send(s)}
                                className="rounded-full border border-zinc-200 bg-[#FFF8E1] px-3 py-1.5 text-xs text-zinc-800 hover:bg-[#FCE8E6] transition-colors"
                                data-testid={`suggestion-${s.slice(0, 12).replace(/\s+/g, "-").toLowerCase()}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} data-testid={`qa-msg-${m.role}`}>
                        <div
                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                                m.role === "user"
                                    ? "ml-auto bg-zinc-900 text-white"
                                    : "bg-zinc-100 text-zinc-800"
                            }`}
                        >
                            {m.text}
                        </div>
                        {m.chart && (
                            <div className="mt-2 rounded-2xl border border-zinc-200 bg-white p-4">
                                <ChartCard chart={m.chart} />
                            </div>
                        )}
                    </div>
                ))}
                {loading && (
                    <div className="max-w-[85%] rounded-2xl bg-zinc-100 px-4 py-2.5 text-sm text-zinc-800">
                        <span className="loading-dot" />
                        <span className="loading-dot" />
                        <span className="loading-dot" />
                    </div>
                )}
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    send();
                }}
                className="mt-4 flex items-center gap-2"
            >
                <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="e.g. What are the highest expenses?"
                    className="rounded-full border-zinc-300 focus-visible:ring-zinc-900"
                    data-testid="qa-input"
                    disabled={loading}
                />
                <Button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="rounded-full bg-zinc-900 hover:bg-zinc-800"
                    data-testid="qa-send-btn"
                >
                    <Send className="h-4 w-4" />
                </Button>
            </form>
        </div>
    );
}
