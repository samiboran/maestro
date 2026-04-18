import { useState } from "react";

export default function ApiKeyModal({ onSave, onSkip }) {
  const [groqKey, setGroqKey] = useState("");

  function handleSave() {
    if (!groqKey.trim()) return;
    const keys = {
      claude: groqKey,
      chatgpt: groqKey,
      gemini: groqKey,
    };
    localStorage.setItem("maestro_keys", JSON.stringify(keys));
    onSave(keys);
  }

  function handleSkip() {
    const emptyKeys = { claude: "", chatgpt: "", gemini: "" };
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

        <h2 className="modal-title">Groq API Key</h2>
        <p className="modal-sub">
          console.groq.com adresinden ücretsiz key alabilirsin.
          <br />
          Llama 4 Scout, GPT OSS 120B ve Qwen 3 32B modelleri bu key ile çalışır.
        </p>

        <div className="key-field">
          <label className="key-label" style={{ color: "#9a7a4a" }}>
            Groq API Key
          </label>
          <input
            type="password"
            className="key-input"
            placeholder="gsk_..."
            value={groqKey}
            onChange={(e) => setGroqKey(e.target.value)}
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