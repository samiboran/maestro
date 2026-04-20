import { useState } from 'react';

export default function Sidebar({
  onNewChat, onExportSession, onOpenSettings,
  isOpen, setIsOpen, mode, setMode,
  chatHistory, onLoadChat, onDeleteChat, onClearHistory,
  onExportMarkdown, onShareLink,
}) {
  const [showHistory, setShowHistory] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  function formatDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Az önce';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} dk önce`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} sa önce`;
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  }

  function handleShareLink() {
    if (onShareLink) {
      onShareLink();
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    }
  }

  return (
    <>
      <button className="sidebar-toggle" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? "✕" : "☰"}
      </button>

      <div
        className={`sidebar-overlay ${isOpen ? "show" : ""}`}
        onClick={() => setIsOpen(false)}
      />

      <div className={`sidebar ${isOpen ? "open" : ""}`}>
        {/* Logo */}
        <div className="sidebar-header">
          <svg className="sidebar-logo" viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <linearGradient id="gradM" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7F77DD" />
                <stop offset="50%" stopColor="#1D9E75" />
                <stop offset="100%" stopColor="#378ADD" />
              </linearGradient>
            </defs>
            <text x="50" y="72" textAnchor="middle" fontFamily="Cinzel, serif" fontWeight="900" fontSize="80" fill="url(#gradM)">M</text>
          </svg>
          <span className="sidebar-title">Maestro</span>
        </div>

        {/* Ana mod */}
        <div className="sidebar-nav">
          <button
            className={`sidebar-nav-item ${mode === "chat" ? "active" : ""}`}
            onClick={() => setMode("chat")}
          >
            <span className="sidebar-nav-icon">💬</span>
            <span className="sidebar-nav-label">Chat</span>
          </button>
        </div>

        {/* Gelişmiş */}
        <div className="sidebar-nav">
          <button
            className="sidebar-nav-section"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <span className="sidebar-nav-icon" style={{ fontSize: '0.7rem' }}>{showAdvanced ? '▾' : '▸'}</span>
            <span className="sidebar-nav-label">Gelişmiş</span>
          </button>
          {showAdvanced && (
            <>
              <button
                className={`sidebar-nav-item ${mode === "orchestration" ? "active" : ""}`}
                onClick={() => setMode("orchestration")}
              >
                <span className="sidebar-nav-icon">🎛</span>
                <span className="sidebar-nav-label">Orkestrasyon</span>
                <span className="sidebar-badge muted">Debug</span>
              </button>
              <button
                className={`sidebar-nav-item ${mode === "autonomous" ? "active" : ""}`}
                onClick={() => setMode("autonomous")}
              >
                <span className="sidebar-nav-icon">⚡</span>
                <span className="sidebar-nav-label">Otonom</span>
                <span className="sidebar-badge warn">Beta</span>
              </button>
            </>
          )}
        </div>

        {/* Ayırıcı */}
        <div className="sidebar-divider" />

        {/* Menü */}
        <div className="sidebar-nav">
          <button className="sidebar-nav-item" onClick={onNewChat}>
            <span className="sidebar-nav-icon">＋</span>
            <span className="sidebar-nav-label">Yeni Sohbet</span>
          </button>

          {/* Export/Share — sadece chat modunda ve mesaj varken */}
          {mode === 'chat' && (
            <>
              <button className="sidebar-nav-item" onClick={onExportMarkdown}>
                <span className="sidebar-nav-icon">📄</span>
                <span className="sidebar-nav-label">Markdown İndir</span>
              </button>
              <button className="sidebar-nav-item" onClick={handleShareLink}>
                <span className="sidebar-nav-icon">🔗</span>
                <span className="sidebar-nav-label">
                  {shareToast ? '✓ Link Kopyalandı!' : 'Link Paylaş'}
                </span>
              </button>
            </>
          )}

          <button className="sidebar-nav-item" onClick={onExportSession}>
            <span className="sidebar-nav-icon">📋</span>
            <span className="sidebar-nav-label">Session Kaydet</span>
          </button>
          <button className="sidebar-nav-item" onClick={onOpenSettings}>
            <span className="sidebar-nav-icon">⚙</span>
            <span className="sidebar-nav-label">API Ayarları</span>
          </button>
        </div>

        {/* Geçmiş */}
        {chatHistory && chatHistory.length > 0 && (
          <div className="sidebar-history">
            <div className="sidebar-history-header">
              <button
                className="sidebar-history-toggle"
                onClick={() => setShowHistory(!showHistory)}
              >
                {showHistory ? '▾' : '▸'} Geçmiş ({chatHistory.length})
              </button>
              {showHistory && onClearHistory && (
                <button className="sidebar-history-clear" onClick={onClearHistory}>
                  Temizle
                </button>
              )}
            </div>
            {showHistory && (
              <div className="sidebar-history-list">
                {chatHistory.map(chat => (
                  <div key={chat.id} className="sidebar-history-item">
                    <button
                      className="sidebar-history-btn"
                      onClick={() => onLoadChat && onLoadChat(chat.id)}
                      title={chat.prompt}
                    >
                      <span className="sidebar-history-title">{chat.title}</span>
                      <span className="sidebar-history-date">{formatDate(chat.timestamp)}</span>
                    </button>
                    {onDeleteChat && (
                      <button
                        className="sidebar-history-delete"
                        onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                        title="Sil"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-models">
            <span className="model-dot dot-llama" />
            <span className="model-label">Llama 4</span>
            <span className="model-dot dot-gpt" />
            <span className="model-label">GPT OSS</span>
            <span className="model-dot dot-qwen" />
            <span className="model-label">Qwen 3</span>
          </div>
          <div className="sidebar-version">v1.2 · 3 Model + Hakem</div>
        </div>
      </div>
    </>
  );
}
