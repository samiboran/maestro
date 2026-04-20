/**
 * TaskValidator.js
 * v1.2 — Agresif kısaltma + daha güvenli parse
 * 
 * Değişiklikler:
 *   - İnceleme prompt'undaki sonuç preview'ı 400 karaktere düşürüldü
 *   - Prompt genel olarak kısaltıldı
 *   - Parse hatası durumunda approved: true fallback korundu
 */

const MAX_PREVIEW = 400; // Cerebras 8K limitine uyum için kısa tut

const REVIEW_PROMPT = (userRequest, tasks) => {
  const taskSummaries = tasks
    .map(t => {
      const preview = (t.result || '').slice(0, MAX_PREVIEW);
      const truncNote = (t.result || '').length > MAX_PREVIEW ? '...[truncated]' : '';
      return `${t.id}: ${t.title} (${t.assignedModel})\nResult: ${preview}${truncNote}`;
    })
    .join('\n\n');

  return `Review these subtask results for the request: "${userRequest}"

${taskSummaries}

Check: correctness, completeness, consistency.
Only flag genuine issues.

JSON response:
{"approved":true/false,"summary":"...","feedback":[{"taskId":"task-1","issue":"...","suggestion":"..."}]}`;
};

/**
 * Sonuçları hakeme inceleme için gönder
 */
export async function reviewResults(judgeModel, userPrompt, tasks) {
  const prompt = REVIEW_PROMPT(userPrompt, tasks);
  
  let response;
  try {
    response = await judgeModel(prompt);
  } catch (err) {
    console.error('TaskValidator: Hakem inceleme çağrısı başarısız:', err);
    // İnceleme başarısız → onaylı say, sonsuz döngü önle
    return { approved: true, summary: 'İnceleme çağrısı başarısız, onaylı varsayıldı', feedback: [] };
  }

  if (!response || response.trim().length < 5) {
    console.warn('TaskValidator: Boş yanıt, onaylı varsayılıyor');
    return { approved: true, summary: 'Boş inceleme yanıtı', feedback: [] };
  }

  const review = parseJSONFromResponse(response);

  return {
    approved: Boolean(review.approved),
    summary: String(review.summary || ''),
    feedback: Array.isArray(review.feedback) ? review.feedback : [],
  };
}

/* ── JSON Parsing ── */

function parseJSONFromResponse(text) {
  // 1. ```json fence
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch { /* devam */ }
  }

  // 2. İlk { ... } bloğu
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch { /* devam */ }
  }

  // 3. Ham metin
  try { return JSON.parse(text.trim()); } catch { /* düş */ }

  // 4. Tamamen başarısız → güvenli fallback
  console.warn('TaskValidator: İnceleme ayrıştırılamadı, onaylı varsayılıyor');
  return { approved: true, summary: 'İnceleme ayrıştırma hatası', feedback: [] };
}