import { useState } from "react";
import ReactMarkdown from "react-markdown";

const LONG_MSG_THRESHOLD = 280;

// Çelişki tespiti — sentez metninde bu kelimeler varsa uyarı göster
const CONFLICT_KEYWORDS = [
  "çelişki", "çelişiyor", "farklı görüş", "farklı yaklaşım",
  "uyuşmuyor", "tutarsız", "ayrışıyor", "karşıt",
  "öte yandan", "aksine", "ancak dikkat", "hatalı",
  "yanlış", "eksik bırak", "conflict", "disagree",
];

function detectConflict(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return CONFLICT_KEYWORDS.some(kw => lower.includes(kw));
}

export default function ChatView({ messages, loading, thinkingPhase, onRetry }) {
  return (
    <div className="chat-root">
      <div className="chat-view">
        <div className="chat-column">
          <div className="chat-messages">
            {messages.length === 0 && !loading && (
              <div className="chat-welcome">
                <div className="chat-welcome-icon">✦</div>
                <h2 className="chat-welcome-title">Maestro</h2>
                <p className="chat-welcome-sub">3 model soruyor, en iyi cevabı sentezliyor.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <ChatBubble key={msg.id || i} message={msg} onRetry={onRetry} index={i} />
            ))}
            {loading && (
              <div className="chat-bubble maestro">
                <div className="chat-bubble-header">
                  <span className="chat-bubble-name">Maestro</span>
                </div>
                <ThinkingIndicator phase={thinkingPhase} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ message, onRetry, index }) {
  const [showModels, setShowModels] = useState(false);
  const [copied, setCopied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  if (message.role === "user") {
    const isLong = message.content.length > LONG_MSG_THRESHOLD;
    return (
      <>
        <div
          className={`chat-bubble user${isLong ? " user-long" : ""}`}
          onClick={isLong ? () => setModalOpen(true) : undefined}
        >
          {isLong ? (
            <>
              <p className="user-preview">{message.content.slice(0, LONG_MSG_THRESHOLD)}…</p>
              <span className="user-expand-hint">↗ Tamamını gör</span>
            </>
          ) : (
            <p>{message.content}</p>
          )}
        </div>
        {isLong && modalOpen && (
          <TextModal content={message.content} onClose={() => setModalOpen(false)} />
        )}
      </>
    );
  }

  function handleCopy() {
    navigator.clipboard.writeText(message.content || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const hasConflict = message.role === "maestro" && message.content && detectConflict(message.content);

  return (
    <div className="chat-bubble maestro">
      <div className="chat-bubble-header">
        <span className="chat-bubble-name">Maestro</span>
        {message.timings && (
          <span className="chat-bubble-meta">
            {Object.values(message.timings).filter(Boolean).length} model ·{" "}
            {Math.max(...Object.values(message.timings).filter(Boolean).map(Number))}s
          </span>
        )}
      </div>

      {/* Çelişki uyarısı — sadece çelişki varsa gösterilir */}
      {hasConflict && (
        <div className="confidence-alert">
          <span className="confidence-alert-icon">⚠</span>
          <span className="confidence-alert-text">
            Modeller arasında farklı görüşler tespit edildi — detaylar sentezde belirtilmiştir.
          </span>
        </div>
      )}

      <div className="chat-bubble-content">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>
      {message.content && (
        <div className="copy-bar">
          <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
            <span className="copy-icon">{copied ? '✓' : '⧉'}</span>
            <span className="copy-text">{copied ? 'Kopyalandı' : 'Kopyala'}</span>
          </button>
          {onRetry && (
            <button className="retry-btn" onClick={() => onRetry(index)}>
              ↻ Tekrar
            </button>
          )}
        </div>
      )}
      {message.modelResponses && Object.keys(message.modelResponses).length > 0 && (
        <div className="model-toggle-area">
          <button className="model-toggle-btn" onClick={() => setShowModels(!showModels)}>
            {showModels ? "▾ Modelleri gizle" : "▸ Modelleri gör"}
          </button>
          {showModels && (
            <div className="model-responses-accordion">
              {message.models.map((m) => (
                <ModelAccordionItem key={m.id} model={m} response={message.modelResponses[m.id]} timing={message.timings?.[m.id]} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TextModal({ content, onClose }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="text-modal-overlay" onClick={onClose}>
      <div className="text-modal" onClick={e => e.stopPropagation()}>
        <div className="text-modal-header">
          <span className="text-modal-title">Mesaj</span>
          <div className="text-modal-actions">
            <button className="text-modal-btn" onClick={handleCopy}>
              {copied ? "✓ Kopyalandı" : "⧉ Kopyala"}
            </button>
            <button className="text-modal-btn close" onClick={onClose}>✕ Kapat</button>
          </div>
        </div>
        <div className="text-modal-body">
          <p>{content}</p>
        </div>
      </div>
    </div>
  );
}

function ModelAccordionItem({ model, response, timing }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="model-accordion-item" style={{ "--mc": model.color }}>
      <button className="model-accordion-header" onClick={() => setOpen(!open)}>
        <span className="model-accordion-dot" />
        <span className="model-accordion-name">{model.name}</span>
        {timing && <span className="model-accordion-time">{timing}s</span>}
        <span className="model-accordion-arrow">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="model-accordion-body">
          <ReactMarkdown>{response || "Cevap alınamadı."}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function ThinkingIndicator({ phase }) {
  const phases = [
    { label: "Modellere soruluyor", icon: "📡" },
    { label: "Cevaplar analiz ediliyor", icon: "🔍" },
    { label: "Sentez hazırlanıyor", icon: "✦" },
  ];
  return (
    <div className="thinking-indicator">
      {phases.map((p, i) => (
        <div key={i} className={`thinking-step ${phase > i ? "done" : ""} ${phase === i ? "active" : ""}`}>
          <span className="thinking-icon">{phase > i ? "✓" : p.icon}</span>
          <span className="thinking-label">{p.label}</span>
        </div>
      ))}
      <div className="thinking-dots">
        <span className="dot" /><span className="dot" /><span className="dot" />
      </div>
    </div>
  );
}
