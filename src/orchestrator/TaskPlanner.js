/**
 * TaskPlanner.js
 * v1.2 — Kısaltılmış prompt + güvenli fallback
 * 
 * Değişiklikler:
 *   - Prompt %40 kısaltıldı (Cerebras 8K limitine uyum)
 *   - JSON parse başarısız olursa tek görevli fallback üretir
 *   - Response loglama eklendi (debug için)
 */

const PLANNING_PROMPT = (userRequest) => `Break this request into 2-3 parallel subtasks for different AI models.

Request: "${userRequest}"

Models:
- "groq-llama4": code, logic, algorithms
- "groq-gptoss": creative writing, explanations  
- "groq-qwen3": analysis, data, optimization

Rules:
- Always use 2-3 subtasks, assign DIFFERENT models to each
- Each subtask MUST directly work on the user's request, not analyze or describe it
- Each subtask approaches the request from a different angle or perspective
- Description must start with an action verb (Write, Calculate, Analyze, Create...)
- Keep descriptions under 200 words

Respond ONLY with JSON array:
[{"title":"...","description":"...","model":"groq-llama4"}]`;

/**
 * Hakem modelinden alt görev planı al
 */
export async function planTasks(judgeModel, userPrompt, fetchUrl = null) {
  // Finansal veri otomatik çekme
let enrichedPrompt = userPrompt;
if (fetchUrl) {
  const financialKeywords = ['eur', 'usd', 'try', 'dolar', 'euro', 'lira', 'kur', 'forex', 'btc', 'bitcoin', 'borsa'];
  const isFinancial = financialKeywords.some(k => userPrompt.toLowerCase().includes(k));
  
  if (isFinancial) {
    try {
      const content = await fetchUrl('https://api.frankfurter.app/latest?from=EUR&to=TRY,USD');
      if (content) {
        const data = JSON.parse(content);
        const date = data.date;
        const eurTry = data.rates?.TRY;
        const eurUsd = data.rates?.USD;
        enrichedPrompt = `${userPrompt}\n\n[Güncel veriler - ${date}]\nEUR/TRY: ${eurTry}\nEUR/USD: ${eurUsd}\nUSD/TRY: ${(eurTry / eurUsd).toFixed(4)}`;
      }
    } catch (e) {
      console.warn('TaskPlanner: Finansal veri çekilemedi:', e.message);
    }
  }
}

const prompt = PLANNING_PROMPT(enrichedPrompt);
  
  let response;
  try {
    response = await judgeModel(prompt);
  } catch (err) {
    console.error('TaskPlanner: Hakem çağrısı başarısız:', err);
    // Fallback: tek görev olarak çalıştır
    return [createFallbackTask(userPrompt)];
  }

  // Boş veya çok kısa yanıt kontrolü
  if (!response || response.trim().length < 10) {
    console.warn('TaskPlanner: Hakem boş/kısa yanıt döndü, fallback kullanılıyor');
    return [createFallbackTask(userPrompt)];
  }

  // JSON parse
  let tasks;
  try {
    tasks = parseJSONFromResponse(response);
  } catch (err) {
    console.error('TaskPlanner: JSON parse hatası:', err.message);
    console.error('TaskPlanner: Ham yanıt:', response.slice(0, 500));
    // Parse başarısız → fallback
    return [createFallbackTask(userPrompt)];
  }

  if (!Array.isArray(tasks) || tasks.length === 0) {
    console.warn('TaskPlanner: Geçersiz görev dizisi, fallback kullanılıyor');
    return [createFallbackTask(userPrompt)];
  }

  return tasks.slice(0, 4).map(t => ({
    title: String(t.title || 'İsimsiz Görev'),
    description: String(t.description || userPrompt),
    model: validateModel(t.model),
  }));
}

/* ── Fallback ── */

function createFallbackTask(userPrompt) {
  return {
    title: 'Görevi Tamamla',
    description: userPrompt,
    model: 'groq-llama4',
  };
}

/* ── JSON Parsing ── */

function parseJSONFromResponse(text) {
  // 1. ```json ... ``` bloklarında ara
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch { /* devam et */ }
  }

  // 2. İlk [ ... ] bloğunu bul
  const bracketMatch = text.match(/\[[\s\S]*\]/);
  if (bracketMatch) {
    try {
      return JSON.parse(bracketMatch[0]);
    } catch { /* devam et */ }
  }

  // 3. Ham metni dene
  try {
    return JSON.parse(text.trim());
  } catch (e) {
    throw new Error(`JSON ayrıştırılamadı: ${e.message}`);
  }
}

const VALID_MODELS = ['groq-llama4', 'groq-gptoss', 'groq-qwen3'];

function validateModel(model) {
  if (VALID_MODELS.includes(model)) return model;
  return null;
}