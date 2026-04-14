import { useState, useEffect } from "react";
import maestroChar from "./assets/miya.jpg";
import ApiKeyModal from "./ApiKeyModal";
import DraggablePanel from "./components/DraggablePanel";
import { WORKER_URL } from "./config";
import "./App.css";

const MODELS = [
  { id: "claude", name: "Claude", color: "#7F77DD", initialSnap: "left" },
  { id: "chatgpt", name: "ChatGPT", color: "#1D9E75", initialSnap: "right" },
  { id: "gemini", name: "Gemini", color: "#378ADD", initialSnap: "bottom-center" },
];

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);
  const [synthesis, setSynthesis] = useState(null);
  const [synthModel, setSynthModel] = useState(null);
  const [showOrchestration, setShowOrchestration] = useState(false);
  const [asked, setAsked] = useState(false);
  const [apiKeys, setApiKeys] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [timings, setTimings] = useState({});

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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model, apiKey }),
      });
      const data = await res.json();
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      return { text: data.text, elapsed };
    } catch (e) {
      return { text: "Bağlantı hatası", elapsed: "—" };
    }
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
      setResponses((r) => ({ ...r, [m.id]: result.text }));
      setTimings((t) => ({ ...t, [m.id]: result.elapsed }));
    });

    await Promise.all(promises);
    setLoading(false);
    setAsked(true);
  }

  async function handleSynthesize(modelId) {
    if (!responses[modelId]) return;
    setSynthModel(modelId);
    setSynthesis(null);

    const synthPrompt = `Aşağıda aynı soruya verilen farklı AI cevapları var. Bunları analiz edip tek bir synthesis yap:\n\nSoru: ${prompt}\n\nCevaplar:\n${Object.entries(responses)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n\n")}\n\nKısa, net bir synthesis yaz.`;

    const result = await askModel(modelId, synthPrompt, apiKeys[modelId]);
    setSynthesis(result.text);
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
    <div className="maestro-root">
      <div className="bg-noise" />
      <div className="bg-glow" />

      {/* Snap noktaları göstergesi */}
      <div className="snap-guides">
        <div className="snap-point" style={{ left: '15%', top: '35%' }} />
        <div className="snap-point" style={{ left: '85%', top: '35%' }} />
        <div className="snap-point" style={{ left: '50%', top: '85%' }} />
      </div>

      {showModal && (
        <ApiKeyModal
          onSave={(keys) => {
            setApiKeys(keys);
            setShowModal(false);
          }}
        />
      )}

      <button className="settings-btn" onClick={() => setShowModal(true)}>⚙</button>

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
          initialSnap={model.initialSnap}
          zIndex={10 + idx}
        >
          {renderModelContent(model.id)}
        </DraggablePanel>
      ))}

      {/* Merkez: Karakter + Prompt */}
      <div className="center-fixed">
        <div className={`char-wrap ${loading ? "conducting" : ""}`}>
          <img src={maestroChar} alt="Maestro" className="char-img" />
          <div className="char-glow" />
        </div>

        {asked && (
          <div className={`consensus-badge ${consensus}`}>
            {consensus === "high" ? "🟢 Yüksek Consensus" : "🔴 Görüşler Ayrışıyor"}
          </div>
        )}

        <div className="prompt-area">
          <textarea
            className="prompt-input"
            placeholder="Maestro'ya sor..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
            rows={2}
          />
          <button className="ask-btn" onClick={handleAsk} disabled={loading}>
            {loading ? "..." : "Sor"}
          </button>
        </div>

        {asked && (
          <div className="synthesis-area">
            <div className="synthesis-label">Synthesis — hakem seç:</div>
            <div className="synthesis-btns">
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
            {synthesis && (
              <div className="synthesis-result">
                <span className="synth-by" style={{ color: MODELS.find((m) => m.id === synthModel)?.color }}>
                  {MODELS.find((m) => m.id === synthModel)?.name} diyor:
                </span>
                <p>{synthesis}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}