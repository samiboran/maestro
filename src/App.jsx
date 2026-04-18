import { useState, useEffect, useRef } from "react";
import maestroChar from "./assets/miya.jpg";
import ApiKeyModal from "./ApiKeyModal";
import Sidebar from "./components/Sidebar";
import DraggablePanel from "./components/DraggablePanel";
import ChatView from "./components/ChatView";
import { WORKER_URL } from "./config";
import "./App.css";
import "./styles/Prompt.css";
import ReactMarkdown from "react-markdown";

const MODELS = [
  { id: "claude",  name: "Llama 4 Scout",  color: "#7F77DD", initialX: 50,  initialY: 20 },
  { id: "chatgpt", name: "GPT OSS 120B",   color: "#1D9E75", initialX: 440, initialY: 20 },
  { id: "gemini",  name: "Qwen 3 32B",     color: "#378ADD", initialX: 830, initialY: 20 },
];

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [apiKeys, setApiKeys] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Mode: "chat" (default) or "orchestration" (advanced)
  const [mode, setMode] = useState("chat");

  // ── Chat mode state ──
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [thinkingPhase, setThinkingPhase] = useState(0);
  const chatEndRef = useRef(null);

  // ── Orchestration mode state (eski davranış) ──
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);
  const [synthesis, setSynthesis] = useState(null);
  const [synthModel, setSynthModel] = useState(null);
  const [showSynthesis, setShowSynthesis] = useState(false);
  const [showOrchestration, setShowOrchestration] = useState(false);
  const [asked, setAsked] = useState(false);
  const [timings, setTimings] = useState({});
  const [sessionHistory, setSessionHistory] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("maestro_keys");
    if (saved) {
      setApiKeys(JSON.parse(saved));
    } else {
      setShowModal(true);
    }
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  const consensus = Object.keys(responses).length === 3 ? "high" : null;

  // ── Shared: SSE stream reader ──
  async function streamModel(modelId, promptText, apiKey, onToken) {
    const start = Date.now();
    try {
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText, model: modelId, apiKey }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          try {
            const json = JSON.parse(data);
            if (json.token) onToken(json.token);
          } catch {}
        }
      }

      return ((Date.now() - start) / 1000).toFixed(1);
    } catch {
      return null;
    }
  }

  // ── CHAT MODE: Ask → 3 models parallel → auto synthesis ──
  async function handleChatAsk() {
    if (!prompt.trim() || !apiKeys || chatLoading) return;

    const userPrompt = prompt;
    setPrompt("");

    // Add user message
    setChatMessages((prev) => [...prev, { role: "user", content: userPrompt }]);
    setChatLoading(true);
    setThinkingPhase(0);

    const activeModels = MODELS.filter((m) => apiKeys[m.id]);

    // Phase 1: Query all models in parallel
    const modelResponses = {};
    const modelTimings = {};

    const promises = activeModels.map(async (m) => {
      let fullText = "";
      const elapsed = await streamModel(m.id, userPrompt, apiKeys[m.id], (token) => {
        fullText += token;
      });
      modelResponses[m.id] = fullText;
      modelTimings[m.id] = elapsed;
    });

    await Promise.all(promises);
    setThinkingPhase(1);

    // Phase 2: Auto-synthesis
    setThinkingPhase(2);

    // Pick judge model — use first model that has a response
    const judgeModel = activeModels.find((m) => modelResponses[m.id]?.length > 0);
    if (!judgeModel) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "maestro",
          content: "Modellerden cevap alınamadı. Lütfen API ayarlarını kontrol edin.",
          modelResponses: {},
          timings: {},
          models: activeModels,
        },
      ]);
      setChatLoading(false);
      return;
    }

const modelNames = Object.fromEntries(activeModels.map(m => [m.id, m.name]));

const parts = Object.entries(modelResponses)
  .filter(([, v]) => v)
  .map(([id, text]) => `### ${modelNames[id] || id}\n${text}`)
  .join("\n\n");

