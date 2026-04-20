var e=e=>`Break this request into 2-3 parallel subtasks for different AI models.

Request: "${e}"

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
[{"title":"...","description":"...","model":"groq-llama4"}]`;async function t(t,i,o=null){let s=i;if(o&&[`eur`,`usd`,`try`,`dolar`,`euro`,`lira`,`kur`,`forex`,`btc`,`bitcoin`,`borsa`].some(e=>i.toLowerCase().includes(e)))try{let e=await o(`https://api.frankfurter.app/latest?from=EUR&to=TRY,USD`);if(e){let t=JSON.parse(e),n=t.date,r=t.rates?.TRY,a=t.rates?.USD;s=`${i}\n\n[Güncel veriler - ${n}]\nEUR/TRY: ${r}\nEUR/USD: ${a}\nUSD/TRY: ${(r/a).toFixed(4)}`}}catch(e){console.warn(`TaskPlanner: Finansal veri çekilemedi:`,e.message)}let c=e(s),l;try{l=await t(c)}catch(e){return console.error(`TaskPlanner: Hakem çağrısı başarısız:`,e),[n(i)]}if(!l||l.trim().length<10)return console.warn(`TaskPlanner: Hakem boş/kısa yanıt döndü, fallback kullanılıyor`),[n(i)];let u;try{u=r(l)}catch(e){return console.error(`TaskPlanner: JSON parse hatası:`,e.message),console.error(`TaskPlanner: Ham yanıt:`,l.slice(0,500)),[n(i)]}return!Array.isArray(u)||u.length===0?(console.warn(`TaskPlanner: Geçersiz görev dizisi, fallback kullanılıyor`),[n(i)]):u.slice(0,4).map(e=>({title:String(e.title||`İsimsiz Görev`),description:String(e.description||i),model:a(e.model)}))}function n(e){return{title:`Görevi Tamamla`,description:e,model:`groq-llama4`}}function r(e){let t=e.match(/```(?:json)?\s*([\s\S]*?)```/);if(t)try{return JSON.parse(t[1].trim())}catch{}let n=e.match(/\[[\s\S]*\]/);if(n)try{return JSON.parse(n[0])}catch{}try{return JSON.parse(e.trim())}catch(e){throw Error(`JSON ayrıştırılamadı: ${e.message}`)}}var i=[`groq-llama4`,`groq-gptoss`,`groq-qwen3`];function a(e){return i.includes(e)?e:null}export{t as planTasks};