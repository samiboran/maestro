import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

const STATUS_CONFIG = {
  pending:        { label: 'Sırada',      color: '#6b7280', icon: '○' },
  running:        { label: 'Çalışıyor…',  color: '#d97706', icon: '◉', pulse: true },
  done:           { label: 'Tamamlandı',  color: '#059669', icon: '✓' },
  needs_revision: { label: 'Revize',      color: '#dc2626', icon: '↻' },
};

const MODEL_COLORS = {
  'groq-llama4':  '#7F77DD',
  'groq-gptoss':  '#1D9E75',
  'groq-qwen3':   '#378ADD',
};

const MODEL_NAMES = {
  'groq-llama4':  'Llama 4',
  'groq-gptoss':  'GPT OSS',
  'groq-qwen3':   'Qwen 3',
};

export default function TaskCard({ task }) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const modelColor = MODEL_COLORS[task.assignedModel] || '#6b7280';
  const modelName = MODEL_NAMES[task.assignedModel] || task.assignedModel;

  return (
    <div className="task-card">
      <div className="task-card-header">
        <div className="task-card-left">
          <span
            className={`task-status-icon ${status.pulse ? 'pulse' : ''}`}
            style={{ color: status.color }}
          >
            {status.icon}
          </span>
          <span className="task-title">{task.title}</span>
        </div>
        <span
          className="task-model-badge"
          style={{
            backgroundColor: modelColor + '15',
            color: modelColor,
            borderColor: modelColor + '40',
          }}
        >
          {modelName}
        </span>
      </div>

      <div className="task-status-line">
        <span style={{ color: status.color, fontSize: '12px', fontWeight: 500 }}>
          {status.label}
        </span>
        {task.feedback && (
          <span className="task-feedback-tag">Geri bildirim var</span>
        )}
      </div>

      {task.result && (
        <div>
          <button onClick={() => setExpanded(!expanded)} className="task-expand-btn">
            {expanded ? '▾ Sonucu gizle' : '▸ Sonucu göster'}
          </button>
          {expanded && (
            <div className="task-result-box">
              <ReactMarkdown>{task.result.slice(0, 3000)}</ReactMarkdown>
              {task.result.length > 3000 && <p className="task-truncated">…[kısaltıldı]</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}