var e=e=>`You are an AI task orchestrator. Analyze this request and break it into 2-4 subtasks that can be worked on in parallel by different AI models.

User request: "${e}"

Available models and their strengths:
- "groq-llama4": Best for structured code, logic, algorithms
- "groq-gptoss": Best for creative content, explanations, documentation  
- "groq-qwen3": Best for analysis, data processing, optimization

Rules:
- Maximum 4 subtasks (keep it focused)
- Each subtask must be self-contained (models can't see each other's work)
- Assign the best model for each task
- Keep descriptions concise but complete (under 500 words each)
- If the task is simple enough for one model, return just 1 subtask

Respond ONLY with a JSON array, no other text:
\`\`\`json
[
  {
    "title": "Short task name",
    "description": "Detailed instructions for the model",
    "model": "groq-llama4"
  }
]
\`\`\``;async function t(t,r){let a=n(await t(e(r)));if(!Array.isArray(a)||a.length===0)throw Error(`Hakem geçersiz görev planı döndürdü`);return a.slice(0,4).map(e=>({title:String(e.title||`İsimsiz Görev`),description:String(e.description||``),model:i(e.model)}))}function n(e){let t=e.match(/```(?:json)?\s*([\s\S]*?)```/),n=t?t[1].trim():e.trim();try{return JSON.parse(n)}catch(t){let n=e.match(/\[[\s\S]*\]/);if(n)try{return JSON.parse(n[0])}catch{}throw Error(`Hakem planı ayrıştırılamadı: ${t.message}`)}}var r=[`groq-llama4`,`groq-gptoss`,`groq-qwen3`];function i(e){return r.includes(e)?e:null}export{t as planTasks};