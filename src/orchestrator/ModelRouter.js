/**
 * ModelRouter.js
 * Görev içeriğine göre en uygun modeli atar.
 * İş yükünü mevcut modeller arasında dengeli dağıtır.
 * 
 * Model güçlü yönleri:
 *   groq-llama4    → kod, mantık, yapılandırılmış çıktı
 *   groq-gptoss    → yaratıcı yazım, dokümantasyon, açıklamalar
 *   groq-qwen3     → analiz, matematik, veri, optimizasyon
 */

const MODEL_PROFILES = {
  'groq-llama4': {
    name: 'Llama 4 Scout',
    keywords: ['code', 'function', 'api', 'html', 'css', 'javascript', 'python',
               'algorithm', 'database', 'struct', 'class', 'component', 'build',
               'implement', 'backend', 'frontend', 'logic', 'validation'],
    weight: 0,
  },
  'groq-gptoss': {
    name: 'GPT OSS 120B',
    keywords: ['write', 'explain', 'describe', 'document', 'creative', 'story',
               'content', 'copy', 'blog', 'article', 'readme', 'guide',
               'tutorial', 'comment', 'ui', 'ux', 'design', 'user'],
    weight: 0,
  },
  'groq-qwen3': {
    name: 'Qwen 3 32B',
    keywords: ['analyze', 'compare', 'optimize', 'data', 'math', 'calculate',
               'performance', 'benchmark', 'test', 'review', 'evaluate',
               'research', 'plan', 'strategy', 'architecture', 'security'],
    weight: 0,
  },
};

/**
 * Henüz modeli atanmamış görevlere model ata.
 * Yük dengeleme: gerekmedikçe hiçbir model 2+ görev almaz.
 * @param {Array} tasks
 * @returns {Array} assignedModel doldurulmuş görevler
 */
export function assignModels(tasks) {
  // Kullanım sayaçlarını sıfırla
  const usage = { 'groq-llama4': 0, 'groq-gptoss': 0, 'groq-qwen3': 0 };

  // Zaten atanmış olanları say
  for (const t of tasks) {
    if (t.assignedModel && usage[t.assignedModel] !== undefined) {
      usage[t.assignedModel]++;
    }
  }

  // Atanmamış görevlere model ata
  for (const task of tasks) {
    if (task.assignedModel) continue;

    const scores = {};
    const desc = (task.title + ' ' + task.description).toLowerCase();

    for (const [modelId, profile] of Object.entries(MODEL_PROFILES)) {
      // Anahtar kelime eşleşme puanı
      let score = profile.keywords.reduce((sum, kw) => {
        return sum + (desc.includes(kw) ? 1 : 0);
      }, 0);

      // Yük dengeleme cezası: az kullanılmış modelleri tercih et
      score -= usage[modelId] * 3;

      scores[modelId] = score;
    }

    // En yüksek puanlı modeli seç
    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
    task.assignedModel = best;
    usage[best]++;
  }

  return tasks;
}

/**
 * Okunabilir model adı döner
 */
export function getModelName(modelId) {
  return MODEL_PROFILES[modelId]?.name || modelId;
}
