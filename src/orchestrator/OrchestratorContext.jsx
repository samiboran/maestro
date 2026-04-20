/**
 * OrchestratorContext.jsx
 * OrchestratorEngine'i saran React Context.
 * AutonomousMode ve alt bileşenlerine durum + aksiyonlar sağlar.
 *
 * v1.2 — synthesisStream (canlı sentez) desteği eklendi
 */

import { createContext, useContext, useReducer, useCallback, useRef, useState } from 'react';
import OrchestratorEngine, { STATES } from './OrchestratorEngine.js';

const OrchestratorContext = createContext(null);

/* ── Reducer ── */

const initialState = {
  engineState: STATES.IDLE,
  tasks: [],
  iteration: 0,
  logs: [],
  finalOutput: null,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'STATE_CHANGE':
      return {
        ...state,
        engineState: action.payload.state,
        tasks: action.payload.tasks || state.tasks,
        iteration: action.payload.iteration ?? state.iteration,
        finalOutput: action.payload.finalOutput ?? state.finalOutput,
      };
    case 'TASK_UPDATE': {
      const updated = action.payload;
      const tasks = state.tasks.map(t =>
        t.id === updated.id ? updated : t
      );
      if (!state.tasks.find(t => t.id === updated.id)) {
        tasks.push(updated);
      }
      return { ...state, tasks };
    }
    case 'LOG':
      return {
        ...state,
        logs: [...state.logs, action.payload],
      };
    case 'ERROR':
      return { ...state, error: action.payload };
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }
}

/* ── Provider ── */

export function OrchestratorProvider({ streamModel, judgeModel, fetchUrl, children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const engineRef = useRef(null);
  const [synthesisStream, setSynthesisStream] = useState('');

  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new OrchestratorEngine({
        streamModel,
        judgeModel,
        fetchUrl,
        onStateChange: (engineState, data) => {
          dispatch({
            type: 'STATE_CHANGE',
            payload: { state: engineState, ...data },
          });
        },
        onTaskUpdate: (task) => {
          dispatch({ type: 'TASK_UPDATE', payload: task });
        },
        onLog: (msg) => {
          dispatch({ type: 'LOG', payload: msg });
        },
        onSynthesisChunk: (text) => setSynthesisStream(text),
      });
    }
    return engineRef.current;
  }, [streamModel, judgeModel, fetchUrl]);

  const run = useCallback(async (prompt) => {
    dispatch({ type: 'RESET' });
    setSynthesisStream('');
    try {
      const result = await getEngine().run(prompt);
      return result;
    } catch (err) {
      dispatch({ type: 'ERROR', payload: err.message });
    }
  }, [getEngine]);

  const abort = useCallback(() => {
    engineRef.current?.abort();
  }, []);

  const value = {
    ...state,
    run,
    abort,
    synthesisStream,
    fetchUrl,
    isRunning: ![STATES.IDLE, STATES.COMPLETE, STATES.FAILED].includes(state.engineState),
  };

  return (
    <OrchestratorContext.Provider value={value}>
      {children}
    </OrchestratorContext.Provider>
  );
}

export function useOrchestrator() {
  const ctx = useContext(OrchestratorContext);
  if (!ctx) throw new Error('useOrchestrator, OrchestratorProvider içinde kullanılmalıdır');
  return ctx;
}

export { STATES };