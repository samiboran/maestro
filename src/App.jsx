import { useState, useEffect, useRef } from "react";
import ApiKeyModal from "./ApiKeyModal";
import Sidebar from "./components/Sidebar";
import DraggablePanel from "./components/DraggablePanel";
import ChatView from "./components/ChatView";
import { WORKER_URL } from "./config";
import "./App.css";
import "./styles/Prompt.css";
import "./styles/autonomous.css";
import "./orchestrator-animations.css";
import ReactMarkdown from "react-markdown";
import { useOrchestrator } from "./orchestrator/OrchestratorContext.jsx";
import ModeToggle from "./components/ModeToggle";

// ── Otonom mod importları ──
import AutonomousMode from "./modes/AutonomousMode.jsx";
import { OrchestratorProvider } from "./orchestrator/OrchestratorContext.jsx";
import useMemory from "./useMemory.js";

// FIX #5: provider bilgisi MODELS içine taşındı
const MODELS = [
  { id: "claude",  provider: "groq-llama4", name: "Llama 4 Scout",  color: "#7F77DD", initialX: 50,  initialY: 20 },
  { id: "chatgpt", provider: "groq-gptoss", name: "GPT OSS 120B",   color: "#1D9E75", initialX: 440, initialY: 20 },
  { id: "gemini",  provider: "groq-qwen3",  name: "Qwen 3 32B",     color: "#378ADD", initialX: 830, initialY: 20 },
];

// FIX #3: Mesaj ID üretici — race condition önleme
let nextMsgId = 1;
function genMsgId() { return `msg-${Date.now()}-${nextMsgId++}`; }

