/**
 * useMemory.js
 * Maestro Memory Sistemi — localStorage tabanlı.
 * 
 * Saklanan veriler:
 *   - Son 15 sohbet (soru + sentez özeti + tarih)
 *   - Kullanıcı tercihleri (varsayılan mod, tema vs.)
 * 
 * Kullanım:
 *   const { chats, saveChat, loadChat, deleteChat, prefs, setPref } = useMemory();
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'maestro_memory';
const MAX_CHATS = 15;

function readMemory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { chats: [], preferences: {} };
    return JSON.parse(raw);
  } catch {
    return { chats: [], preferences: {} };
  }
}

function writeMemory(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[Memory] localStorage yazma hatası:', e);
  }
}

export default function useMemory() {
  const [memory, setMemory] = useState(() => readMemory());

  // Memory değişince localStorage'a yaz
  useEffect(() => {
    writeMemory(memory);
  }, [memory]);

  // ── Sohbet Geçmişi ──

  const saveChat = useCallback((chatData) => {
    // chatData: { prompt, messages, mode }
    const entry = {
      id: `chat-${Date.now()}`,
      timestamp: new Date().toISOString(),
      title: chatData.prompt.slice(0, 60) + (chatData.prompt.length > 60 ? '…' : ''),
      prompt: chatData.prompt,
      messages: chatData.messages,
      mode: chatData.mode || 'chat',
    };

    setMemory(prev => ({
      ...prev,
      chats: [entry, ...prev.chats].slice(0, MAX_CHATS),
    }));

    return entry.id;
  }, []);

  const loadChat = useCallback((chatId) => {
    return memory.chats.find(c => c.id === chatId) || null;
  }, [memory.chats]);

  const deleteChat = useCallback((chatId) => {
    setMemory(prev => ({
      ...prev,
      chats: prev.chats.filter(c => c.id !== chatId),
    }));
  }, []);

  const clearAllChats = useCallback(() => {
    setMemory(prev => ({ ...prev, chats: [] }));
  }, []);

  // ── Kullanıcı Tercihleri ──

  const setPref = useCallback((key, value) => {
    setMemory(prev => ({
      ...prev,
      preferences: { ...prev.preferences, [key]: value },
    }));
  }, []);

  const getPref = useCallback((key, defaultValue = null) => {
    return memory.preferences[key] ?? defaultValue;
  }, [memory.preferences]);

  return {
    // Sohbet
    chats: memory.chats,
    saveChat,
    loadChat,
    deleteChat,
    clearAllChats,
    // Tercihler
    prefs: memory.preferences,
    setPref,
    getPref,
  };
}
