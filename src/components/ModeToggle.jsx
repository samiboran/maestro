export default function ModeToggle({ mode, setMode }) {
  const modes = [
    { id: "chat", label: "Chat" },
    { id: "orchestration", label: "Orkestra" },
    { id: "autonomous", label: "Otonom" },
  ];

  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => setMode(m.id)}
          style={{
            padding: "4px 10px",
            borderRadius: "6px",
            border: "1px solid rgba(154,122,74,0.3)",
            background: mode === m.id ? "#9a7a4a" : "transparent",
            color: mode === m.id ? "#fff" : "#9a7a4a",
            fontSize: "11px",
            cursor: "pointer",
            fontFamily: "Cinzel, serif",
            letterSpacing: "0.05em",
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}