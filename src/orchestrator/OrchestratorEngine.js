/**
 * OrchestratorEngine.js
 * Ana durum makinesi + yürütme döngüsü (otonom görev orkestratörü).
 * 
 * v1.2 — Token limiti çözümü:
 *   - Sentez artık parçalı (chunked) çalışır
 *   - Sonuçlar kısaltılarak hakeme gönderilir
 *   - Streaming sentez desteği (finalOutput canlı güncellenir)
 * 
 * Durumlar: IDLE → PLANNING → EXECUTING → REVIEWING → REFINING → SYNTHESIZING → COMPLETE | FAILED
 */

const STATES = {
  IDLE: 'IDLE',
  PLANNING: 'PLANNING',
  EXECUTING: 'EXECUTING',
  REVIEWING: 'REVIEWING',
  REFINING: 'REFINING',
  SYNTHESIZING: 'SYNTHESIZING',
  COMPLETE: 'COMPLETE',
  FAILED: 'FAILED',
};

const MAX_ITERATIONS = 3;
const MAX_RESULT_CHARS = 1500; // Her görev sonucunun senteze gönderilen max uzunluğu

export default class OrchestratorEngine {
  constructor({ streamModel, judgeModel, fetchUrl, onStateChange, onTaskUpdate, onLog, onSynthesisChunk }) {
    this.streamModel = streamModel;
    this.fetchUrl = fetchUrl || null;
    this.judgeModel = judgeModel;
    this.onStateChange = onStateChange || (() => {});
    this.onTaskUpdate = onTaskUpdate || (() => {});
    this.onLog = onLog || (() => {});
    this.onSynthesisChunk = onSynthesisChunk || (() => {}); // YENİ: canlı sentez

    this.state = STATES.IDLE;
    this.tasks = [];
    this.results = {};
    this.iteration = 0;
    this.finalOutput = null;
    this.aborted = false;
  }

  /* ── Genel API ── */

  async run(userPrompt) {
    this.aborted = false;
    this.iteration = 0;
    this.results = {};
    this.finalOutput = null;
    this.log(`Orkestrasyon başlatılıyor: "${userPrompt.slice(0, 80)}..."`);

    try {
      // Aşama 1: Planlama
      this.setState(STATES.PLANNING);
      this.tasks = await this._plan(userPrompt);
      this.log(`Plan oluşturuldu: ${this.tasks.length} alt görev`);

      // Aşama 2-3 döngüsü: Yürütme → İnceleme → (İyileştirme)
      while (this.iteration < MAX_ITERATIONS && !this.aborted) {
        this.iteration++;
        this.log(`── İterasyon ${this.iteration} ──`);

        this.setState(STATES.EXECUTING);
        await this._executeAll();

        this.setState(STATES.REVIEWING);
        const review = await this._review(userPrompt);

        if (review.approved) {
          this.log('Hakem tüm sonuçları onayladı');
          break;
        }

        if (this.iteration >= MAX_ITERATIONS) {
          this.log('Maksimum iterasyona ulaşıldı, en iyi sonuç teslim ediliyor');
          break;
        }

        this.setState(STATES.REFINING);
        this._applyFeedback(review.feedback);
        this.log(`${review.feedback.length} görev iyileştiriliyor`);
      }

      // Aşama 4: Sentez (YENİ: SYNTHESIZING durumu + streaming)
      this.setState(STATES.SYNTHESIZING);
      this.log('Son teslimat sentezleniyor...');
      this.finalOutput = await this._synthesize(userPrompt);
      this.setState(STATES.COMPLETE);
      return this.finalOutput;

    } catch (err) {
      this.log(`Hata: ${err.message}`);
      this.setState(STATES.FAILED);
      throw err;
    }
  }

  abort() {
    this.aborted = true;
    this.log('Orkestrasyon kullanıcı tarafından durduruldu');
    this.setState(STATES.IDLE);
  }

  /* ── Dahili aşamalar ── */

  async _plan(userPrompt) {
    const { planTasks } = await import('./TaskPlanner.js');
    const tasks = await planTasks(this.judgeModel, userPrompt, this.fetchUrl);

    return tasks.map((t, i) => ({
      id: `task-${i + 1}`,
      title: t.title,
      description: t.description,
      assignedModel: t.model || null,
      status: 'pending',
      result: null,
      feedback: null,
    }));
  }

 async _executeAll() {
  const { assignModels } = await import('./ModelRouter.js');
  this.tasks = assignModels(this.tasks);

  const toRun = this.tasks.filter(
    t => t.status === 'pending' || t.status === 'needs_revision'
  );

  // Tek görev veya bağımsız görevler → paralel
  if (toRun.length <= 1) {
    await Promise.all(toRun.map(task => this._executeTask(task)));
    return;
  }

  // İlk görevi çalıştır
  await this._executeTask(toRun[0]);

  // Geri kalanları paralel çalıştır (ilk görevin çıktısını görerek)
  await Promise.all(toRun.slice(1).map(task => this._executeTask(task)));
}

