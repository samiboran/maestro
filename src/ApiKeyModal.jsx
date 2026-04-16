import { useState } from "react";

export default function ApiKeyModal({ onSave, onSkip }) {
  const [keys, setKeys] = useState({
    claude: "",
    chatgpt: "",
    gemini: "",
  });

  function handleSave() {
    if (!keys.claude && !keys.chatgpt && !keys.gemini) return;
    localStorage.setItem("maestro_keys", JSON.stringify(keys));
    onSave(keys);
  }

  function handleSkip() {
    const emptyKeys = { claude: "", chatgpt: "", gemini: "" };
    localStorage.setItem("maestro_keys", JSON.stringify(emptyKeys));
    if (onSkip) {
      onSkip();
    } else {
      onSave(emptyKeys);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button 
          className="modal-close" 
          onClick={handleSkip}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: '#6b7280',
          }}
        >
          ✕
        </button>
        
        <h2 className="modal-title">API Anahtarları</h2>
        <p className="modal-sub">Kullanmak istediğin modellerin key'lerini gir</p>

        {[
          { id: "claude", label: "Claude (Anthropic)", color: "#7F77DD", placeholder: "sk-ant-..." },
          { id: "chatgpt", label: "ChatGPT (OpenAI)", color: "#1D9E75", placeholder: "sk-..." },
          { id: "gemini", label: "Gemini (Google)", color: "#378ADD", placeholder: "AIza..." },
        ].map((m) => (
          <div key={m.id} className="key-field">
            <label className="key-label" style={{ color: m.color }}>{m.label}</label>
            <input
              type="password"
              className="key-input"
              placeholder={m.placeholder}
              value={keys[m.id]}
              onChange={(e) => setKeys((k) => ({ ...k, [m.id]: e.target.value }))}
            />
          </div>
        ))}

        <div className="modal-actions">
          <button className="modal-btn secondary" onClick={handleSkip}>
            Şimdilik Geç
          </button>
          <button className="modal-btn primary" onClick={handleSave}>
            Kaydet ve Başla
          </button>
        </div>
      </div>
    </div>
  );
}