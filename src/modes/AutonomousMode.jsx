import { useState, useRef, useEffect } from 'react';
import { useOrchestrator, STATES } from '../orchestrator/OrchestratorContext.jsx';
import ProgressTimeline from '../components/ProgressTimeline.jsx';
import TaskCard from '../components/TaskCard.jsx';
import ReactMarkdown from 'react-markdown';
export default function AutonomousMode({ hidePrompt = false }) {
  
  const {
    engineState, tasks, iteration, logs, finalOutput, synthesisStream, error,
    run, abort, isRunning,
  } = useOrchestrator();

  const [prompt, setPrompt] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [showAllResults, setShowAllResults] = useState(false);
  const [copied, setCopied] = useState(false);
  const logsEndRef = useRef(null);
  const outputRef = useRef(null);

  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

    useEffect(() => {
    if ((synthesisStream || finalOutput) && outputRef.current) {
      outputRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [synthesisStream, finalOutput]);

  const handleSubmit = () => {
  if (!prompt.trim() || isRunning) return;
  run(prompt.trim());
  setPrompt('');
};

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = () => {
    let textToCopy = finalOutput || synthesisStream || '';
    if (textToCopy.length < 200 && combinedResults.length > textToCopy.length) {
      textToCopy = combinedResults;
    }
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const combinedResults = tasks
    .filter(t => t.result && t.status === 'done')
    .map(t => `# ${t.title}\n\n${t.result}`)
    .join('\n\n---\n\n');

  const displayOutput = finalOutput || synthesisStream || null;
  const isSynthesizing = engineState === STATES.SYNTHESIZING;

  return (
    <div className="auto-container">
      {/* Başlık */}
      <div className="auto-header">
        <h2 className="auto-title">
          <span className="auto-title-icon">⚡</span>
          Otonom Mod
        </h2>
        <span className="auto-subtitle">
          Hakem görevi böler → Modeller çalışır → Hakem inceler → Teslim eder
        </span>
      </div>

      {/* Timeline */}
      {engineState !== STATES.IDLE && (
        <ProgressTimeline engineState={engineState} iteration={iteration} />
      )}

      {/* Hata */}
      {error && (
        <div className="auto-error">
          <strong>Hata:</strong> {error}
        </div>
      )}

      {/* Görev kartları */}
      {tasks.length > 0 && (
        <div className="auto-section">
          <h3 className="auto-section-title">
            Alt Görevler ({tasks.filter(t => t.status === 'done').length}/{tasks.length})
          </h3>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}

      {/* Son çıktı */}
      {(displayOutput || isSynthesizing) && (
        <div className="auto-section" ref={outputRef}>
          <h3 className="auto-section-title">
            {isSynthesizing && !finalOutput ? '⏳ Sentezleniyor...' : 'Son Teslimat'}
          </h3>
          <div className="auto-final-output">
            {displayOutput ? (
              <div className="auto-output-content">
                <ReactMarkdown>{displayOutput}</ReactMarkdown>
                {isSynthesizing && (
                  <span className="auto-typing-indicator">▌</span>
                )}
              </div>
            ) : (
              <div className="auto-output-content auto-output-loading">
                Modeller sentezliyor, lütfen bekleyin...
              </div>
            )}
            {displayOutput && (
              <button onClick={handleCopy} className="auto-copy-btn">
                {copied ? '✓ Kopyalandı' : '📋 Kopyala'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Birleşik ham sonuçlar */}
      {finalOutput && combinedResults.length > finalOutput.length + 200 && (
        <div className="auto-section">
          <button
            onClick={() => setShowAllResults(!showAllResults)}
            className="auto-log-toggle"
          >
            {showAllResults ? '▾' : '▸'} Tüm Model Çıktılarını Göster
          </button>
          {showAllResults && (
            <div className="auto-final-output" style={{ marginTop: '8px' }}>
              <div className="auto-output-content">
                <ReactMarkdown>{combinedResults}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Aktivite logu */}
      {logs.length > 0 && (
        <div className="auto-section">
          <button onClick={() => setShowLogs(!showLogs)} className="auto-log-toggle">
            {showLogs ? '▾' : '▸'} Aktivite Logu ({logs.length})
          </button>
          {showLogs && (
            <div className="auto-log-box">
              {logs.map((log, i) => (
                <div key={i} className="auto-log-line">{log}</div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}

{/* ── PROMPT BAR — altta sabit ── */}
      {!hidePrompt && (
        <div className="auto-prompt-fixed">
          <div className="auto-prompt-row">
            <textarea
              className="prompt-input"
              value={prompt}
              onChange={e => {
                setPrompt(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder="Maestro'ya görev ver..."
              disabled={isRunning}
              rows={1}
            />
            {isRunning ? (
              <button onClick={abort} className="auto-abort-btn auto-prompt-btn">■</button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!prompt.trim()}
                className="auto-run-btn auto-prompt-btn"
                style={{ opacity: prompt.trim() ? 1 : 0.4 }}
              >
                BAŞLAT
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}