const synthPrompt = `Aşağıda aynı soruya farklı AI modellerinden gelen yanıtlar var.

Kurallar:
- Selamlama ve dolgu cümlelerini yoksay
- Modeller aynı şeyi söylüyorsa bir kez yaz
- Modeller arasında teknik çelişki varsa MUTLAKA belirt
- Kritik hatalar varsa öne çıkar
- Teknik sorularda en doğru kodu öne çıkar
- Giriş cümlesi yazma, direkt cevaba gir
- Cevabı Türkçe ver

SORU: ${userPrompt}

${parts}

Markdown formatı kullan.`;

    let synthText = "";

    // Stream synthesis into chat as it arrives
    const synthMsgIndex = chatMessages.length + 1; // +1 for user message already added

    // Add placeholder maestro message
    setChatMessages((prev) => [
      ...prev,
      {
        role: "maestro",
        content: "",
        modelResponses,
        timings: modelTimings,
        models: activeModels,
      },
    ]);
    setChatLoading(false);

    await streamModel(judgeModel.id, synthPrompt, apiKeys[judgeModel.id], (token) => {
      synthText += token;
      setChatMessages((prev) => {
        const updated = [...prev];
        const lastMaestro = updated.length - 1;
        updated[lastMaestro] = {
          ...updated[lastMaestro],
          content: synthText,
        };
        return updated;
      });
    });

    // Track session
    setSessionHistory((prev) => [
      ...prev,
      { timestamp: new Date().toISOString(), prompt: userPrompt },
    ]);
  }

  // ── ORCHESTRATION MODE: Eski davranış ──
  async function askModel(modelId, promptText, apiKey) {
    const elapsed = await streamModel(modelId, promptText, apiKey, (token) => {
      setResponses((r) => ({ ...r, [modelId]: (r[modelId] || "") + token }));
    });
    return { elapsed: elapsed || "—" };
  }

  async function handleOrchAsk() {
    if (!prompt.trim() || !apiKeys) return;
    setLoading(true);
    setResponses({});
    setSynthesis(null);
    setSynthModel(null);
    setAsked(false);
    setTimings({});

    const activeModels = MODELS.filter((m) => apiKeys[m.id]);
    const promises = activeModels.map(async (m) => {
      const result = await askModel(m.id, prompt, apiKeys[m.id]);
      setTimings((t) => ({ ...t, [m.id]: result.elapsed }));
    });

    await Promise.all(promises);
    setLoading(false);
    setAsked(true);
    setSessionHistory((prev) => [
      ...prev,
      { timestamp: new Date().toISOString(), prompt },
    ]);
  }

  async function handleSynthesize(modelId) {
    if (!responses[modelId]) return;
    setSynthModel(modelId);
    setSynthesis("");
    setShowSynthesis(true);

    const modelNames = Object.fromEntries(MODELS.map(m => [m.id, m.name]));

    const synthPrompt = `Sen bir AI hakem/analistsin. Aşağıda aynı soruya 3 farklı AI modelinin verdiği cevaplar var.

GÖREV:
1. Önce kısa bir ÖZET yaz — üç cevabın ortak noktalarını ve temel bulgularını birleştir.
2. Sonra MODEL ANALİZİ yap — her modelin güçlü ve zayıf yönlerini belirt.
3. Son olarak EN İYİ CEVAP değerlendirmesi yap — hangisi bu soruya en iyi cevap verdi ve neden?

SORU: ${prompt}

${Object.entries(responses)
  .map(([id, text]) => `--- ${modelNames[id] || id} ---\n${text}`)
  .join("\n\n")}

Türkçe yaz. Markdown formatı kullan.`;

    await streamModel(modelId, synthPrompt, apiKeys[modelId], (token) => {
      setSynthesis((prev) => (prev || "") + token);
    });
  }

  function handleNewChat() {
    setPrompt("");
    setResponses({});
    setSynthesis(null);
    setSynthModel(null);
    setAsked(false);
    setTimings({});
    setShowSynthesis(false);
    setSessionHistory([]);
    setChatMessages([]);
    setChatLoading(false);
    setThinkingPhase(0);
  }

  function exportACTP() {
    const session = {
      actp_version: "0.2",
      created_at: new Date().toISOString(),
      project: { name: "Maestro Session", description: "Multi-model AI orchestration session" },
      session: {
        mode,
        started_at: sessionHistory[0]?.timestamp || new Date().toISOString(),
        ended_at: new Date().toISOString(),
        queries: sessionHistory.map((entry, i) => ({
          order: i + 1,
          timestamp: entry.timestamp,
          prompt: entry.prompt,
        })),
        synthesis: synthesis ? { result: synthesis } : null,
      },
      decisions: [],
      open_questions: [],
      next_steps: [],
    };

    const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `maestro-session-${new Date().toISOString().slice(0, 10)}.actp`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Decide which ask handler to call ──
  function handleAsk() {
    if (mode === "chat") {
      handleChatAsk();
    } else {
      handleOrchAsk();
    }
  }

  function renderModelContent(modelId) {
    if (loading && !responses[modelId]) {
      return (
        <div className="model-loading">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
      );
    }
    if (responses[modelId]) {
      return <p className="model-response">{responses[modelId]}</p>;
    }
    return <div className="model-placeholder" />;
  }

  return (
    <div className={`maestro-root ${sidebarOpen ? "sidebar-open" : ""} mode-${mode}`}>
      <div className="bg-noise" />
      <div className="bg-glow" />

      {showModal && (
        <ApiKeyModal
          onSave={(keys) => {
            setApiKeys(keys);
            setShowModal(false);
          }}
        />
      )}

      <Sidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        onNewChat={handleNewChat}
        onExportSession={exportACTP}
        onOpenSettings={() => setShowModal(true)}
        mode={mode}
        setMode={setMode}
      />

      {/* ── SYNTHESIS MODAL (Orkestrasyon modu) ── */}
      {mode === "orchestration" && showSynthesis && synthesis !== null && (
        <div className="synth-modal-overlay" onClick={() => setShowSynthesis(false)}>
          <div className="synth-modal" onClick={(e) => e.stopPropagation()}>
            <button className="synth-modal-close" onClick={() => setShowSynthesis(false)}>
              ✕
            </button>
            <div className="synth-modal-header">
              <span className="synth-modal-icon">∑</span>
              <span>Synthesis</span>
              {synthModel && (
                <span
                  className="synth-modal-by"
                  style={{ color: MODELS.find((m) => m.id === synthModel)?.color }}
                >
                  — {MODELS.find((m) => m.id === synthModel)?.name}
                </span>
              )}
            </div>
            <div className="synth-modal-body">
              {synthesis ? (
                <ReactMarkdown>{synthesis}</ReactMarkdown>
              ) : (
                <span className="synth-loading">Analiz ediliyor...</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ORCHESTRATION MODE ── */}
      {mode === "orchestration" && (
        <>
          {asked && (
            <button
              className="orchestration-toggle"
              onClick={() => setShowOrchestration((v) => !v)}
            >
              {showOrchestration ? "Orkestrasyonu Gizle" : "Orkestrasyonu Göster"}
            </button>
          )}

          {showOrchestration && asked && (
            <div className="orchestration-panel">
              <div className="orch-step">📨 Prompt paralel gönderildi</div>
              {MODELS.filter((m) => apiKeys?.[m.id]).map((m) => (
                <div className="orch-step" key={m.id}>
                  ⚡ <span style={{ color: m.color }}>{m.name}</span> →{" "}
                  {timings[m.id] ? `${timings[m.id]}s` : "bekleniyor..."}
                </div>
              ))}
              {synthModel && (
                <div className="orch-step">
                  🧠 Synthesis —{" "}
                  <span style={{ color: MODELS.find((m) => m.id === synthModel)?.color }}>
                    {MODELS.find((m) => m.id === synthModel)?.name}
                  </span>
                </div>
              )}
            </div>
          )}

          {MODELS.map((model, idx) => (
            <DraggablePanel
              key={model.id}
              id={model.id}
              color={model.color}
              label={model.name}
              initialX={model.initialX}
              initialY={model.initialY}
              zIndex={10 + idx}
            >
              {renderModelContent(model.id)}
            </DraggablePanel>
          ))}
        </>
      )}

      {/* ── CHAT MODE ── */}
      {mode === "chat" && (
        <ChatView
          messages={chatMessages}
          loading={chatLoading}
          thinkingPhase={thinkingPhase}
          onRetry={(index) => {
            const userMsg = chatMessages.slice(0, index).reverse().find(m => m.role === "user");
            if (userMsg) {
              setPrompt(userMsg.content);
              setChatMessages(prev => prev.slice(0, index - 1));
              setTimeout(() => handleChatAsk(), 100);
            }
          }}
        />
      )}

      {/* ── PROMPT AREA (her iki modda da gösterilir) ── */}
      <div className={`center-fixed ${mode === "chat" ? "chat-prompt-mode" : ""}`}>
        {mode === "orchestration" && asked && (
          <div className={`consensus-badge ${consensus}`}>
            {consensus === "high" ? "🟢 Yüksek Consensus" : "🔴 Görüşler Ayrışıyor"}
          </div>
        )}

        <div className="prompt-row">
          <div className="prompt-area">
            <textarea
              className="prompt-input"
              placeholder="Maestro'ya sor..."
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
              rows={1}
            />
            <button
              className="ask-btn"
              onClick={handleAsk}
              disabled={loading || chatLoading}
            >
              {loading || chatLoading ? "..." : "SOR"}
            </button>
          </div>

          {mode === "orchestration" && (
            <div className={`char-wrap ${loading ? "conducting" : ""}`}>
              <img src={maestroChar} alt="Maestro" className="char-img" />
              <div className="char-glow" />
            </div>
          )}
        </div>

        {mode === "orchestration" &&
          Object.keys(responses).length === MODELS.filter((m) => apiKeys?.[m.id]).length &&
          asked && (
            <button className="synthesis-trigger" onClick={() => setShowSynthesis(true)}>
              ∑ Synthesis
            </button>
          )}

        {mode === "orchestration" && showSynthesis && !synthesis && (
          <div className="synthesis-btns" style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            {MODELS.filter((m) => apiKeys?.[m.id]).map((m) => (
              <button
                key={m.id}
                className={`synth-btn ${synthModel === m.id ? "active" : ""}`}
                style={{ "--c": m.color }}
                onClick={() => handleSynthesize(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={chatEndRef} />
    </div>
  );
}