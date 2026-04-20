var e=e=>`Break this request into 2-4 parallel subtasks for different AI models.

Request: "${e}"

Models:
- "groq-llama4": code, logic, algorithms
- "groq-gptoss": creative writing, explanations
- "groq-qwen3": analysis, data, optimization

Rules:
- Max 4 subtasks, each self-contained
- Keep descriptions under 300 words
- Simple requests = 1 subtask

Respond ONLY with JSON array:
[{"title":"...","description":"...","model":"groq-llama4"}]`;async function t(t,i){let o=e(i),s;try{s=await t(o)}catch(e){return console.error(`TaskPlanner: Hakem çağrısı başarısız:`,e),[n(i)]}if(!s||s.trim().length<10)return console.warn(`TaskPlanner: Hakem boş/kısa yanıt döndü, fallback kullanılıyor`),[n(i)];let c;try{c=r(s)}catch(e){return console.error(`TaskPlanner: JSON parse hatası:`,e.message),console.error(`TaskPlanner: Ham yanıt:`,s.slice(0,500)),[n(i)]}return!Array.isArray(c)||c.length===0?(console.warn(`TaskPlanner: Geçersiz görev dizisi, fallback kullanılıyor`),[n(i)]):c.slice(0,4).map(e=>({title:String(e.title||`İsimsiz Görev`),description:String(e.description||i),model:a(e.model)}))}function n(e){return{title:`Görevi Tamamla`,description:e,model:`groq-llama4`}}function r(e){let t=e.match(/```(?:json)?\s*([\s\S]*?)```/);if(t)try{return JSON.parse(t[1].trim())}catch{}let n=e.match(/\[[\s\S]*\]/);if(n)try{return JSON.parse(n[0])}catch{}try{return JSON.parse(e.trim())}catch(e){throw Error(`JSON ayrıştırılamadı: ${e.message}`)}}var i=[`groq-llama4`,`groq-gptoss`,`groq-qwen3`];function a(e){return i.includes(e)?e:null}export{t as planTasks};