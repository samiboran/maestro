import { useState } from "react";

export default function Sidebar({ onNewChat, onExportSession, onOpenSettings, isOpen, setIsOpen }) {
  return (
    <>
      <button className="sidebar-toggle" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? "✕" : "☰"}
      </button>
      <div className={`sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">Maestro</span>
        </div>
        <div className="sidebar-menu">
          <button className="sidebar-item" onClick={onNewChat}>
            ＋ New Chat
          </button>
          <button className="sidebar-item" onClick={onExportSession}>
            📋 Session Kaydet
          </button>
          <button className="sidebar-item" onClick={onOpenSettings}>
            ⚙ API Ayarları
          </button>
        </div>
      </div>
    </>
  );
}