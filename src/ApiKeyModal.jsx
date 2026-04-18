import { useState } from "react";

export default function ApiKeyModal({ onSave, onSkip }) {
  const [groqKey, setGroqKey] = useState("");
  const [cerebrasKey, setCerebrasKey] = useState("");

  function handleSave() {
    if (!groqKey.trim()) return;
    const keys = {
      claude: groqKey,
      chatgpt: groqKey,
      gemini: groqKey,
      judgeKey: cerebrasKey.trim() || "",
    };
    localStorage.setItem("maestro_keys", JSON.stringify(keys));
    onSave(keys);
  }

  function handleSkip() {
    const emptyKeys = { claude: "", chatgpt: "", gemini: "", judgeKey: "" };
    localStorage.setItem("maestro_keys", JSON.stringify(emptyKeys));
    if (onSkip) onSkip();
    else onSave(emptyKeys);
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button
          className="modal-close"
          onClick={handleSkip}
          style={{
            position: "absolute", top: "1rem", right: "1rem",
            background: "none", border: "none",
            fontSize: "1.5rem", cursor: "pointer", color: "#6b7280",
          }}
        >
          ✕
        </button>

        <h2 className="modal-title">API Ayarları</h2>
        <p className="modal-sub">
          İki API key gerekiyor — ikisi de ücretsiz.
        </p>

        <div className="key-field">
          <label className="key-label" style={{ color: "#9a7a4a" }}>
            Groq API Key
          </label>
          <p style={{ fontSize: "0.75rem", color: "#6b7280", margin: "0 0 0.5rem" }}>
            console.groq.com — 3 model için (Llama 4 Scout, GPT OSS 120B, Qwen 3 32B)
          </p>
          <input
            type="password"
            className="key-input"
            placeholder="gsk_..."
            value={groqKey}
            onChange={(e) => setGroqKey(e.target.value)}
          />
        </div>

        <div className="key-field" style={{ marginTop: "1rem" }}>
          <label className="key-label" style={{ color: "#7F77DD" }}>
            Cerebras API Key (Judge)
          </label>
          <p style={{ fontSize: "0.75rem", color: "#6b7280", margin: "0 0 0.5rem" }}>
            cloud.cerebras.ai — Qwen 3 235B sentez hakemi
          </p>
          <input
            type="password"
            className="key-input"
            placeholder="csk-..."
            value={cerebrasKey}
            onChange={(e) => setCerebrasKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </div>

        <div className="modal-actions">
          <button className="modal-btn secondary" onClick={handleSkip}>
            Şimdilik Geç
          </button>
          <button
            className="modal-btn primary"
            onClick={handleSave}
            disabled={!groqKey.trim()}
          >
            Kaydet ve Başla
          </button>
        </div>
      </div>
    </div>
  );
}