  async _executeTask(task) {
    task.status = 'running';
    this.onTaskUpdate({ ...task });

    try {
      let output = '';
     // Tamamlanan önceki görevlerin çıktılarını topla
const previousResults = this.tasks
  .filter(t => t.status === 'done' && t.id !== task.id && t.result)
  .map(t => `### ${t.title}\n${t.result.slice(0, 800)}`)
  .join('\n\n---\n\n');

const contextBlock = previousResults
  ? `\n\nÖnceki adımların çıktıları (bunlara dayanarak devam et):\n\n${previousResults}\n\n---\n\n`
  : '';

const prompt = task.feedback
  ? `${task.description}${contextBlock}\n\nÖnceki deneme geri bildirimi: ${task.feedback}\nLütfen geri bildirimi dikkate alarak yanıtınızı iyileştirin.`
  : `${task.description}${contextBlock}`;
      await this.streamModel(
        task.assignedModel,
        prompt,
        (chunk) => { output += chunk; }
      );

      task.result = output;
      task.status = 'done';
      this.results[task.id] = output;
      this.onTaskUpdate({ ...task });
      this.log(`✓ ${task.title} tamamlandı (${task.assignedModel})`);
    } catch (err) {
      task.status = 'done';
      task.result = `[Hata: ${err.message}]`;
      this.results[task.id] = task.result;
      this.onTaskUpdate({ ...task });
      this.log(`✗ ${task.title} başarısız: ${err.message}`);
    }
  }

  async _review(userPrompt) {
    const { reviewResults } = await import('./TaskValidator.js');
    return reviewResults(this.judgeModel, userPrompt, this.tasks);
  }

  _applyFeedback(feedback) {
    for (const fb of feedback) {
      const task = this.tasks.find(t => t.id === fb.taskId);
      if (task) {
        task.status = 'needs_revision';
        task.feedback = fb.suggestion;
        this.onTaskUpdate({ ...task });
      }
    }
  }

  /**
   * v1.2 — Akıllı Sentez
   * 
   * Strateji:
   * 1. Görev sayısı ≤ 2 ve toplam uzunluk ≤ 3000 → tek seferde sentez (eski yöntem)
   * 2. Aksi halde → sadece özetlerle sentez (token tasarrufu)
   * 3. Sentezi streaming model üzerinden yapar (Cerebras yerine Groq)
   */
  async _synthesize(userPrompt) {
    const totalLength = this.tasks.reduce((sum, t) => sum + (t.result?.length || 0), 0);
    const isSmall = this.tasks.length <= 2 && totalLength <= 3000;

    let allResults;
    if (isSmall) {
      // Küçük görevler: tüm sonuçları gönder
      allResults = this.tasks
        .map(t => `## ${t.title}\n${t.result}`)
        .join('\n\n---\n\n');
    } else {
      // Büyük görevler: her sonucu kısalt
      allResults = this.tasks
        .map(t => {
          const result = t.result || '';
          const truncated = result.length > MAX_RESULT_CHARS
            ? result.slice(0, MAX_RESULT_CHARS) + '\n\n[...çıktının geri kalanı kısaltıldı, toplam ' + result.length + ' karakter]'
            : result;
          return `## ${t.title}\n${truncated}`;
        })
        .join('\n\n---\n\n');
    }

    const synthesisPrompt = `You are synthesizing the final deliverable. Be thorough and complete.

Original request: "${userPrompt}"

Subtask results:

${allResults}

Instructions:
- Combine into a single, coherent final deliverable
- If the task was code: produce COMPLETE working code, do not truncate
- If the task was writing: merge into a cohesive document
- Remove redundancy but keep all important content
- Output in the same language as the original request`;

    // Streaming sentez — Groq modeli üzerinden (daha uzun output)
    let finalText = '';
    try {
      await this.streamModel(
        'groq-llama4',  // Groq daha uzun output verebilir
        synthesisPrompt,
        (chunk) => {
          finalText += chunk;
          this.onSynthesisChunk(finalText); // UI'ya canlı gönder
        }
      );
    } catch (err) {
      // Streaming başarısız olursa Cerebras ile dene
      this.log('Streaming sentez başarısız, hakem modeline geçiliyor...');
      finalText = await this.judgeModel(synthesisPrompt);
    }

    // Eğer sentez de kısaysa, ham sonuçları birleştir
    if (finalText.length < 100 && totalLength > 500) {
      this.log('Sentez çok kısa, ham sonuçlar birleştiriliyor');
      finalText = this.tasks
        .map(t => `# ${t.title}\n\n${t.result}`)
        .join('\n\n---\n\n');
    }

    return finalText;
  }

  /* ── Yardımcılar ── */

  setState(newState) {
    this.state = newState;
    this.onStateChange(newState, {
      tasks: [...this.tasks],
      iteration: this.iteration,
      finalOutput: this.finalOutput,
    });
  }

  log(msg) {
    const timestamp = new Date().toLocaleTimeString('tr-TR');
    this.onLog(`[${timestamp}] ${msg}`);
  }
}

export { STATES };