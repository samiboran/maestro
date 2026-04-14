import { useState } from "react";

export default function ApiKeyModal({ onSave }) {
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

  return (
    <div className="modal-overlay">
      <div className="modal">
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

        <button className="ask-btn" style={{ width: "100%", marginTop: "1rem" }} onClick={handleSave}>
          Kaydet ve Başla
        </button>
      </div>
    </div>
  );
}