import { STATES } from '../orchestrator/OrchestratorContext.jsx';

const PHASES = [
  { state: STATES.PLANNING,  label: 'Planlama',   icon: '🧠' },
  { state: STATES.EXECUTING, label: 'Yürütme',    icon: '⚡' },
  { state: STATES.REVIEWING, label: 'İnceleme',   icon: '🔍' },
  { state: STATES.COMPLETE,  label: 'Tamamlandı', icon: '✅' },
];

const STATE_ORDER = {
  [STATES.IDLE]: -1,
  [STATES.PLANNING]: 0,
  [STATES.EXECUTING]: 1,
  [STATES.REVIEWING]: 2,
  [STATES.REFINING]: 2,
  [STATES.COMPLETE]: 3,
  [STATES.FAILED]: -1,
};

export default function ProgressTimeline({ engineState, iteration }) {
  const currentIdx = STATE_ORDER[engineState] ?? -1;

  return (
    <div className="timeline-container">
      <div className="timeline-row">
        {PHASES.map((phase, i) => {
          const isActive = i === currentIdx;
          const isDone = i < currentIdx;
          const cls = isDone ? 'done' : isActive ? 'active' : 'future';

          return (
            <div key={phase.state} className="timeline-phase">
              {i > 0 && <div className={`timeline-connector ${cls}`} />}
              <div className={`timeline-node ${cls}`}>
                <span className="timeline-icon">{phase.icon}</span>
              </div>
              <span className={`timeline-label ${cls}`}>{phase.label}</span>
            </div>
          );
        })}
      </div>

      {iteration > 0 && engineState !== STATES.COMPLETE && engineState !== STATES.IDLE && (
        <div className="timeline-iter-badge">İterasyon {iteration}/3</div>
      )}
    </div>
  );
}