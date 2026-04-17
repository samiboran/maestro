import { useState, useEffect } from "react";
import maestroChar from "./assets/miya.jpg";
import ApiKeyModal from "./ApiKeyModal";
import Sidebar from "./components/Sidebar";
import DraggablePanel from "./components/DraggablePanel";
import { WORKER_URL } from "./config";
import "./App.css";
import "./styles/Prompt.css";
import ReactMarkdown from 'react-markdown';

const MODELS = [
  { id: "claude", name: "Llama 3.3 70B", color: "#7F77DD", initialX: 50, initialY: 20 },
  { id: "chatgpt", name: "GPT-OSS 120B", color: "#1D9E75", initialX: 440, initialY: 20 },
  { id: "gemini", name: "Llama 3.1 8B", color: "#378ADD", initialX: 830, initialY: 20 },
];

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [showSynthesis, setShowSynthesis] = useState(false);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);
  const [synthesis, setSynthesis] = useState(null);
  const [synthModel, setSynthModel] = useState(null);
  const [showOrchestration, setShowOrchestration] = useState(false);
  const [asked, setAsked] = useState(false);
  const [apiKeys, setApiKeys] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [timings, setTimings] = useState({});
  const [sessionHistory, setSessionHistory] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("maestro_keys");
    if (saved) {
      setApiKeys(JSON.parse(saved));
    } else {
      setShowModal(true);
    }
  }, []);

  const consensus = Object.keys(responses).length === 3 ? "high" : null;

  async function askModel(model, prompt, apiKey) {
  const start = Date.now();
  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model, apiKey }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = ''; // Yarım kalan verileri tutmak için buffer

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Yeni gelen parçayı buffer'a ekle
      buffer += decoder.decode(value, { stream: true });

      // Buffer'ı satırlara böl
      const events = buffer.split('\n\n');
buffer = events.pop() || '';
      
      

      for (const event of events) {
        const line = event.trim();
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        try {
          const json = JSON.parse(data);
          if (json.token) {
            setResponses(r => ({
              ...r,
              [model]: (r[model] || '') + json.token
            }));
          }
        } catch (e) {
          console.error("JSON parse hatası:", data);
        }
      }
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    return { elapsed };
  } catch (e) {
    setResponses(r => ({ ...r, [model]: 'Bağlantı hatası' }));
    return { elapsed: '—' };
  }
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
  }
  async function handleAsk() {
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
    setSessionHistory(prev => [...prev, {
      timestamp: new Date().toISOString(),
      prompt,
    }]);
  }
function exportACTP() {
    const session = {
      actp_version: "0.2",
      created_at: new Date().toISOString(),
      project: {
        name: "Maestro Session",
        description: "Multi-model AI orchestration session"
      },
      session: {
        started_at: sessionHistory[0]?.timestamp || new Date().toISOString(),
        ended_at: new Date().toISOString(),
        queries: sessionHistory.map((entry, i) => ({
          order: i + 1,
          timestamp: entry.timestamp,
          prompt: entry.prompt,
          model_responses: Object.entries(responses).map(([id, text]) => ({
            model: MODELS.find(m => m.id === id)?.name || id,
            response: text,
            response_time: timings[id] ? `${timings[id]}s` : null,
          })),
        })),
        synthesis: synthesis ? {
          judge_model: MODELS.find(m => m.id === synthModel)?.name || synthModel,
          result: synthesis,
        } : null,
      },
      decisions: [],
      open_questions: [],
      next_steps: [],
    };

    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maestro-session-${new Date().toISOString().slice(0, 10)}.actp`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function handleSynthesize(modelId) {
    if (!responses[modelId]) return;
    setSynthModel(modelId);
    setSynthesis('');
    setShowSynthesis(true);

    const modelNames = { claude: 'Llama 3.3 70B', chatgpt: 'GPT-OSS 120B', gemini: 'Groq Compound' };

    const synthPrompt = `Sen bir AI hakem/analistsin. Aşağıda aynı soruya 3 farklı AI modelinin verdiği cevaplar var.

GÖREV:
1. Önce kısa bir ÖZET yaz — üç cevabın ortak noktalarını ve temel bulgularını birleştir.
2. Sonra MODEL ANALİZİ yap — her modelin güçlü ve zayıf yönlerini belirt.
3. Son olarak EN İYİ CEVAP değerlendirmesi yap — hangisi bu soruya en iyi cevap verdi ve neden?

SORU: ${prompt}

${Object.entries(responses).map(([id, text]) => `--- ${modelNames[id] || id} ---\n${text}`).join('\n\n')}

Türkçe yaz. Markdown formatı kullan.`;

    const start = Date.now();
    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: synthPrompt, model: modelId, apiKey: apiKeys[modelId] }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          try {
            const json = JSON.parse(data);
            if (json.token) {
              setSynthesis(prev => (prev || '') + json.token);
            }
          } catch {}
        }
      }
    } catch (e) {
      setSynthesis('Synthesis sırasında hata oluştu.');
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
    <div className={`maestro-root ${sidebarOpen ? "sidebar-open" : ""}`}>
            {showSynthesis && synthesis !== null && (
        <div className="synth-modal-overlay" onClick={() => setShowSynthesis(false)}>
          <div className="synth-modal" onClick={e => e.stopPropagation()}>
            <button className="synth-modal-close" onClick={() => setShowSynthesis(false)}>✕</button>
            <div className="synth-modal-header">
              <span className="synth-modal-icon">∑</span>
              <span>Synthesis</span>
              {synthModel && (
                <span className="synth-modal-by" style={{ color: MODELS.find(m => m.id === synthModel)?.color }}>
                  — {MODELS.find(m => m.id === synthModel)?.name}
                </span>
              )}
            </div>
            <div className="synth-modal-body">
              {synthesis ? <ReactMarkdown>{synthesis}</ReactMarkdown> : <span className="synth-loading">Analiz ediliyor...</span>}
            </div>
          </div>
        </div>
      )}
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
      />

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
              ⚡ <span style={{ color: m.color }}>{m.name}</span> → {timings[m.id] ? `${timings[m.id]}s` : "bekleniyor..."}
            </div>
          ))}
          {synthModel && (
            <div className="orch-step">
              🧠 Synthesis — <span style={{ color: MODELS.find((m) => m.id === synthModel)?.color }}>{MODELS.find((m) => m.id === synthModel)?.name}</span>
            </div>
          )}
        </div>
      )}

      {/* Sürüklenebilir Model Panelleri */}
      
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

      {/* Merkez: Karakter + Prompt */}
      <div className="center-fixed">
  {asked && (
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
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleAsk();
        }
      }}
      rows={1}
    />
    <button className="ask-btn" onClick={handleAsk} disabled={loading}>
      {loading ? "..." : "SOR"}
    </button>
  </div>
  <div className={`char-wrap ${loading ? "conducting" : ""}`}>
    <img src={maestroChar} alt="Maestro" className="char-img" />
    <div className="char-glow" />
  </div>
</div>

        {Object.keys(responses).length === MODELS.filter(m => apiKeys?.[m.id]).length && (
  <button className="synthesis-trigger" onClick={() => setShowSynthesis(true)}>
  ∑ Synthesis
</button>
)}
{showSynthesis && !synthesis && (
  <div className="synthesis-btns" style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
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
  );
}