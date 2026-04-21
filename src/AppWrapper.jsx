import { useState } from "react";
import App from "./App";
import { OrchestratorProvider } from "./orchestrator/OrchestratorContext.jsx";
import { WORKER_URL } from "./config";

const MODELS = [
  { id: "claude",  provider: "groq-llama4" },
  { id: "chatgpt", provider: "groq-gptoss" },
  { id: "gemini",  provider: "groq-qwen3"  },
];

export default function AppWrapper() {
  const [apiKeys, setApiKeys] = useState(() => {
    const saved = localStorage.getItem("maestro_keys");
    return saved ? JSON.parse(saved) : null;
  });

  async function streamModel(provider, prompt, onChunk) {
    const model = MODELS.find(m => m.provider === provider);
    const modelId = model ? model.id : provider;
    const apiKey = apiKeys?.[modelId] || "";

    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        model: modelId,
        apiKey,
        judgeKey: apiKeys?.judgeKey || "",
      }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      for (const event of events) {
        const line = event.trim();
        if (!line.startsWith("data:")) continue;
        try {
          const json = JSON.parse(line.slice(5).trim());
          if (json.token) onChunk(json.token);
        } catch {}
      }
    }
  }

  async function judgeModel(prompt) {
    let fullText = "";
    await streamModel("judge-internal", prompt, (token) => {
      fullText += token;
    });
    if (!fullText || fullText.trim().length < 10) {
      fullText = "";
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model: "claude",
          apiKey: apiKeys?.claude || "",
          judgeKey: apiKeys?.judgeKey || "",
        }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const json = JSON.parse(line.slice(5).trim());
            if (json.token) fullText += json.token;
          } catch {}
        }
      }
    }
    return fullText;
  }

  async function fetchUrl(targetUrl) {
    try {
      const res = await fetch(`${WORKER_URL}/fetch-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl }),
      });
      const data = await res.json();
      return data.ok ? data.content : null;
    } catch {
      return null;
    }
  }

  return (
    <OrchestratorProvider
      streamModel={streamModel}
      judgeModel={judgeModel}
      fetchUrl={fetchUrl}
    >
      <App apiKeys={apiKeys} setApiKeys={setApiKeys} />
    </OrchestratorProvider>
  );
}