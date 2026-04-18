// Maestro Test Script — Direkt Groq API
// Kullanım: node test.mjs 1
// API key'i aşağıya yaz

import fs from "fs";

const API_KEY = "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"; // gsk_xxx
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const MODELS = [
  { id: "claude",  name: "Llama 4 Scout", groq: "meta-llama/llama-4-scout-17b-16e-instruct" },
  { id: "chatgpt", name: "GPT OSS 120B",  groq: "openai/gpt-oss-120b" },
  { id: "gemini",  name: "Qwen 3 32B",    groq: "qwen-qwq-32b" },
];

const TEST_QUESTIONS = [
  { id: "L1-1", level: 1, question: "Python'da iki listenin farkını bul (A'da olup B'de olmayan elemanlar). Kod yaz." },
  { id: "L1-2", level: 1, question: "Flexbox ile 3 kutuyu yan yana ortala, aralarında eşit boşluk olsun. CSS yaz." },
  { id: "L1-3", level: 1, question: "1'den 100'e kadar asal sayıları listele. Python ile yaz." },
  { id: "L2-1", level: 2, question: "CSS Grid ile responsive kart layout: mobilde 1 kolon, tablette 2, masaüstünde 3. Sidebar 240px sabit sol tarafta. Tam çalışan kod yaz." },
  { id: "L2-2", level: 2, question: "Recursive Fibonacci'yi memoization ile optimize et. Farkı big-O ile açıkla." },
  { id: "L2-3", level: 2, question: "JavaScript'te 0.1 + 0.2 === 0.3 neden false? Güvenli karşılaştırma nasıl yapılır?" },
  { id: "L3-1", level: 3, question: "z-index ve stacking context: 3 nested div var, position:relative içindeki overlay butonu arkada kalıyor. Neden? Nasıl çözersin?" },
  { id: "L3-2", level: 3, question: "React useEffect içinde loop'ta event listener ekliyorum ama hepsi son değeri okuyor. Closure sorunu nedir, nasıl düzeltilir?" },
  { id: "L3-3", level: 3, question: "CSS position:sticky çalışmıyor. 5 farklı sebebi ve her birini nasıl debug edeceğini açıkla." },
];

async function askGroq(modelGroqId, promptText) {
  const start = Date.now();
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: modelGroqId,
        messages: [{ role: "user", content: promptText }],
        max_tokens: 1024,
        temperature: 0.3,
      }),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const text = data.choices?.[0]?.message?.content || "";
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    return { text, elapsed };
  } catch (e) {
    return { text: `HATA: ${e.message}`, elapsed: "—" };
  }
}

function buildSynthPrompt(question, modelResponses) {
  const parts = Object.entries(modelResponses)
    .map(([id, { text }]) => {
      const model = MODELS.find(m => m.id === id);
      return `--- ${model?.name || id} ---\n${text}`;
    })
    .join("\n\n");

  return `Aşağıda aynı soruya farklı AI modellerinden gelen yanıtlar var.

Kurallar:
- Selamlama ve dolgu cümlelerini yoksay
- Modeller aynı şeyi söylüyorsa bir kez yaz
- Modeller çelişiyorsa hangisinin doğru olduğunu belirt
- Teknik sorularda en doğru kodu öne çıkar
- Giriş cümlesi yazma, direkt cevaba gir

SORU: ${question}

${parts}

Türkçe yaz. Markdown formatı kullan.`;
}

async function runTest(testQ) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`[${testQ.id}] ${testQ.question}`);
  console.log("═".repeat(60));

  console.log("📡 Modeller sorgulanıyor...");
  const modelResponses = {};

  await Promise.all(
    MODELS.map(async (m) => {
      process.stdout.write(`  ⏳ ${m.name}...`);
      const result = await askGroq(m.groq, testQ.question);
      modelResponses[m.id] = result;
      const preview = result.text.slice(0, 60).replace(/\n/g, " ");
      console.log(` ✓ ${result.elapsed}s — ${preview}...`);
    })
  );

  console.log("\n🔀 Synthesis yapılıyor...");
  const synthPrompt = buildSynthPrompt(testQ.question, modelResponses);
  const synthesis = await askGroq(MODELS[0].groq, synthPrompt);
  console.log(`  ✓ ${synthesis.elapsed}s`);

  console.log("\n── SYNTHESIS SONUCU ──");
  console.log(synthesis.text);

  return {
    id: testQ.id,
    level: testQ.level,
    question: testQ.question,
    modelResponses: Object.fromEntries(
      MODELS.map(m => [m.id, { text: modelResponses[m.id].text, elapsed: modelResponses[m.id].elapsed }])
    ),
    synthesis: synthesis.text,
    synthElapsed: synthesis.elapsed,
  };
}

async function main() {
  const LEVEL = parseInt(process.argv[2]) || 1;
  const questions = TEST_QUESTIONS.filter(q => q.level === LEVEL);

  console.log(`\n🎯 Maestro Test — Seviye ${LEVEL} (${questions.length} soru)`);

  const results = [];
  for (const q of questions) {
    const result = await runTest(q);
    results.push(result);
    await new Promise(r => setTimeout(r, 1500));
  }

  const filename = `test-results-L${LEVEL}-${new Date().toISOString().slice(0, 16).replace('T','-').replace(':','')}.json`;
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));
  console.log(`\n✅ Sonuçlar kaydedildi: ${filename}`);
}

main().catch(console.error);