export default function App() {

  const [prompt, setPrompt] = useState("");
  const [apiKeys, setApiKeys] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { run } = useOrchestrator();  
  // Mode: "chat" | "orchestration" | "autonomous"
  const { chats, saveChat, loadChat, deleteChat, clearAllChats, setPref, getPref } = useMemory();
  const [mode, setMode] = useState(() => getPref('defaultMode', 'chat'));

  // ── Chat mode state ──
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [thinkingPhase, setThinkingPhase] = useState(0);
  const chatEndRef = useRef(null);

  // ── Orchestration mode state ──
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
  // FIX #4: Error logging eklendi
  async function streamModel(modelId, promptText, apiKey, onToken) {
    const start = Date.now();
    try {
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText, model: modelId, apiKey, judgeKey: apiKeys?.judgeKey || "" }),
      });

      if (!res.ok) {
        console.error(`[streamModel] ${modelId} HTTP ${res.status}`);
        return null;
      }

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
          } catch (e) {
            console.warn(`[streamModel] ${modelId} parse warning:`, e.message);
          }
        }
      }

      return ((Date.now() - start) / 1000).toFixed(1);
    } catch (err) {
      console.error(`[streamModel] ${modelId} failed:`, err);
      return null;
    }
  }

  // ── Otonom mod sarmalayıcılar ──
  // FIX #5: MODELS.provider ile lookup, hardcoded map kaldırıldı
  async function autonomousStreamModel(provider, prompt, onChunk) {
    const model = MODELS.find(m => m.provider === provider);
    const modelId = model ? model.id : provider;
    const apiKey = apiKeys?.[modelId] || "";
    await streamModel(modelId, prompt, apiKey, onChunk);
  }

  async function autonomousJudgeModel(prompt) {
    let fullText = "";
    await streamModel("judge", prompt, apiKeys?.judgeKey || "", (token) => {
      fullText += token;
    });
    if (!fullText || fullText.trim().length < 10) {
      console.warn("Judge boş döndü, Groq fallback kullanılıyor");
      fullText = "";
      await streamModel("claude", prompt, apiKeys?.claude || "", (token) => {
        fullText += token;
      });
    }
    return fullText;
}
async function fetchUrl(targetUrl) {
  try {
    const res = await fetch(`${WORKER_URL}/fetch-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUrl }),
    });
    const data = await res.json();
    return data.ok ? data.content : null;
  } catch (err) {
    console.error('[fetchUrl] başarısız:', err);
    return null;
  }
}
  // ── CHAT MODE ──
  // FIX #3: Message ID ile race condition önleme
  // FIX #6: chatLoading synthesis boyunca true kalıyor
  async function handleChatAsk() {
    if (!prompt.trim() || !apiKeys || chatLoading) return;

    const userPrompt = prompt;
    setPrompt("");

    setChatMessages((prev) => [...prev, { id: genMsgId(), role: "user", content: userPrompt }]);
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
    setThinkingPhase(2);

    if (!apiKeys.judgeKey) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: genMsgId(),
          role: "maestro",
          content: "Cerebras API key girilmemiş. Lütfen API ayarlarından judge key'i girin.",
          modelResponses: {},
          timings: {},
          models: activeModels,
        },
      ]);
      setChatLoading(false);
      return;
    }

    const hasAnyResponse = activeModels.some((m) => modelResponses[m.id]?.length > 0);
    if (!hasAnyResponse) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: genMsgId(),
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

    const parts = activeModels
      .filter(m => modelResponses[m.id])
      .map((m, i) => `--- KAYNAK_${i + 1} ---\n${modelResponses[m.id]}`)
      .join("\n\n");

    const synthPrompt = `Sen bağımsız bir Sentez Editörüsün. Aşağıda aynı soruya 3 farklı kaynaktan gelen yanıtlar var.

Kurallar:
- Sana sunulan 3 adet bağımsız KAYNAK metnini sentezle
- Asla "her iki model" deme, her zaman "3 yanıt" veya "tüm kaynaklar" kullan
- Selamlama ve dolgu cümlelerini yoksay
- Kaynaklar aynı şeyi söylüyorsa bir kez yaz
- Kaynaklar arasında teknik çelişki varsa MUTLAKA belirt
- Kritik hatalar varsa öne çıkar
- Teknik sorularda en doğru kodu öne çıkar
- Giriş cümlesi yazma, direkt cevaba gir
- Cevabı Türkçe ver

Örnek doğru kullanım: "İncelenen 3 yanıta göre..." ✅
Örnek yanlış kullanım: "Her iki modele göre..." ❌

SORU: ${userPrompt}

${parts}

Markdown formatı kullan.`;

    let synthText = "";
    const maestroMsgId = genMsgId();

    // FIX #3: Placeholder mesaj ID ile eklenir
    // FIX #6: chatLoading HALA true — kullanıcı "bitmedi" anlıyor
    setChatMessages((prev) => [
      ...prev,
      {
        id: maestroMsgId,
        role: "maestro",
        content: "",
        modelResponses,
        timings: modelTimings,
        models: activeModels,
      },
    ]);

    // FIX #3: Streaming sırasında ID ile güncelle (son eleman varsayma yok)
    await streamModel("judge", synthPrompt, apiKeys.judgeKey, (token) => {
      synthText += token;
      setChatMessages((prev) =>
        prev.map(msg =>
          msg.id === maestroMsgId ? { ...msg, content: synthText } : msg
        )
      );
    });

    // FIX #6: Synthesis bitti, ŞİMDİ loading kapat
    setChatLoading(false);

    // Memory'e kaydet
    saveChat({
      prompt: userPrompt,
      messages: [
        ...chatMessages,
        { id: genMsgId(), role: "user", content: userPrompt },
        { id: maestroMsgId, role: "maestro", content: synthText },
      ],
      mode: 'chat',
    });
}
  // ── ORCHESTRATION MODE ──
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
// ── Share/Export ──
  function handleExportMarkdown() {
    if (chatMessages.length === 0) return;
    
    let md = `# Maestro Sohbet\n`;
    md += `*${new Date().toLocaleString('tr-TR')}*\n\n---\n\n`;
    
    for (const msg of chatMessages) {
      if (msg.role === 'user') {
        md += `## 🧑 Kullanıcı\n\n${msg.content}\n\n`;
      } else if (msg.role === 'maestro') {
        md += `## ✦ Maestro\n\n${msg.content}\n\n`;
        
        // Model yanıtlarını da ekle
        if (msg.modelResponses) {
          md += `<details>\n<summary>Model Yanıtları</summary>\n\n`;
          const models = msg.models || [];
          for (const m of models) {
            if (msg.modelResponses[m.id]) {
              md += `### ${m.name}\n\n${msg.modelResponses[m.id]}\n\n`;
            }
          }
          md += `</details>\n\n`;
        }
      }
      md += `---\n\n`;
    }
    
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maestro-chat-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleShareLink() {
    if (chatMessages.length === 0) return;
    
    // Sadece kullanıcı sorusu ve maestro sentezini al (hafif payload)
    const shareData = chatMessages.map(msg => ({
      r: msg.role === 'user' ? 'u' : 'm',
      c: msg.content?.slice(0, 2000) || '',
    }));
    
    const json = JSON.stringify(shareData);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    
    // URL hash olarak ekle
    const shareUrl = `${window.location.origin}${window.location.pathname}#share=${encoded}`;
    
    // Clipboard'a kopyala
    navigator.clipboard.writeText(shareUrl).catch(() => {
      // Fallback: prompt ile göster
      prompt('Paylaşım linki:', shareUrl);
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

 async function handleAsk() {
  if (mode === "chat") {
    handleChatAsk();
  } else if (mode === "orchestration") {
    handleOrchAsk();
  } else if (mode === "autonomous") {
    if (!prompt.trim()) return;
    const userPrompt = prompt;
    setPrompt("");
    setChatMessages(prev => [...prev, { id: genMsgId(), role: "user", content: userPrompt }]);
    setChatLoading(true);
    try {
      const result = await run(userPrompt);
      setChatMessages(prev => [...prev, {
        id: genMsgId(),
        role: "maestro",
        content: result || "Görev tamamlandı.",
        modelResponses: {},
        timings: {},
        models: [],
      }]);
    } catch (err) {
      setChatMessages(prev => [...prev, {
        id: genMsgId(),
        role: "maestro",
        content: "Autonomous hata verdi: " + err.message,
        modelResponses: {},
        timings: {},
        models: [],
      }]);
    }
    setChatLoading(false);
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
        setMode={(m) => { setMode(m); if (m !== 'autonomous') setPref('defaultMode', m); }}
        chatHistory={chats}
        onLoadChat={(chatId) => {
          const chat = loadChat(chatId);
          if (chat) {
            setChatMessages(chat.messages);
            setMode('chat');
          }
        }}
        onDeleteChat={deleteChat}
        onClearHistory={clearAllChats}
        onExportMarkdown={handleExportMarkdown}
        onShareLink={handleShareLink}
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
  <div className="auto-header" style={{ marginTop: "60px" }}>
    
  </div>
)}
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

      {/* ── AUTONOMOUS MODE ── */}
{mode === "autonomous" && apiKeys && (
  <AutonomousMode hidePrompt={true} />
)}

      {/* ── PROMPT AREA ── */}
      
        <div className={`center-fixed ${mode === "chat" ? "chat-prompt-mode" : ""}`}>
          {mode === "orchestration" && asked && (
            <div className={`consensus-badge ${consensus}`}>
              {consensus === "high" ? "🟢 Yüksek Consensus" : "🔴 Görüşler Ayrışıyor"}
            </div>
          )}

          <div className="prompt-row" style={{ flexDirection: "column", alignItems: "center", gap: "8px" }}>

  <ModeToggle mode={mode} setMode={(m) => { setMode(m); if (m !== 'autonomous') setPref('defaultMode', m); }} />
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
        </div>
      <div ref={chatEndRef} />
    </div>
  );
}