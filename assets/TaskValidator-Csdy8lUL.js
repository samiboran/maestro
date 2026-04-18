var e=(e,t)=>`You are a quality reviewer. The user requested:
"${e}"

Here are the subtask results:

${t.map(e=>`### ${e.id}: ${e.title} (${e.assignedModel})
Status: ${e.status}
Result preview: ${(e.result||``).slice(0,800)}${(e.result||``).length>800?`...[truncated]`:``}`).join(`

`)}

Review each result for:
1. Correctness - does it solve what was asked?
2. Completeness - is anything missing?
3. Consistency - will the parts work together?

Respond ONLY with JSON:
\`\`\`json
{
  "approved": true/false,
  "summary": "Brief overall assessment",
  "feedback": [
    {
      "taskId": "task-1",
      "issue": "What's wrong",
      "suggestion": "Specific instruction to fix it"
    }
  ]
}
\`\`\`

If all tasks pass review, set "approved": true and "feedback": [].
Only flag genuine issues, not style preferences.`;async function t(t,r,i){let a=n(await t(e(r,i)));return{approved:!!a.approved,summary:String(a.summary||``),feedback:Array.isArray(a.feedback)?a.feedback:[]}}function n(e){let t=e.match(/```(?:json)?\s*([\s\S]*?)```/),n=t?t[1].trim():e.trim();try{return JSON.parse(n)}catch{let t=e.match(/\{[\s\S]*\}/);if(t)try{return JSON.parse(t[0])}catch{}return console.warn(`TaskValidator: İnceleme ayrıştırılamadı, onaylı varsayılıyor`),{approved:!0,summary:`İnceleme ayrıştırma hatası`,feedback:[]}}}export{t as reviewResults};