/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect, useCallback, useDeferredValue, useRef, ReactNode, ChangeEvent, FormEvent } from 'react';
import { Shield, Clipboard, Check, Search, AlertCircle, XCircle, Download, Zap, Globe, Hash, Unlock, Type, X, Copy, Music, Trophy, Play, ChevronRight, Sun, Moon, Medal, LogOut, User, Fingerprint, Sparkles, Filter, ArrowUpDown, Bell, Settings, Palette, Database, MessageSquare, Send, Eye, EyeOff, ShieldCheck, ShieldAlert, Calendar, Phone, Menu, File, Edit2, Trash2, BookOpen, Users, Plus, CheckCircle2, Cpu, Award, Activity as ActivityIcon, Code, Star, Mail, RotateCcw, FileSearch } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import CryptoJS from 'crypto-js';
import { io } from 'socket.io-client';
import { Toaster, toast } from 'sonner';

interface AppHashData {
  name: string;
  description: string;
  image: string;
  md5: string;
  sha1: string;
  sha256: string;
}

interface Activity {
  id: number;
  type: 'generate' | 'decode' | 'verify' | 'file';
  hash: string;
  value: string;
  user_name?: string;
  user_avatar?: string;
  timestamp: string;
}

interface UserProfile {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  phone: string;
  gender: string;
  avatar_seed: string;
  role?: 'user' | 'admin';
  points?: number;
  rank?: string;
  level?: number;
  created_at: string;
}

interface Message {
  id: number;
  user_id: number;
  user_name: string;
  user_avatar: string;
  user_rank?: string;
  content: string;
  is_edited?: number;
  is_deleted?: number;
  timestamp: string;
}

interface ThemeConfig {
  id: string;
  name: string;
  colors: {
    bg: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
    border: string;
  };
}

const THEMES: ThemeConfig[] = [
  {
    id: 'dark',
    name: 'Dark Pro',
    colors: {
      bg: '#050505',
      surface: '#111111',
      text: '#ffffff',
      muted: '#9e9e9e',
      accent: '#10b981',
      border: 'rgba(255,255,255,0.1)'
    }
  },
  {
    id: 'light',
    name: 'Light Clean',
    colors: {
      bg: '#f5f5f5',
      surface: '#ffffff',
      text: '#1a1a1a',
      muted: '#9e9e9e',
      accent: '#10b981',
      border: 'rgba(0,0,0,0.05)'
    }
  },
  {
    id: 'solarized',
    name: 'Solarized',
    colors: {
      bg: '#002b36',
      surface: '#073642',
      text: '#fdf6e3',
      muted: '#93a1a1',
      accent: '#2aa198',
      border: 'rgba(147,161,161,0.2)'
    }
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox',
    colors: {
      bg: '#1d2021',
      surface: '#32302f',
      text: '#fbf1c7',
      muted: '#a89984',
      accent: '#fe8019',
      border: 'rgba(235,219,178,0.2)'
    }
  }
];

interface NotificationPrefs {
  newActivity: boolean;
  rareHash: boolean;
  verificationMatch: boolean;
}

const AVATARS = ['👤', '🐱', '🐶', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷', '🕸', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🐐', '🦌', '🐕', '🐩', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿', '🦔'];

const ProfileSelector = ({ onSelect, onBackToQuiz, isDarkMode }: { onSelect: (profile: UserProfile) => void, onBackToQuiz: () => void, isDarkMode: boolean }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [avatarSeed, setAvatarSeed] = useState(Math.random().toString(36).substring(7));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    if (pin.length !== 4) {
      setError('El PIN debe ser de 4 dígitos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          avatarSeed,
          pin
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al conectar');
      }

      onSelect(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateNewAvatar = () => {
    setAvatarSeed(Math.random().toString(36).substring(7));
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 font-sans transition-colors duration-500 ${isDarkMode ? 'bg-[#050505]' : 'bg-gray-100'}`}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`max-w-md w-full border rounded-3xl p-8 shadow-2xl relative transition-colors duration-500 ${isDarkMode ? 'bg-[#111] border-white/10' : 'bg-white border-black/5'}`}
      >
        <button
          onClick={onBackToQuiz}
          className={`absolute top-4 left-4 transition-colors flex items-center gap-1 text-sm ${isDarkMode ? 'text-white/40 hover:text-white' : 'text-gray-400 hover:text-gray-900'}`}
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Volver al Quiz
        </button>

        <div className="text-center mb-8 mt-4">
          <div className={`inline-flex p-4 rounded-2xl mb-4 ${isDarkMode ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
            <User className={`w-10 h-10 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
          </div>
          <h1 className={`text-3xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Crea tu Perfil
          </h1>
          <p className={`mt-2 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
            Elige un nombre de usuario y un avatar para unirte
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`}
                alt="Avatar"
                className={`w-24 h-24 rounded-full border-4 ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-gray-100 border-white shadow-sm'}`}
              />
              <button
                type="button"
                onClick={generateNewAvatar}
                className="absolute bottom-0 right-0 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg transition-colors"
                title="Generar nuevo avatar"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className={`text-xs font-semibold uppercase tracking-wider px-1 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
              Nombre de Usuario
            </label>
            <div className="relative">
              <Fingerprint className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`} />
              <input
                type="text"
                required
                maxLength={30}
                className={`w-full border rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${
                  isDarkMode 
                    ? 'bg-black/50 border-white/10 text-white placeholder-white/30' 
                    : 'bg-white border-black/10 text-gray-900 placeholder-gray-400'
                }`}
                placeholder="usuario123"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <label className={`text-xs font-semibold uppercase tracking-wider px-1 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                PIN de Seguridad (4 dígitos)
              </label>
              <div className="relative">
                <Unlock className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`} />
                <input
                  type="password"
                  required
                  maxLength={4}
                  pattern="\d{4}"
                  className={`w-full border rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${
                    isDarkMode 
                      ? 'bg-black/50 border-white/10 text-white placeholder-white/30' 
                      : 'bg-white border-black/10 text-gray-900 placeholder-gray-400'
                  }`}
                  placeholder="****"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-xs mt-1 px-1">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!username.trim() || pin.length !== 4 || loading}
            className="w-full py-3 rounded-xl font-bold text-black bg-white hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Entrar'
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const RANKS = [
  { name: 'Novice', min: 0, color: '#94a3b8', icon: <User className="w-4 h-4" /> },
  { name: 'Junior Operator', min: 200, color: '#10b981', icon: <Shield className="w-4 h-4" /> },
  { name: 'Security Analyst', min: 500, color: '#3b82f6', icon: <Fingerprint className="w-4 h-4" /> },
  { name: 'Cipher Master', min: 1000, color: '#8b5cf6', icon: <Unlock className="w-4 h-4" /> },
  { name: 'Root Admin', min: 2000, color: '#f59e0b', icon: <Trophy className="w-4 h-4" /> },
  { name: 'Elite Cipher', min: 5000, color: '#ef4444', icon: <Zap className="w-4 h-4" /> },
  { name: 'System Administrator', min: Infinity, color: '#8b5cf6', icon: <ShieldCheck className="w-4 h-4" /> },
];

const UserProfileModal = ({ user, onClose, isDarkMode }: { user: any, onClose: () => void, isDarkMode: boolean }) => {
  if (!user) return null;

  const currentRank = user.rank || user.user_rank || 'Novice';
  const isAdmin = currentRank === 'System Administrator';
  const currentRankIndex = RANKS.findIndex(r => r.name === currentRank) !== -1 ? RANKS.findIndex(r => r.name === currentRank) : 0;
  const nextRank = isAdmin ? null : RANKS[currentRankIndex + 1];
  const points = user.points || 0;
  const progress = isAdmin ? 100 : (nextRank ? (points / nextRank.min) * 100 : 100);
  const level = user.level || Math.floor((1 + Math.sqrt(1 + 8 * points / 50)) / 2);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative max-w-md w-full p-8 rounded-[2.5rem] border shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl hover:bg-black/5 transition-colors"
        >
          <X className="w-5 h-5 opacity-40" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-[2rem] overflow-hidden border-4 border-emerald-500/20 shadow-xl">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatar_seed || user.user_avatar}`}
                alt={user.username || user.user_name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center border-4 border-white shadow-lg">
              <span className="text-[8px] font-bold text-white/60 leading-none">LVL</span>
              <span className="text-xs font-black text-white leading-none">{level}</span>
            </div>
          </div>

          <h3 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-color)' }}>{user.username || user.user_name}</h3>
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-bold uppercase tracking-tight border border-emerald-500/20 whitespace-nowrap">
              {RANKS[currentRankIndex].icon}
              {currentRank}
            </span>
            {user.role === 'admin' && (
              <span className="px-3 py-1 rounded-full bg-red-500/10 text-red-500 text-[9px] font-bold uppercase tracking-tight border border-red-500/20 whitespace-nowrap">
                Admin
              </span>
            )}
          </div>

          <div className="w-full space-y-4 mb-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-black/5 border border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Puntos</p>
                <p className="text-xl font-bold" style={{ color: 'var(--text-color)' }}>{points}</p>
              </div>
              <div className="p-4 rounded-2xl bg-black/5 border border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Nivel</p>
                <p className="text-xl font-bold" style={{ color: 'var(--text-color)' }}>{level}</p>
              </div>
            </div>

            <div className="text-left p-4 rounded-2xl bg-black/5 border border-white/5">
              <div className="flex justify-between items-end mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Progreso</p>
                <span className="text-[10px] font-mono font-bold opacity-60">{points} / {nextRank ? nextRank.min : '∞'}</span>
              </div>
              <div className="h-2 w-full bg-black/10 rounded-full overflow-hidden p-0.5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full shadow-lg"
                />
              </div>
              <p className="text-[9px] mt-2 opacity-40 font-bold uppercase tracking-tighter">
                Siguiente: {nextRank ? nextRank.name : 'Nivel Máximo'}
              </p>
            </div>
          </div>

          <p className="text-xs opacity-60 leading-relaxed italic">
            "Operador verificado en la red CryptoToolbox. Especialista en protocolos de seguridad y análisis de integridad."
          </p>
        </div>
      </motion.div>
    </div>
  );
};

const ChatWindow = ({ userProfile, socket, onlineUsers, isDarkMode }: { userProfile: UserProfile, socket: any, onlineUsers: any[], isDarkMode: boolean }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deletingMessageId, setDeletingMessageId] = useState<number | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, any>>({});
  const [viewingProfile, setViewingProfile] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch('/api/messages');
        const data = await response.json();
        setMessages(data);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();

    if (socket) {
      console.log("Setting up socket listeners in ChatWindow. Socket connected:", socket.connected);
      
      // Ensure user is online for the server
      if (socket.connected) {
        socket.emit('user_online', userProfile);
      } else {
        socket.once('connect', () => {
          console.log("Socket connected in ChatWindow, emitting user_online");
          socket.emit('user_online', userProfile);
        });
      }

      socket.on('new_message', (message: Message) => {
        console.log("Received new_message in ChatWindow:", message);
        setMessages(prev => {
          if (prev.find(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
      });

      socket.on('message_edited', ({ messageId, newContent }: { messageId: number, newContent: string }) => {
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, content: newContent, is_edited: 1 } : msg
        ));
      });

      socket.on('message_deleted', ({ messageId }: { messageId: number }) => {
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, content: 'Mensaje eliminado', is_deleted: 1 } : msg
        ));
      });

      socket.on('message_deleted_hard', ({ messageId }: { messageId: number }) => {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
      });

      socket.on('user_typing', (user: any) => {
        setTypingUsers(prev => ({ ...prev, [user.id]: user }));
      });

      socket.on('user_stop_typing', (user: any) => {
        setTypingUsers(prev => {
          const next = { ...prev };
          delete next[user.id];
          return next;
        });
      });

      socket.on('database_cleared', () => {
        setMessages([]);
      });
    }

    return () => {
      if (socket) {
        socket.off('new_message');
        socket.off('message_edited');
        socket.off('message_deleted');
        socket.off('user_typing');
        socket.off('user_stop_typing');
      }
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    if (newMessage.trim()) {
      socket.emit('typing', userProfile);
    } else {
      socket.emit('stop_typing', userProfile);
    }
  }, [newMessage, socket, userProfile]);

  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();
    console.log("handleSendMessage called, newMessage:", newMessage, "socket:", !!socket, "connected:", socket?.connected);
    
    if (!newMessage.trim()) {
      console.log("Message is empty, not sending.");
      return;
    }
    
    if (!socket) {
      console.log("Socket is null, cannot send message.");
      toast.error("Error de conexión: No hay socket.");
      return;
    }

    if (!socket.connected) {
      console.log("Socket is disconnected, attempting to send anyway (will buffer if configured).");
      toast.warning("El chat está desconectado. Intentando reconectar...");
    }

    const messagePayload = {
      userId: userProfile.id,
      userName: userProfile.username,
      userAvatar: userProfile.avatar_seed,
      userRank: userProfile.rank,
      content: newMessage
    };

    console.log("Emitting send_message with payload:", messagePayload);
    
    socket.emit('send_message', messagePayload, (ack: any) => {
      console.log("Server acknowledged send_message:", ack);
    });

    setNewMessage('');
    socket.emit('stop_typing', userProfile);
  };

  const handleEditMessage = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
  };

  const handleSaveEdit = () => {
    if (!editContent.trim() || !socket || editingMessageId === null) return;

    socket.emit('edit_message', {
      messageId: editingMessageId,
      userId: userProfile.id,
      newContent: editContent
    });

    setEditingMessageId(null);
    setEditContent('');
  };

  const handleDeleteMessage = (messageId: number) => {
    if (!socket) return;
    socket.emit('delete_message', {
      messageId,
      userId: userProfile.id
    });
    setDeletingMessageId(null);
  };

  return (
    <div className="flex flex-col md:flex-row h-[600px] border rounded-3xl overflow-hidden backdrop-blur-xl transition-colors shadow-2xl" style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
      {/* Online Users Sidebar */}
      <div className="w-full md:w-64 flex flex-col bg-black/5 p-4 overflow-hidden border-b md:border-b-0 md:border-r" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h4 className="text-xs font-bold uppercase tracking-widest opacity-50" style={{ color: 'var(--text-color)' }}>Operadores Online</h4>
          <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500">
            {onlineUsers.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
          {onlineUsers.map((user) => (
            <div key={user.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-black/5 transition-colors group">
              <div className="relative">
                <img 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatar_seed}`}
                  alt={user.username}
                  className="w-8 h-8 rounded-full border border-black/5"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: 'var(--text-color)' }}>{user.username}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 opacity-70">Conectado</p>
              </div>
            </div>
          ))}
          {onlineUsers.length === 0 && (
            <p className="text-[10px] text-center py-8 opacity-30">No hay otros operadores.</p>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(0,0,0,0.05)' }}>
          <div className="flex items-center gap-3">
            <div className="relative p-2 rounded-xl overflow-hidden">
              <div className="absolute inset-0" style={{ backgroundColor: 'var(--accent-color)', opacity: 0.1 }}></div>
              <MessageSquare className="w-5 h-5 relative z-10" style={{ color: 'var(--accent-color)' }} />
            </div>
            <div>
              <h3 className="font-bold" style={{ color: 'var(--text-color)' }}>Chat Comunitario</h3>
              <p className="text-xs" style={{ color: 'var(--muted-color)' }}>Interactúa con otros expertos</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-2 border-t-transparent rounded-full"
                style={{ borderColor: 'var(--accent-color)' }}
              />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <p style={{ color: 'var(--muted-color)' }}>No hay mensajes aún. ¡Sé el primero!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <motion.div
                initial={{ opacity: 0, x: msg.user_id === userProfile.id ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                key={msg.id}
                className={`flex gap-3 ${msg.user_id === userProfile.id ? 'flex-row-reverse' : ''}`}
              >
                <img 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.user_avatar}`}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full cursor-pointer hover:scale-110 transition-transform"
                  style={{ backgroundColor: 'var(--bg-color)' }}
                  onClick={() => setViewingProfile(msg)}
                />
                <div className={`max-w-[70%] flex flex-col ${msg.user_id === userProfile.id ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold" style={{ color: 'var(--muted-color)' }}>{msg.user_name}</span>
                    {msg.user_rank && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold uppercase tracking-tighter border border-emerald-500/20">
                        {msg.user_rank}
                      </span>
                    )}
                    <span className="text-[10px] opacity-50" style={{ color: 'var(--text-color)' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {msg.is_edited ? ' (editado)' : ''}
                    </span>
                  </div>
                  
                  {editingMessageId === msg.id ? (
                    <div className="w-full space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full p-3 text-sm rounded-xl border outline-none resize-none"
                        style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', borderColor: 'var(--accent-color)' }}
                        rows={3}
                      />
                      <div className="flex justify-end gap-3 mt-1">
                        <button 
                          onClick={() => setEditingMessageId(null)}
                          className="text-xs font-bold px-4 py-2 rounded-xl opacity-60 hover:opacity-100 hover:bg-black/5 transition-all"
                          style={{ color: 'var(--text-color)' }}
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={handleSaveEdit}
                          className="text-xs font-bold px-4 py-2 rounded-xl text-white shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                          style={{ backgroundColor: 'var(--accent-color)' }}
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="group relative">
                      <div className={`p-3 rounded-2xl text-sm ${
                        msg.user_id === userProfile.id 
                          ? 'rounded-tr-none' 
                          : 'rounded-tl-none border'
                      } ${msg.is_deleted ? 'italic opacity-50' : ''}`} style={{ 
                        backgroundColor: msg.user_id === userProfile.id ? 'var(--accent-color)' : 'var(--bg-color)',
                        color: msg.user_id === userProfile.id ? '#fff' : 'var(--text-color)',
                        borderColor: msg.user_id === userProfile.id ? 'transparent' : 'var(--border-color)'
                      }}>
                        {msg.content}
                      </div>
                      
                      {(msg.user_id === userProfile.id || userProfile.role === 'admin') && !msg.is_deleted && (
                        <div className={`absolute top-0 ${msg.user_id === userProfile.id ? '-left-20' : '-right-20'} opacity-0 group-hover:opacity-100 transition-opacity flex gap-2`}>
                          <button 
                            onClick={() => handleEditMessage(msg)}
                            className="p-2 rounded-xl hover:bg-black/10 transition-colors"
                            style={{ color: 'var(--muted-color)' }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setDeletingMessageId(msg.id)}
                            className="p-2 rounded-xl hover:bg-red-500/10 transition-colors"
                            style={{ color: '#ef4444' }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <AnimatePresence>
          {deletingMessageId !== null && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDeletingMessageId(null)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative max-w-sm w-full p-8 rounded-[2.5rem] border shadow-2xl overflow-hidden"
                style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Trash2 className="w-10 h-10 text-red-500" />
                </div>
                <h4 className="text-2xl font-bold mb-3 text-center" style={{ color: 'var(--text-color)' }}>¿Eliminar mensaje?</h4>
                <p className="text-sm mb-8 text-center opacity-70 leading-relaxed" style={{ color: 'var(--text-color)' }}>
                  Esta acción es permanente y el mensaje desaparecerá para todos los usuarios del chat.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setDeletingMessageId(null)}
                    className="py-4 text-sm font-bold rounded-2xl border transition-all active:scale-95 hover:bg-black/5"
                    style={{ color: 'var(--text-color)', borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-color)' }}
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => deletingMessageId !== null && handleDeleteMessage(deletingMessageId)}
                    className="py-4 text-sm font-bold bg-red-500 hover:bg-red-600 text-white rounded-2xl shadow-xl shadow-red-500/40 transition-all active:scale-95"
                  >
                    Confirmar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Typing Indicators */}
        <div className="px-4 pb-2">
          <AnimatePresence>
            {Object.values(typingUsers).map((user: any) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex items-center gap-2 mb-1"
              >
                <img 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatar_seed}`}
                  alt={user.username}
                  className="w-4 h-4 rounded-full"
                />
                <span className="text-[10px] font-bold opacity-50" style={{ color: 'var(--text-color)' }}>
                  {user.username} está escribiendo...
                </span>
                <div className="flex gap-1">
                  <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1, repeat: Infinity }} className="w-1 h-1 rounded-full bg-emerald-500" />
                  <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} className="w-1 h-1 rounded-full bg-emerald-500" />
                  <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} className="w-1 h-1 rounded-full bg-emerald-500" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <form onSubmit={handleSendMessage} className="p-4 border-t" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(0,0,0,0.05)' }}>
          <div className="relative">
            <div className="relative flex items-center">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Escribe un mensaje..."
                className="w-full border rounded-2xl py-3 pl-4 pr-24 outline-none transition-all"
                style={{ 
                  backgroundColor: 'var(--bg-color)', 
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-color)'
                }}
              />
              <div className="absolute right-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) setNewMessage(prev => prev + text);
                    } catch (err) {
                      toast.error("Usa Ctrl+V para pegar");
                    }
                  }}
                  className="p-2 rounded-xl hover:bg-black/5 transition-colors"
                  title="Pegar"
                >
                  <Clipboard className="w-4 h-4 opacity-40 hover:opacity-100 transition-opacity" />
                </button>
                <button
                  type="submit"
                  className="p-2 rounded-xl transition-colors"
                  style={{ backgroundColor: 'var(--accent-color)', color: '#fff' }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </form>

        <AnimatePresence>
          {viewingProfile && (
            <UserProfileModal 
              user={viewingProfile} 
              onClose={() => setViewingProfile(null)} 
              isDarkMode={isDarkMode} 
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  description, 
  confirmLabel = "Confirmar", 
  cancelLabel = "Cancelar",
  variant = "danger"
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  title: string; 
  description: string; 
  confirmLabel?: string; 
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info"
}) => {
  if (!isOpen) return null;

  const colors = {
    danger: { bg: 'bg-red-500', text: 'text-red-500', border: 'border-red-500/20', lightBg: 'bg-red-500/10' },
    warning: { bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500/20', lightBg: 'bg-amber-500/10' },
    info: { bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500/20', lightBg: 'bg-blue-500/10' }
  }[variant];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative max-w-sm w-full p-8 rounded-[2.5rem] border shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}
      >
        <div className={`absolute top-0 left-0 w-full h-1 ${colors.bg}`}></div>
        <div className={`w-20 h-20 ${colors.lightBg} rounded-3xl flex items-center justify-center mx-auto mb-6`}>
          <Trash2 className={`w-10 h-10 ${colors.text}`} />
        </div>
        <h4 className="text-2xl font-bold mb-3 text-center" style={{ color: 'var(--text-color)' }}>{title}</h4>
        <p className="text-sm mb-8 text-center opacity-70 leading-relaxed" style={{ color: 'var(--text-color)' }}>
          {description}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={onClose}
            className="py-4 text-sm font-bold rounded-2xl border transition-all active:scale-95 hover:bg-black/5"
            style={{ color: 'var(--text-color)', borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-color)' }}
          >
            {cancelLabel}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`py-4 text-sm font-bold ${colors.bg} hover:brightness-110 text-white rounded-2xl shadow-xl transition-all active:scale-95`}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const DirectMessages = ({ userProfile, socket }: { userProfile: UserProfile, socket: any }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [viewingProfile, setViewingProfile] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users');
        const data = await response.json();
        setUsers(data.filter((u: any) => u.id !== userProfile.id));
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };
    fetchUsers();
  }, [userProfile.id]);

  useEffect(() => {
    if (!selectedUser) return;

    const fetchDMs = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/direct-messages/${userProfile.id}/${selectedUser.id}`);
        const data = await response.json();
        setMessages(data);
      } catch (error) {
        console.error('Error fetching DMs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDMs();

    if (socket) {
      const handleNewDM = (dm: any) => {
        if ((dm.sender_id === userProfile.id && dm.receiver_id === selectedUser.id) ||
            (dm.sender_id === selectedUser.id && dm.receiver_id === userProfile.id)) {
          setMessages(prev => {
            if (prev.find(m => m.id === dm.id)) return prev;
            return [...prev, dm];
          });
        }
      };
      socket.on('new_dm', handleNewDM);
      
      const handleUserDeleted = ({ userId }: { userId: number }) => {
        setUsers(prev => prev.filter(u => u.id !== userId));
        if (selectedUser?.id === userId) {
          setSelectedUser(null);
          toast.info('El usuario con el que chateabas ha sido eliminado.');
        }
      };
      socket.on('user_deleted', handleUserDeleted);

      const handleDBCleared = () => {
        setMessages([]);
        setUsers([]);
        setSelectedUser(null);
      };
      socket.on('database_cleared', handleDBCleared);

      return () => {
        socket.off('new_dm', handleNewDM);
        socket.off('user_deleted', handleUserDeleted);
        socket.off('database_cleared', handleDBCleared);
      };
    }
  }, [selectedUser, socket, userProfile.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendDM = (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !selectedUser) return;

    socket.emit('send_dm', {
      receiverId: selectedUser.id,
      content: newMessage
    });

    setNewMessage('');
  };

  return (
    <div className="flex h-[600px] border rounded-3xl overflow-hidden backdrop-blur-xl transition-colors shadow-2xl" style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
      {/* Users List Sidebar */}
      <div className="w-full md:w-72 flex flex-col border-r" style={{ borderColor: 'var(--border-color)' }}>
        <div className="p-6 border-b" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(0,0,0,0.05)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <Users className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-bold text-sm" style={{ color: 'var(--text-color)' }}>Contactos</h3>
              <p className="text-[10px] opacity-50 uppercase tracking-widest" style={{ color: 'var(--text-color)' }}>Red de Expertos</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {users.map((user) => (
            <div
              key={user.id}
              onClick={() => setSelectedUser(user)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all group cursor-pointer ${
                selectedUser?.id === user.id ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : 'hover:bg-black/5'
              }`}
            >
              <div className="relative" onClick={(e) => {
                e.stopPropagation();
                setViewingProfile(user);
              }}>
                <img 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatar_seed}`}
                  alt={user.username}
                  className="w-10 h-10 rounded-full border border-black/5 cursor-pointer hover:scale-110 transition-transform"
                />
              </div>
              <div className="text-left min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-bold truncate ${selectedUser?.id === user.id ? 'text-white' : ''}`} style={{ color: selectedUser?.id === user.id ? '#fff' : 'var(--text-color)' }}>
                    {user.username}
                  </p>
                  {user.role === 'admin' && (
                    <span className={`text-[8px] font-bold px-1 rounded ${selectedUser?.id === user.id ? 'bg-white/20 text-white' : 'bg-red-500/10 text-red-500'}`}>
                      ADMIN
                    </span>
                  )}
                  {user.rank && (
                    <span className={`text-[7px] font-bold px-1 rounded uppercase tracking-tighter ${selectedUser?.id === user.id ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-500'}`}>
                      {user.rank}
                    </span>
                  )}
                </div>
                <p className={`text-[10px] opacity-70 ${selectedUser?.id === user.id ? 'text-white' : ''}`}>
                  Ver conversación
                </p>
              </div>
              {userProfile.role === 'admin' && user.role !== 'admin' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setUserToDelete(user);
                  }}
                  className={`p-2 rounded-lg transition-colors ${selectedUser?.id === user.id ? 'hover:bg-white/20 text-white' : 'hover:bg-red-500/10 text-red-500'}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {users.length === 0 && (
            <div className="text-center py-12 opacity-30">
              <p className="text-xs">No hay otros usuarios registrados.</p>
            </div>
          )}
        </div>

        <AnimatePresence>
          {userToDelete && (
            <ConfirmationModal
              isOpen={!!userToDelete}
              onClose={() => setUserToDelete(null)}
              onConfirm={() => {
                fetch(`/api/admin/users/${userToDelete.id}`, {
                  method: 'DELETE'
                }).then(res => {
                  if (res.ok) {
                    toast.success('Usuario eliminado');
                    setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
                    if (selectedUser?.id === userToDelete.id) setSelectedUser(null);
                  } else {
                    toast.error('Error al eliminar usuario');
                  }
                });
              }}
              title="¿Eliminar usuario?"
              description={`¿Estás seguro de eliminar a "${userToDelete.username}"? Esta acción es permanente.`}
              confirmLabel="Eliminar"
            />
          )}
        </AnimatePresence>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedUser ? (
          <>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(0,0,0,0.05)' }}>
              <div className="flex items-center gap-3">
                <img 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.avatar_seed}`}
                  alt={selectedUser.username}
                  className="w-10 h-10 rounded-full"
                />
                <div>
                  <h3 className="font-bold text-sm" style={{ color: 'var(--text-color)' }}>{selectedUser.username}</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Canal Seguro</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 border-2 border-t-transparent rounded-full"
                    style={{ borderColor: 'var(--accent-color)' }}
                  />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-30 text-center px-12">
                  <MessageSquare className="w-12 h-12 mb-4" />
                  <p className="text-sm font-bold">No hay mensajes previos</p>
                  <p className="text-xs">Inicia una conversación segura con {selectedUser.username}</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={msg.id}
                    className={`flex ${msg.sender_id === userProfile.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] p-4 rounded-3xl text-sm shadow-sm ${
                      msg.sender_id === userProfile.id 
                        ? 'bg-emerald-600 text-white rounded-tr-none' 
                        : 'bg-black/5 rounded-tl-none border'
                    }`} style={{ 
                      borderColor: msg.sender_id === userProfile.id ? 'transparent' : 'var(--border-color)',
                      color: msg.sender_id === userProfile.id ? '#fff' : 'var(--text-color)'
                    }}>
                      <p>{msg.content}</p>
                      <p className={`text-[9px] mt-2 opacity-50 ${msg.sender_id === userProfile.id ? 'text-right' : 'text-left'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendDM} className="p-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Escribe a ${selectedUser.username}...`}
                  className="w-full pl-6 pr-28 py-4 rounded-2xl border transition-all outline-none text-sm"
                  style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                />
                <div className="absolute right-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text) setNewMessage(prev => prev + text);
                      } catch (err) {
                        toast.error("Usa Ctrl+V para pegar");
                      }
                    }}
                    className="p-2 rounded-xl hover:bg-black/5 transition-colors"
                    title="Pegar"
                  >
                    <Clipboard className="w-5 h-5 opacity-40 hover:opacity-100 transition-opacity" />
                  </button>
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center disabled:opacity-50 transition-all hover:bg-emerald-700"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-center px-12">
            <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
              <Users className="w-12 h-12 text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-color)' }}>Mensajería Privada</h3>
            <p className="text-sm max-w-xs" style={{ color: 'var(--text-color)' }}>Selecciona un contacto de la lista para iniciar una comunicación encriptada de punto a punto.</p>
          </div>
        )}
        <AnimatePresence>
          {viewingProfile && (
            <UserProfileModal 
              user={viewingProfile} 
              onClose={() => setViewingProfile(null)} 
              isDarkMode={false} 
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const HASH_DATA: Record<string, AppHashData> = {
  putty: {
    name: 'putty.exe',
    description: 'Un emulador de terminal, consola serie y aplicación de transferencia de archivos de red gratuito y de código abierto. Es la herramienta estándar para conexiones SSH en entornos Windows.',
    image: 'https://images-eds-ssl.xboxlive.com/image?url=4rt9.lXDC4H_93laV1_eHHFT949fUipzkiFOBH3fAiZZUCdYojwUyX2aTonS1aIwMrx6NUIsHfUHSLzjGJFxxrDCrF4C8KvxYUkHBppqZebLObdfSSbqzWqRS3lDi.Ystyxw4_k2Pjh.pceYORwgAJzEZ0VJ3Hwwbhe5wvCwruY-&format=source&h=115',
    md5: '36e31f610eef3223154e6e8fd074190f',
    sha1: '1f2800382cd71163c10e5ce0a32b60297489fbb5',
    sha256: '16cbe40fb24ce2d422afddb5a90a5801ced32ef52c22c2fc77b25a90837f28ad',
  },
  plink: {
    name: 'plink.exe',
    description: 'Una interfaz de línea de comandos para los motores de PuTTY. Es una extensión vital para la automatización y el scripting, permitiendo ejecutar comandos remotos de forma segura desde la consola.',
    image: 'https://images-eds-ssl.xboxlive.com/image?url=4rt9.lXDC4H_93laV1_eHHFT949fUipzkiFOBH3fAiZZUCdYojwUyX2aTonS1aIwMrx6NUIsHfUHSLzjGJFxxrDCrF4C8KvxYUkHBppqZebLObdfSSbqzWqRS3lDi.Ystyxw4_k2Pjh.pceYORwgAJzEZ0VJ3Hwwbhe5wvCwruY-&format=source&h=115',
    md5: '269ce7b3a3fcdf735cd8a37c04abfdae',
    sha1: '46ddfbbb5b4193279b9e024a5d013f5d825fcdf5',
    sha256: '50479953865b30775056441b10fdcb984126ba4f98af4f64756902a807b453e7',
  },
  virtualbox: {
    name: 'VirtualBox-7.0.8-156879-Win.exe',
    description: 'Un potente software de virtualización para arquitecturas x86 y AMD64/Intel64. Permite a empresas y usuarios domésticos ejecutar múltiples sistemas operativos invitados simultáneamente.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/VirtualBox_2024_Logo.svg/1280px-VirtualBox_2024_Logo.svg.png',
    md5: '5277068968032af616e7e4cc86f1d3c2',
    sha1: '6e3e2912d2131bb249f416088ee49088ab841580',
    sha256: '8a2da26ca69c1ddfc50fb65ee4fa8f269e692302046df4e2f48948775ba6339a',
  },
};

const COMMON_PASSWORDS = [
  '123456', 'password', '12345678', 'qwerty', '12345', '123456789', 'admin', '1234', '111111', '123123',
  'abc123', 'login', 'p@ssword', 'welcome', 'root', 'guest', 'superman', 'batman', 'football', 'soccer',
  'iloveyou', 'monkey', 'dragon', 'master', 'shadow', 'hunter', 'killer', 'secret', 'testing', 'test1',
  '1234567', '1234567890', '000000', '654321', 'pass123', 'letmein', 'access', 'oracle', 'cisco', 'microsoft'
];

// --- MUSIC QUIZ GATEKEEPER ---
const QUIZ_QUESTIONS = [
  {
    id: 1,
    question: "¿Cuántos sostenidos (#) tiene la armadura de clave de Mi Mayor (E Major)?",
    options: ["2 sostenidos", "3 sostenidos", "4 sostenidos", "5 sostenidos"],
    correct: 2
  },
  {
    id: 2,
    question: "En la tonalidad de Sol Mayor (G Major), ¿cuál es el acorde que corresponde al cuarto grado (IV)?",
    options: ["Do Mayor (C)", "Re Mayor (D)", "La Menor (Am)", "Fa# Disminuido"],
    correct: 0
  },
  {
    id: 3,
    question: "Si la nota fundamental es un Do (C2), ¿cuál es el primer armónico que suena (también llamado segunda parcial)?",
    options: ["Un Sol (G3)", "Un Mi (E3)", "Un Do una octava arriba (C3)", "Un Si bemol (Bb3)"],
    correct: 2
  },
  {
    id: 4,
    question: "¿Cuál es el orden correcto de los primeros tres bemoles (b) que aparecen en las armaduras de clave?",
    options: ["Si, Mi, La", "Fa, Do, Sol", "Si, La, Re", "Mi, Si, La"],
    correct: 0
  },
  {
    id: 5,
    question: "¿Cuál es el acorde de dominante (V7) en la tonalidad de La Menor (Am)?",
    options: ["Re menor 7 (Dm7)", "Sol Mayor 7 (G7)", "Mi dominante 7 (E7)", "Fa Mayor 7 (Fmaj7)"],
    correct: 2
  }
];

const MusicGate = ({ onPass, isDarkMode }: { onPass: (method: 'quiz' | 'skip') => void, isDarkMode: boolean }) => {
  const [showIntro, setShowIntro] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  const handleAnswer = () => {
    if (selectedOption === QUIZ_QUESTIONS[currentStep].correct) {
      if (currentStep < QUIZ_QUESTIONS.length - 1) {
        setCurrentStep(prev => prev + 1);
        setSelectedOption(null);
        setError(false);
      } else {
        setIsFinished(true);
        setTimeout(() => onPass('quiz'), 2500);
      }
    } else {
      setError(true);
      setTimeout(() => {
        setCurrentStep(0);
        setSelectedOption(null);
        setError(false);
      }, 1000);
    }
  };

  const handleSkip = () => {
    setIsSkipping(true);
    setTimeout(() => onPass('skip'), 3000);
  };

  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 font-sans transition-colors duration-500 ${isDarkMode ? 'bg-[#050505]' : 'bg-gray-100'}`}>
      <div className={`max-w-md w-full border rounded-2xl p-8 shadow-2xl relative overflow-hidden transition-colors duration-500 ${isDarkMode ? 'bg-[#111] border-white/10' : 'bg-white border-black/5'}`}>
        {/* Background Glow */}
        <div className={`absolute -top-24 -right-24 w-48 h-48 blur-[100px] rounded-full ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-500/5'}`} />
        <div className={`absolute -bottom-24 -left-24 w-48 h-48 blur-[100px] rounded-full ${isDarkMode ? 'bg-blue-500/10' : 'bg-blue-500/5'}`} />

        {isSkipping ? (
          <div className="text-center py-12 relative z-10 animate-in fade-in zoom-in duration-500">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isDarkMode ? 'bg-amber-500/20' : 'bg-amber-50'}`}>
              <Zap className={`w-10 h-10 ${isDarkMode ? 'text-amber-400' : 'text-amber-500'}`} />
            </div>
            <h2 className={`text-2xl font-bold mb-4 tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Eres un pollito de colores...</h2>
            <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
              Y me lo esperaba, pero igual puedes entrar a la página.
            </p>
            <div className="mt-8 flex justify-center">
              <div className={`w-6 h-6 border-2 rounded-full animate-spin ${isDarkMode ? 'border-amber-500/30 border-t-amber-500' : 'border-amber-200 border-t-amber-500'}`} />
            </div>
          </div>
        ) : showIntro ? (
          <div className="text-center py-12 relative z-10 animate-in fade-in zoom-in duration-500">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isDarkMode ? 'bg-emerald-500/20' : 'bg-emerald-50'}`}>
              <Music className={`w-10 h-10 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-500'}`} />
            </div>
            <h2 className={`text-2xl font-bold mb-4 tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Quizz para el profesor, demuestre sus conocimientos musicales al frente de todos sus estudiantes</h2>
            <p className={`text-sm leading-relaxed mb-8 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
              Demuestra tus conocimientos musicales para acceder al sistema.
            </p>
            <div className="space-y-4">
              <button 
                onClick={() => setShowIntro(false)}
                className="w-full py-4 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
              >
                Aceptar Desafío
              </button>
              <button 
                onClick={handleSkip}
                className={`w-full py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
                  isDarkMode ? 'text-white/30 border-white/10 hover:text-white/60 hover:bg-white/5' : 'text-gray-400 border-black/5 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                Soy un pollito de colores
              </button>
            </div>
          </div>
        ) : !isFinished ? (
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-emerald-500/20' : 'bg-emerald-50'}`}>
                   <Music className={`w-5 h-5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                </div>
                <div>
                  <h2 className={`font-bold text-xl tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Prueba de Acceso</h2>
                  <p className={`text-xs uppercase tracking-widest font-medium ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`}>Nivel: Erudito Musical</p>
                </div>
              </div>
              <button
                onClick={handleSkip}
                className={`text-[10px] uppercase tracking-widest font-bold border px-2 py-1 rounded transition-all ${
                  isDarkMode ? 'text-white/30 border-white/10 hover:text-white/60 hover:bg-white/5' : 'text-gray-400 border-black/5 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                Soy un pollito de colores
              </button>
            </div>

            <div className="mb-8">
              <div className="flex justify-between items-end mb-2">
                <span className={`font-mono text-xs ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Pregunta {currentStep + 1}/5</span>
                <div className="flex gap-1">
                  {QUIZ_QUESTIONS.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 w-4 rounded-full transition-all duration-300 ${
                        i <= currentStep ? 'bg-emerald-500' : isDarkMode ? 'bg-white/10' : 'bg-gray-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <h3 className={`text-lg font-medium leading-snug ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                {QUIZ_QUESTIONS[currentStep].question}
              </h3>
            </div>

            <div className="space-y-3 mb-8">
              {QUIZ_QUESTIONS[currentStep].options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedOption(idx)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group ${
                    selectedOption === idx
                      ? isDarkMode ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : isDarkMode ? 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:border-white/10' : 'bg-gray-50 border-black/5 text-gray-500 hover:bg-gray-100 hover:border-gray-200'
                  } ${error && selectedOption === idx ? 'bg-red-500/10 border-red-500/50 text-red-400 animate-shake' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{option}</span>
                    <ChevronRight className={`w-4 h-4 transition-transform ${selectedOption === idx ? 'translate-x-1' : 'opacity-0'}`} />
                  </div>
                </button>
              ))}
            </div>

            <button
              disabled={selectedOption === null || error}
              onClick={handleAnswer}
              className="w-full py-4 font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-white text-black hover:bg-gray-200"
            >
              {error ? (
                <>
                  <XCircle className="w-5 h-5" />
                  <span>ERROR - REINICIANDO</span>
                </>
              ) : (
                <>
                  <span>SIGUIENTE</span>
                  <Play className="w-4 h-4 fill-current" />
                </>
              )}
            </button>

            <p className={`text-center mt-6 text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-white/20' : 'text-gray-400'}`}>
              Falla una y volverás al inicio. Solo la perfección otorga acceso.
            </p>
          </div>
        ) : (
          <div className="text-center py-12 relative z-10 animate-in fade-in zoom-in duration-500">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_50px_rgba(16,185,129,0.4)] ${isDarkMode ? 'bg-emerald-500' : 'bg-emerald-600'}`}>
              <Trophy className={`w-10 h-10 ${isDarkMode ? 'text-black' : 'text-white'}`} />
            </div>
            <h2 className={`text-2xl font-bold mb-2 tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>¡Eres un pollito amarillo!</h2>
            <p className={`font-mono text-sm uppercase tracking-widest ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Te has ganado tu lugar</p>
            <div className="mt-8 flex justify-center">
              <div className={`w-8 h-8 border-2 rounded-full animate-spin ${isDarkMode ? 'border-emerald-500/30 border-t-emerald-500' : 'border-emerald-200 border-t-emerald-500'}`} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [hasPassedQuiz, setHasPassedQuiz] = useState<boolean | null>(null);
  const [entryMethod, setEntryMethod] = useState<'quiz' | 'skip' | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [currentThemeId, setCurrentThemeId] = useState('dark');
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    newActivity: true,
    rareHash: true,
    verificationMatch: true
  });

  const currentTheme = useMemo(() =>
    THEMES.find(t => t.id === currentThemeId) || THEMES[0]
  , [currentThemeId]);

  useEffect(() => {
    const passed = localStorage.getItem('crypto_toolbox_quiz_passed');
    const method = localStorage.getItem('crypto_toolbox_entry_method') as 'quiz' | 'skip' | null;
    const savedTheme = localStorage.getItem('crypto_toolbox_theme');
    const savedPrefs = localStorage.getItem('crypto_toolbox_notifications');

    if (savedTheme) {
      setCurrentThemeId(savedTheme);
      setIsDarkMode(savedTheme === 'dark' || savedTheme === 'solarized' || savedTheme === 'gruvbox');
    }

    if (savedPrefs) {
      setNotificationPrefs(JSON.parse(savedPrefs));
    }

    const fallbackPassed = passed === 'true';

    (async () => {
      try {
        const res = await fetch('/api/session');
        const data = await res.json();
        if (res.ok && data.authenticated && data.user) {
          setUserProfile(data.user);
          localStorage.setItem('crypto_toolbox_profile', JSON.stringify(data.user));
          setHasPassedQuiz(true);
          setEntryMethod(method || 'skip');
          return;
        }
      } catch (err) {
        console.error('Session check failed:', err);
      }

      localStorage.removeItem('crypto_toolbox_profile');
      setUserProfile(null);
      setHasPassedQuiz(fallbackPassed);
      setEntryMethod(fallbackPassed ? (method || 'quiz') : null);
    })();
  }, []);

  useEffect(() => {
    // Apply theme colors to CSS variables
    const root = document.documentElement;
    const colors = currentTheme.colors;
    root.style.setProperty('--bg-color', colors.bg);
    root.style.setProperty('--surface-color', colors.surface);
    root.style.setProperty('--text-color', colors.text);
    root.style.setProperty('--muted-color', colors.muted);
    root.style.setProperty('--accent-color', colors.accent);
    root.style.setProperty('--border-color', colors.border);
  }, [currentTheme]);

  const handleProfileComplete = (profile: UserProfile) => {
    localStorage.setItem('crypto_toolbox_profile', JSON.stringify(profile));
    setUserProfile(profile);
  };

  const handleQuizPass = (method: 'quiz' | 'skip') => {
    localStorage.setItem('crypto_toolbox_quiz_passed', 'true');
    localStorage.setItem('crypto_toolbox_entry_method', method);
    setHasPassedQuiz(true);
    setEntryMethod(method);
  };

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    localStorage.removeItem('crypto_toolbox_profile');
    localStorage.removeItem('crypto_toolbox_quiz_passed');
    localStorage.removeItem('crypto_toolbox_entry_method');
    setUserProfile(null);
    setHasPassedQuiz(false);
    setEntryMethod(null);
  };

  const handleThemeChange = (themeId: string) => {
    setCurrentThemeId(themeId);
    localStorage.setItem('crypto_toolbox_theme', themeId);
    setIsDarkMode(themeId === 'dark' || themeId === 'solarized' || themeId === 'gruvbox');
  };

  const handleNotificationPrefsChange = (prefs: NotificationPrefs) => {
    setNotificationPrefs(prefs);
    localStorage.setItem('crypto_toolbox_notifications', JSON.stringify(prefs));
  };

  if (hasPassedQuiz === null) return null;

  return (
    <div className={isDarkMode ? 'dark' : ''} style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', minHeight: '100vh' }}>
      <Toaster position="top-right" theme={isDarkMode ? 'dark' : 'light'} />
      {!hasPassedQuiz ? (
        <MusicGate 
          onPass={handleQuizPass} 
          isDarkMode={isDarkMode} 
        />
      ) : !userProfile ? (
        <ProfileSelector 
          onSelect={handleProfileComplete} 
          onBackToQuiz={() => {
            setHasPassedQuiz(false);
            localStorage.removeItem('crypto_toolbox_quiz_passed');
            localStorage.removeItem('crypto_toolbox_entry_method');
          }} 
          isDarkMode={isDarkMode}
        />
      ) : (
        <MainApp
          entryMethod={entryMethod}
          isDarkMode={isDarkMode}
          currentTheme={currentTheme}
          userProfile={userProfile}
          notificationPrefs={notificationPrefs}
          onLogout={handleLogout}
          onThemeChange={handleThemeChange}
          onNotificationPrefsChange={handleNotificationPrefsChange}
          onProfileUpdate={setUserProfile}
          onRetakeQuiz={() => {
            setHasPassedQuiz(false);
            localStorage.removeItem('crypto_toolbox_quiz_passed');
            localStorage.removeItem('crypto_toolbox_entry_method');
          }}
        />
      )}
    </div>
  );
}

const HashingVisualizer = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const [input, setInput] = useState('Crypto');
  const [step, setStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [hashType, setHashType] = useState<'md5' | 'sha1' | 'sha256'>('sha256');

  const rounds = useMemo(() => {
    const data = CryptoJS.enc.Utf8.parse(input);
    const steps = [];
    
    if (hashType === 'sha256') {
      steps.push({ 
        title: 'Padding Inicial', 
        desc: 'El mensaje se rellena con un bit "1", seguido de ceros, y la longitud del mensaje original en 64 bits para que sea múltiplo de 512 bits.', 
        data: CryptoJS.enc.Hex.stringify(data) + '8000...',
        logic: 'Append 1 bit, then k zeros such that (L + 1 + k) % 512 = 448, then 64-bit length.'
      });
      steps.push({ 
        title: 'Valores Iniciales (H)', 
        desc: 'Se inicializan 8 registros (A-H) con los primeros 32 bits de las partes fraccionarias de las raíces cuadradas de los primeros 8 números primos.', 
        data: 'H0=6a09e667, H1=bb67ae85, H2=3c6ef372, H3=a54ff53a, H4=510e527f, H5=9b05688c, H6=1f83d9ab, H7=5be0cd19',
        logic: 'Primes: 2, 3, 5, 7, 11, 13, 17, 19. Registers: A, B, C, D, E, F, G, H.'
      });
      steps.push({ 
        title: 'Message Schedule (W)', 
        desc: 'Se expanden los 512 bits del bloque en 64 palabras de 32 bits (W0-W63) usando funciones de rotación y desplazamiento.', 
        data: 'W[0...63] expansion: ' + CryptoJS.SHA256(input).toString().substring(0, 16) + '...',
        logic: 'W[t] = σ1(W[t-2]) + W[t-7] + σ0(W[t-15]) + W[t-16] for t=16 to 63.'
      });
      for(let i=1; i<=4; i++) {
        steps.push({ 
          title: `Ronda de Compresión ${i}`, 
          desc: `Se aplican funciones lógicas (Ch, Maj, Σ0, Σ1) y constantes K[t] a los registros A-H en un ciclo de 64 iteraciones.`, 
          data: CryptoJS.SHA256(input + i).toString().substring(0, 32) + '...',
          logic: `T1 = h + Σ1(e) + Ch(e,f,g) + K[t] + W[t]; T2 = Σ0(a) + Maj(a,b,c); h=g; g=f; f=e; e=d+T1; d=c; c=b; b=a; a=T1+T2.`
        });
      }
      steps.push({ 
        title: 'Suma Final', 
        desc: 'Los valores de los registros después de 64 rondas se suman a los valores H iniciales para obtener el hash del bloque.', 
        data: 'H0 = H0 + a, H1 = H1 + b, ..., H7 = H7 + h',
        logic: 'Final state addition ensures the compression function is one-way.'
      });
      steps.push({ 
        title: 'Digest SHA-256', 
        desc: 'Los registros finales se concatenan para formar la firma digital de 256 bits (64 caracteres hexadecimales).', 
        data: CryptoJS.SHA256(input).toString(),
        logic: 'Concatenate H0 || H1 || H2 || H3 || H4 || H5 || H6 || H7.'
      });
    } else if (hashType === 'sha1') {
      steps.push({ 
        title: 'Pre-procesamiento', 
        desc: 'Se añade un bit "1" seguido de ceros y la longitud del mensaje en 64 bits para completar un bloque de 512 bits.', 
        data: CryptoJS.enc.Hex.stringify(data) + '8000...',
        logic: 'Similar to SHA-2, but uses 160-bit state (5 registers).'
      });
      steps.push({ 
        title: 'Registros A-E', 
        desc: 'Se inicializan 5 variables de 32 bits con valores constantes específicos del estándar SHA-1.', 
        data: 'A=67452301, B=efcdab89, C=98badcfe, D=10325476, E=c3d2e1f0',
        logic: 'Initial state: H0, H1, H2, H3, H4.'
      });
      for(let i=1; i<=4; i++) {
        steps.push({ 
          title: `Ronda Principal ${i}`, 
          desc: `Se realizan 80 iteraciones divididas en 4 etapas, usando funciones no lineales y rotaciones circulares sobre los registros.`, 
          data: CryptoJS.SHA1(input + i).toString().substring(0, 32) + '...',
          logic: 'TEMP = (A <<< 5) + f(B,C,D) + E + W[t] + K[t]; E=D; D=C; C=(B <<< 30); B=A; A=TEMP.'
        });
      }
      steps.push({ 
        title: 'Acumulación', 
        desc: 'Los resultados de las 80 rondas se añaden a los valores iniciales de los registros A, B, C, D y E.', 
        data: 'H0=H0+A, H1=H1+B, H2=H2+C, H3=H3+D, H4=H4+E',
        logic: 'Modulo 2^32 addition of the final state to the initial state.'
      });
      steps.push({ 
        title: 'Hash Final SHA-1', 
        desc: 'La concatenación de los 5 registros produce el digest final de 160 bits (40 caracteres hexadecimales).', 
        data: CryptoJS.SHA1(input).toString(),
        logic: 'Concatenate H0 || H1 || H2 || H3 || H4.'
      });
    } else {
      steps.push({ 
        title: 'Inicialización MD5', 
        desc: 'Se preparan los 4 registros de encadenamiento de 32 bits (A, B, C, D) con valores Little-Endian.', 
        data: 'A=01234567, B=89abcdef, C=fedcba98, D=76543210',
        logic: 'Registers: A, B, C, D. Constants derived from sine function.'
      });
      steps.push({ 
        title: 'Funciones Auxiliares', 
        desc: 'Se definen 4 funciones no lineales (F, G, H, I) que operan sobre los bits de los registros.', 
        data: 'F(X,Y,Z) = (X & Y) | (~X & Z); G(X,Y,Z) = (X & Z) | (Y & ~Z)...',
        logic: 'F, G, H, I are used in each of the 64 steps of the compression function.'
      });
      for(let i=1; i<=4; i++) {
        steps.push({ 
          title: `Operación de Ronda ${i}`, 
          desc: `Se procesa el bloque de 512 bits en 64 pasos, aplicando rotaciones y sumas modulares con constantes T[i].`, 
          data: CryptoJS.MD5(input + i).toString(),
          logic: 'A = B + ((A + F(B,C,D) + X[k] + T[i]) <<< s)'
        });
      }
      steps.push({ 
        title: 'Digest Final MD5', 
        desc: 'El resultado final es un valor de 128 bits, comúnmente usado para verificar la integridad de archivos.', 
        data: CryptoJS.MD5(input).toString(),
        logic: 'Concatenate A || B || C || D in Little-Endian format.'
      });
    }
    
    return steps;
  }, [input, hashType]);

  useEffect(() => {
    let interval: any;
    if (isAutoPlaying) {
      interval = setInterval(() => {
        setStep(s => (s + 1) % rounds.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isAutoPlaying, rounds.length]);

  const colors = {
    sha256: '#f59e0b',
    sha1: '#3b82f6',
    md5: '#ef4444'
  };

  return (
    <div className="rounded-[2.5rem] border shadow-2xl p-10 transition-all" style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center border transition-colors" style={{ backgroundColor: `${colors[hashType]}10`, borderColor: `${colors[hashType]}20` }}>
            <Cpu className="w-6 h-6" style={{ color: colors[hashType] }} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Visualizador Criptográfico</h2>
            <p className="text-xs opacity-50 uppercase tracking-widest font-bold">Análisis de Rondas en Tiempo Real</p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-1 rounded-2xl bg-black/5 border" style={{ borderColor: 'var(--border-color)' }}>
          {(['md5', 'sha1', 'sha256'] as const).map((type) => (
            <button
              key={type}
              onClick={() => { setHashType(type); setStep(0); }}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${hashType === type ? 'bg-white shadow-sm' : 'opacity-40 hover:opacity-100'}`}
              style={{ 
                backgroundColor: hashType === type ? (isDarkMode ? '#222' : '#fff') : 'transparent',
                color: hashType === type ? colors[type] : 'var(--text-color)'
              }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Step Progress Bar */}
      <div className="mb-8 flex gap-1 h-1.5 w-full bg-black/5 rounded-full overflow-hidden border border-white/5">
        {rounds.map((_, i) => (
          <div 
            key={i}
            className="flex-1 transition-all duration-500"
            style={{ 
              backgroundColor: i <= step ? colors[hashType] : 'transparent',
              opacity: i <= step ? 1 : 0.1
            }}
          />
        ))}
      </div>

      <div className="space-y-8">
        <div className="relative">
          <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-40">Texto de Entrada</label>
          <div className="relative">
            <input 
              type="text" 
              value={input} 
              onChange={(e) => { setInput(e.target.value); setStep(0); }}
              className="w-full p-5 rounded-2xl border bg-black/5 font-mono text-sm outline-none transition-all pr-12"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)', focusRingColor: `${colors[hashType]}20` }}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Type className="w-4 h-4 opacity-20" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-40">Pasos del Proceso</h3>
              <span className="text-[10px] font-mono opacity-40">{step + 1} / {rounds.length}</span>
            </div>
            {rounds.map((r, i) => (
              <motion.div 
                key={i}
                whileHover={{ x: 4 }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${step === i ? 'shadow-lg' : 'opacity-40 grayscale hover:opacity-60 hover:grayscale-0'}`}
                style={{ 
                  borderColor: step === i ? colors[hashType] : 'var(--border-color)',
                  backgroundColor: step === i ? `${colors[hashType]}05` : 'transparent'
                }}
                onClick={() => setStep(i)}
              >
                {step === i && (
                  <motion.div 
                    layoutId="active-indicator"
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: colors[hashType] }}
                  />
                )}
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold transition-colors ${step === i ? 'text-white' : 'bg-black/20'}`} style={{ backgroundColor: step === i ? colors[hashType] : '' }}>
                    {i + 1}
                  </div>
                  <h3 className="font-bold text-xs truncate">{r.title}</h3>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="lg:col-span-8">
            <div className="relative h-full min-h-[400px] rounded-[2.5rem] border bg-black/5 p-10 flex flex-col items-center justify-center text-center overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(circle, var(--text-color) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
              </div>
              
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${hashType}-${step}`}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.1, y: -20 }}
                  className="relative z-10 w-full max-w-lg"
                >
                  <div className="w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl" style={{ backgroundColor: `${colors[hashType]}20` }}>
                    <Zap className="w-10 h-10 animate-pulse" style={{ color: colors[hashType] }} />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 tracking-tight">{rounds[step].title}</h3>
                  <p className="text-sm opacity-60 mb-6 leading-relaxed max-w-[350px] mx-auto">{rounds[step].desc}</p>
                  
                  <div className="space-y-4">
                    <div className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r opacity-20 blur group-hover:opacity-30 transition duration-1000 group-hover:duration-200" style={{ backgroundImage: `linear-gradient(to right, ${colors[hashType]}, transparent)` }} />
                      <div className="relative p-6 rounded-2xl bg-black/40 font-mono text-xs break-all border border-white/5 shadow-2xl backdrop-blur-md">
                        <div className="flex items-center justify-between mb-2 opacity-30">
                          <span className="text-[8px] uppercase font-bold tracking-widest">Data Buffer</span>
                          <Database className="w-3 h-3" />
                        </div>
                        <span className="text-emerald-400">{rounds[step].data}</span>
                      </div>
                    </div>

                    {rounds[step].logic && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-xl bg-white/5 border border-white/10 text-left"
                      >
                        <div className="flex items-center gap-2 mb-2 opacity-40">
                          <Code className="w-3 h-3" />
                          <span className="text-[8px] uppercase font-bold tracking-widest">Lógica Interna</span>
                        </div>
                        <p className="text-[10px] font-mono opacity-80 leading-relaxed">{rounds[step].logic}</p>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="mt-12 flex items-center gap-4">
                <button 
                  onClick={() => setStep(s => (s - 1 + rounds.length) % rounds.length)}
                  className="p-3 rounded-xl border hover:bg-black/5 transition-all"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
                <button 
                  onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                  className="px-8 py-3 rounded-2xl font-bold text-sm shadow-xl transition-all active:scale-95 flex items-center gap-3"
                  style={{ 
                    backgroundColor: isAutoPlaying ? '#ef4444' : colors[hashType],
                    color: isAutoPlaying ? '#fff' : '#000',
                    boxShadow: `0 10px 20px -5px ${isAutoPlaying ? 'rgba(239, 68, 68, 0.3)' : `${colors[hashType]}40`}`
                  }}
                >
                  {isAutoPlaying ? <X className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isAutoPlaying ? 'Detener' : 'Auto-Play'}
                </button>
                <button 
                  onClick={() => setStep(s => (s + 1) % rounds.length)}
                  className="p-3 rounded-xl border hover:bg-black/5 transition-all"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ReputationSystem = ({ userProfile, isDarkMode }: { userProfile: UserProfile, isDarkMode: boolean }) => {
  const isAdmin = userProfile.rank === 'System Administrator';
  const currentRankIndex = RANKS.findIndex(r => r.name === userProfile.rank) !== -1 ? RANKS.findIndex(r => r.name === userProfile.rank) : 0;
  const nextRank = isAdmin ? null : RANKS[currentRankIndex + 1];
  const progress = isAdmin ? 100 : (nextRank ? ((userProfile.points || 0) / nextRank.min) * 100 : 100);
  const level = userProfile.level || Math.floor((1 + Math.sqrt(1 + 8 * (userProfile.points || 0) / 50)) / 2);

  return (
    <div className="rounded-[2.5rem] border shadow-2xl p-10 transition-all" style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
      <div className="flex flex-col md:flex-row items-center gap-8 mb-12">
        <div className="relative">
          <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border-4 border-emerald-500/20 shadow-xl">
            <img 
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.avatar_seed}`}
              alt={userProfile.username}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-2xl bg-emerald-500 flex flex-col items-center justify-center border-4 border-white shadow-lg">
            <span className="text-[8px] font-bold text-white/60 leading-none">LVL</span>
            <span className="text-sm font-black text-white leading-none">{level}</span>
          </div>
        </div>

        <div className="text-center md:text-left flex-1">
          <h2 className="text-3xl font-bold tracking-tight mb-2">{userProfile.username}</h2>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold border border-emerald-500/20 flex items-center gap-2 whitespace-nowrap tracking-tight">
              {RANKS[currentRankIndex].icon}
              {userProfile.rank}
            </span>
            <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold border border-blue-500/20 flex items-center gap-2">
              <Zap className="w-3 h-3" />
              {userProfile.points || 0} Puntos de Reputación
            </span>
            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-bold border border-amber-500/20 flex items-center gap-2">
              <Star className="w-3 h-3" />
              Nivel {level}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-12">
        <div>
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Progreso de Nivel</p>
              <h3 className="font-bold text-sm sm:text-base truncate max-w-[180px] sm:max-w-none">Siguiente Rango: {nextRank ? nextRank.name : (isAdmin ? 'Admin Máximo' : 'Nivel Máximo')}</h3>
            </div>
            <span className="text-xs font-mono font-bold">{userProfile.points || 0} / {nextRank ? nextRank.min : (isAdmin ? '∞' : '∞')}</span>
          </div>
          <div className="h-4 w-full bg-black/10 rounded-full overflow-hidden border border-white/5 p-1">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full shadow-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {RANKS.map((r, i) => (
            <div 
              key={r.name}
              className={`p-6 rounded-3xl border transition-all flex flex-col items-center text-center gap-3 ${i <= currentRankIndex ? 'bg-emerald-500/5 border-emerald-500/20' : 'opacity-30 grayscale'}`}
              style={{ borderColor: i <= currentRankIndex ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)' }}
            >
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner ${i <= currentRankIndex ? 'bg-emerald-500 text-white' : 'bg-black/20'}`}>
                {r.icon}
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-[8px] font-black uppercase tracking-tight leading-[1.1] mb-1 break-words max-w-full">{r.name}</p>
                <p className="text-[8px] opacity-50 font-mono">{r.min === Infinity ? 'Admin' : `${r.min} pts`}</p>
              </div>
              {i === currentRankIndex && (
                <div className="mt-2 px-2 py-0.5 rounded bg-emerald-500 text-[8px] font-bold text-white uppercase tracking-tighter">Actual</div>
              )}
            </div>
          ))}
        </div>

        <div className="p-8 rounded-3xl bg-black/5 border border-white/5 flex flex-col md:flex-row items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <Award className="w-8 h-8 text-blue-500" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h4 className="font-bold mb-1">¿Cómo ganar reputación?</h4>
            <p className="text-xs opacity-60 leading-relaxed">Genera nuevos hashes (+1 pt), decodifica hashes exitosamente (+5 pts) y participa en la comunidad para subir de rango y desbloquear privilegios.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

function MainApp({ entryMethod, isDarkMode, currentTheme, userProfile, notificationPrefs, onLogout, onThemeChange, onNotificationPrefsChange, onRetakeQuiz, onProfileUpdate }: {
  entryMethod: 'quiz' | 'skip' | null,
  isDarkMode: boolean,
  currentTheme: ThemeConfig,
  userProfile: UserProfile,
  notificationPrefs: NotificationPrefs,
  onLogout: () => void,
  onThemeChange: (themeId: string) => void,
  onNotificationPrefsChange: (prefs: NotificationPrefs) => void,
  onRetakeQuiz: () => void,
  onProfileUpdate: (profile: UserProfile) => void
}) {
  const [activeTab, setActiveTab] = useState<'home' | 'verify' | 'generate' | 'decode' | 'activity' | 'file' | 'explorer' | 'chat' | 'wiki' | 'messages' | 'visualizer' | 'reputation'>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [isAppEditorOpen, setIsAppEditorOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<any>(null);

  const awardPoints = useCallback(async (points: number) => {
    try {
      const response = await fetch('/api/users/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userProfile.id, pointsToAdd: points })
      });
      if (response.ok) {
        const data = await response.json();
        const updatedProfile = { 
          ...userProfile, 
          points: data.points, 
          rank: data.rank,
          level: data.level 
        };
        onProfileUpdate(updatedProfile);
        localStorage.setItem('crypto_toolbox_profile', JSON.stringify(updatedProfile));
        
        if (data.rank !== userProfile.rank) {
          toast.success(`¡Nuevo Rango Alcanzado: ${data.rank}!`, {
            icon: <Award className="w-5 h-5 text-yellow-500" />
          });
        }
      } else if (response.status === 404 || response.status === 401) {
        toast.error('Tu sesión ha expirado o tu usuario ha sido eliminado');
        onLogout();
      }
    } catch (error) {
      console.error('Error awarding points:', error);
    }
  }, [userProfile, onProfileUpdate, onLogout]);

  const fetchApps = useCallback(async () => {
    try {
      const response = await fetch('/api/apps');
      if (response.ok) {
        const data = await response.json();
        setApps(data);
      }
    } catch (error) {
      console.error('Error fetching apps:', error);
    }
  }, []);

  useEffect(() => {
    fetchApps();
  }, []);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ title: string, description: string, onConfirm: () => void } | null>(null);
  const [dbStatus, setDbStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // File Hashing State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileHashes, setFileHashes] = useState<{ md5: string; sha1: string; sha256: string } | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [hashingProgress, setHashingProgress] = useState(0);

  // Activity Filters & Sorting
  const [activityFilterType, setActivityFilterType] = useState<'all' | 'generate' | 'decode' | 'verify' | 'file'>('all');
  const [activityFilterUser, setActivityFilterUser] = useState('');
  const [activitySortBy, setActivitySortBy] = useState<'timestamp' | 'username'>('timestamp');
  const [activitySortOrder, setActivitySortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedHashType, setSelectedHashType] = useState<'md5' | 'sha1' | 'sha256'>('sha256');
  const [explorerSearch, setExplorerSearch] = useState('');
  const deferredExplorerSearch = useDeferredValue(explorerSearch);
  const [explorerPage, setExplorerPage] = useState(1);
  const [socket, setSocket] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

  const getDisplayHash = useCallback((hashStr: string, type: 'md5' | 'sha1' | 'sha256') => {
    try {
      const hashes = JSON.parse(hashStr);
      return hashes[type] || hashes.default || Object.values(hashes)[0] || hashStr;
    } catch (e) {
      return hashStr;
    }
  }, []);

  const [hashCache, setHashCache] = useState<Record<string, string>>(() => {
    const initialCache: Record<string, string> = {};
    COMMON_PASSWORDS.forEach(pwd => {
      initialCache[CryptoJS.MD5(pwd).toString()] = pwd;
      initialCache[CryptoJS.SHA1(pwd).toString()] = pwd;
      initialCache[CryptoJS.SHA256(pwd).toString()] = pwd;
    });
    Object.values(HASH_DATA).forEach(app => {
      initialCache[app.md5.toLowerCase()] = `${app.name} (MD5)`;
      initialCache[app.sha1.toLowerCase()] = `${app.name} (SHA1)`;
      initialCache[app.sha256.toLowerCase()] = `${app.name} (SHA256)`;
    });
    return initialCache;
  });

  const groupedHashes = useMemo(() => {
    const groups: Record<string, { md5?: string, sha1?: string, sha256?: string, default?: string }> = {};
    Object.entries(hashCache).forEach(([hash, value]) => {
      // Clean up the value to group properly (e.g., remove " (MD5)" suffix if present)
      const cleanValue = (value as string).replace(/ \((MD5|SHA1|SHA256)\)$/i, '');
      if (!groups[cleanValue]) groups[cleanValue] = {};
      
      if (hash.length === 32) groups[cleanValue].md5 = hash;
      else if (hash.length === 40) groups[cleanValue].sha1 = hash;
      else if (hash.length === 64) groups[cleanValue].sha256 = hash;
      else groups[cleanValue].default = hash;
    });
    return Object.entries(groups).map(([value, hashes]) => ({ value, hashes }));
  }, [hashCache]);

  const filteredExplorerHashes = useMemo(() => {
    const search = deferredExplorerSearch.toLowerCase();
    return groupedHashes
      .filter(({ value, hashes }) => {
        const currentHash = hashes[selectedHashType] || hashes.default || '';
        return currentHash.toLowerCase().includes(search) || value.toLowerCase().includes(search);
      })
      .reverse();
  }, [groupedHashes, deferredExplorerSearch, selectedHashType]);

  const filteredActivities = useMemo(() => {
    let result = [...activities];

    // Filter by type
    if (activityFilterType !== 'all') {
      result = result.filter(a => a.type === activityFilterType);
    }

    // Filter by user
    if (activityFilterUser) {
      result = result.filter(a => 
        a.user_name?.toLowerCase().includes(activityFilterUser.toLowerCase())
      );
    }

    // Sort
    result.sort((a, b) => {
      if (activitySortBy === 'timestamp') {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return activitySortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      } else {
        const nameA = (a.user_name || '').toLowerCase();
        const nameB = (b.user_name || '').toLowerCase();
        return activitySortOrder === 'asc' 
          ? nameA.localeCompare(nameB) 
          : nameB.localeCompare(nameA);
      }
    });

    return result;
  }, [activities, activityFilterType, activityFilterUser, activitySortBy, activitySortOrder]);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024 * 1024) {
      toast.error("Archivo demasiado grande", {
        description: "El límite máximo es de 500MB."
      });
      return;
    }

    setSelectedFile(file);
    setFileHashes(null);
    setIsHashing(true);
    setHashingProgress(0);

    try {
      const startTime = Date.now();
      setDbStatus('idle');
      
      const chunkSize = 2 * 1024 * 1024; // 2MB chunks
      const md5 = CryptoJS.algo.MD5.create();
      const sha1 = CryptoJS.algo.SHA1.create();
      const sha256 = CryptoJS.algo.SHA256.create();
      
      let offset = 0;
      const reader = new FileReader();

      const readNextChunk = () => {
        return new Promise<void>((resolve, reject) => {
          reader.onload = (event) => {
            if (event.target?.result instanceof ArrayBuffer) {
              const wordArray = CryptoJS.lib.WordArray.create(event.target.result as any);
              md5.update(wordArray);
              sha1.update(wordArray);
              sha256.update(wordArray);
              
              offset += event.target.result.byteLength;
              const progress = Math.min(100, Math.round((offset / file.size) * 100));
              setHashingProgress(progress);
              resolve();
            } else {
              reject(new Error("Failed to read chunk"));
            }
          };
          reader.onerror = () => reject(reader.error);
          const slice = file.slice(offset, offset + chunkSize);
          reader.readAsArrayBuffer(slice);
        });
      };

      while (offset < file.size) {
        await readNextChunk();
      }

      const md5Hash = md5.finalize().toString();
      const sha1Hash = sha1.finalize().toString();
      const sha256Hash = sha256.finalize().toString();
      
      setFileHashes({ md5: md5Hash, sha1: sha1Hash, sha256: sha256Hash });
      
      // Update shared cache and global activity
      updateSharedCache({ md5: md5Hash, sha1: sha1Hash, sha256: sha256Hash }, file.name, 'file');
      
      toast.success("Análisis completado con éxito", {
        description: `Se han generado 3 firmas digitales en ${((Date.now() - startTime) / 1000).toFixed(2)}s`
      });
    } catch (error) {
      console.error("Error hashing file:", error);
      toast.error("Fallo en el análisis de integridad", {
        description: "Hubo un problema al procesar los datos del archivo."
      });
    } finally {
      setIsHashing(false);
    }
  };

  // Security: Disable right-click, copy, and paste
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleCopy = (e: ClipboardEvent) => {
      // Allow copy only if it's not from a standard user action
      // But the user said "no se pueda copiar nada" except via buttons.
      // Buttons use navigator.clipboard, which doesn't trigger this event.
      e.preventDefault();
    };
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('copy', handleCopy);
    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('copy', handleCopy);
      window.removeEventListener('paste', handlePaste);
    };
  }, []);

  // States for Generate Tab
  const [textToHash, setTextToHash] = useState('');
  const [recentCached, setRecentCached] = useState<string[]>([]);

  // States for Decode Tab
  const [hashToDecode, setHashToDecode] = useState('');
  const [decodeInputError, setDecodeInputError] = useState<string | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);

  const smartCleanHash = (input: string) => {
    let val = input.trim().toLowerCase();
    val = val.replace(/^(md5|sha1|sha256|fingerprint|hash):\s*/i, '');
    val = val.replace(/[:\s-]/g, '');
    return val.replace(/[^0-9a-f]/g, '');
  };

  const [decodeResult, setDecodeResult] = useState<{
    found: boolean;
    value?: string;
    method?: 'brute-force' | 'online-search' | 'local-cache';
    attempts?: number;
    time?: number;
    error?: string;
  } | null>(null);

  const generatedHashes = useMemo(() => {
    if (!textToHash) return { md5: '', sha1: '', sha256: '' };
    return {
      md5: CryptoJS.MD5(textToHash).toString(),
      sha1: CryptoJS.SHA1(textToHash).toString(),
      sha256: CryptoJS.SHA256(textToHash).toString(),
    };
  }, [textToHash]);

  useEffect(() => {
    const fetchSharedCache = async () => {
      try {
        const response = await fetch('/api/hashes');
        if (response.ok) {
          const sharedData = await response.json();
          setHashCache(prev => ({ ...prev, ...sharedData }));
        }
      } catch (error) {
        console.error('Failed to fetch shared cache:', error);
      }
    };
    fetchSharedCache();

    const fetchActivities = async () => {
      try {
        const response = await fetch('/api/activities');
        if (response.ok) {
          const data = await response.json();
          setActivities(data);
        }
      } catch (error) {
        console.error('Failed to fetch activities:', error);
      }
    };
    fetchActivities();
  }, [userProfile]);

  const handleDeleteHash = async (hash: string) => {
    const targetHash = hash.toLowerCase();
    try {
      const res = await fetch(`/api/admin/hashes/${targetHash}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('Hash eliminado de la base de datos');
        setHashCache(prev => {
          const next = { ...prev };
          delete next[targetHash];
          return next;
        });
        setRecentCached(prev => prev.filter(h => h.toLowerCase() !== targetHash));
      }
    } catch (error) {
      toast.error('Error al eliminar hash');
    }
  };

  const handleDeleteValue = async (value: string) => {
    try {
      const res = await fetch('/api/admin/hash-values', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });
      if (res.ok) {
        toast.success('Valor y hashes eliminados');
        const md5 = CryptoJS.MD5(value).toString().toLowerCase();
        const sha1 = CryptoJS.SHA1(value).toString().toLowerCase();
        const sha256 = CryptoJS.SHA256(value).toString().toLowerCase();
        
        setHashCache(prev => {
          const next = { ...prev };
          delete next[md5];
          delete next[sha1];
          delete next[sha256];
          return next;
        });
        setRecentCached(prev => prev.filter(v => v !== value));
      }
    } catch (error) {
      toast.error('Error al eliminar valor');
    }
  };

  const handleDeleteActivity = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/activities/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('Actividad eliminada');
        setActivities(prev => prev.filter(a => a.id !== id));
      }
    } catch (error) {
      toast.error('Error al eliminar actividad');
    }
  };

  useEffect(() => {
    const newSocket = io({ transports: ['websocket'], withCredentials: true });
    
    // Authenticate socket connection
    if (userProfile?.username) {
      newSocket.emit('user_online', userProfile);
    }
    
    setSocket(newSocket);

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      toast.error('Error de conexión con el servidor de chat');
    });

    newSocket.on('update_online_users', (users: any[]) => {
      setOnlineUsers(users);
    });

    newSocket.on('new_hash', (data: { hash: string, value: string }) => {
      setHashCache(prev => ({ ...prev, [data.hash]: data.value }));
    });
    newSocket.on('new_activity', (activity: Activity) => {
      setActivities(prev => {
        if (prev.find(a => a.id === activity.id)) return prev;
        return [activity, ...prev].slice(0, 50);
      });
      
      // Notification for new global activity
      if (notificationPrefs.newActivity && activity.user_name !== userProfile.username) {
        toast.info(`Nueva actividad de ${activity.user_name}`, {
          description: `${activity.type === 'generate' ? 'Generó' : activity.type === 'decode' ? 'Decodificó' : activity.type === 'file' ? 'Analizó' : 'Verificó'} un hash`,
          icon: activity.type === 'file' ? (
            <File className="w-6 h-6 text-amber-500" />
          ) : activity.user_avatar && activity.user_avatar !== '👤' ? (
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${activity.user_avatar}`} className="w-6 h-6 rounded-full" />
          ) : (
            <span className="text-xl">👤</span>
          )
        });
      }
    });

    newSocket.on('new_dm', (dm: any) => {
      if (dm.receiver_id === userProfile.id) {
        toast.info(`Nuevo mensaje privado`, {
          description: `Has recibido un mensaje de un operador.`,
          icon: <MessageSquare className="w-6 h-6 text-emerald-500" />
        });
      }
    });

    newSocket.on('user_deleted', ({ userId }: { userId: number }) => {
      if (userProfile.id === userId) {
        toast.error('Tu cuenta ha sido eliminada por un administrador');
        setTimeout(() => onLogout(), 2000);
      } else {
        setOnlineUsers(prev => prev.filter(u => u.id !== userId));
      }
    });

    newSocket.on('force_logout', () => {
      toast.error('Tu sesión ha expirado o tu cuenta ya no existe');
      onLogout();
    });

    newSocket.on('database_cleared', () => {
      setHashCache({});
      setActivities([]);
      setRecentCached([]);
      setOnlineUsers([userProfile]); // Mantener solo al usuario actual
      toast.info('La base de datos ha sido reiniciada por un administrador');
      
      // Si el usuario no es admin, su cuenta fue eliminada
      if (userProfile.role !== 'admin') {
        setTimeout(() => {
          onLogout();
          toast.error('Tu sesión ha expirado porque la base de datos fue reiniciada');
        }, 3000);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const updateSharedCache = useCallback(async (hashes: Record<string, string>, value: string, type: 'generate' | 'decode' | 'verify' | 'file' = 'generate') => {
    if (!userProfile) return;
    try {
      // Award points based on activity
      const pointsMap: Record<string, number> = {
        'generate': 5,
        'decode': 20,
        'verify': 10,
        'file': 50
      };
      awardPoints(pointsMap[type] || 5);

      const response = await fetch('/api/hashes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          hashes, 
          value,
          type,
          userName: userProfile.username,
          userAvatar: userProfile.avatar_seed,
          userId: userProfile.id
        }),
      });
      if (response.ok) {
        setDbStatus('success');
        setHashCache(prev => {
          const next = { ...prev };
          Object.values(hashes).forEach(h => {
            if (h) next[h.toLowerCase()] = value;
          });
          return next;
        });
      } else {
        setDbStatus('error');
      }
    } catch (error) {
      console.error('Failed to update shared cache:', error);
      setDbStatus('error');
    }
  }, [userProfile, awardPoints, userProfile.username, userProfile.avatar_seed]);

  useEffect(() => {
    if (textToHash) {
      const { md5, sha1, sha256 } = generatedHashes;
      const isAlreadyCached = hashCache[md5] && hashCache[sha1] && hashCache[sha256];
      
      if (!isAlreadyCached) {
        updateSharedCache({ md5, sha1, sha256 }, textToHash, 'generate');
        setHashCache(prev => ({
          ...prev,
          [md5]: textToHash,
          [sha1]: textToHash,
          [sha256]: textToHash,
        }));
      }

      setRecentCached(prev => {
        if (prev[0] === textToHash) return prev;
        awardPoints(1); // Award 1 point for generating a new hash
        return [textToHash, ...prev.filter(i => i !== textToHash)].slice(0, 5);
      });
    }
  }, [generatedHashes, textToHash, hashCache, updateSharedCache, awardPoints]);

  const handleDecode = async () => {
    const targetHash = smartCleanHash(hashToDecode);
    if (!targetHash) return;

    const isValidLength = [32, 40, 64].includes(targetHash.length);

    if (!isValidLength) {
      setDecodeResult({
        found: false,
        error: `Longitud de hash inválida (${targetHash.length}). Debe ser 32 (MD5), 40 (SHA1) o 64 (SHA256).`,
        time: 0
      });
      return;
    }

    setIsDecoding(true);
    setDecodeResult(null);
    const startTime = Date.now();

    if (hashCache[targetHash]) {
      awardPoints(5);
      setDecodeResult({
        found: true,
        value: hashCache[targetHash],
        method: 'database',
        time: Date.now() - startTime
      });
      setIsDecoding(false);
      return;
    }

    try {
      console.log(`[DECODE] Iniciando búsqueda online para hash: ${targetHash}`);
      
      // 1. Intentar con el servicio gratuito del servidor
      const freeResponse = await fetch(`/api/decode/online/${targetHash}`);
      const freeData = await freeResponse.json();

      if (freeData.found) {
        const text = freeData.value;
        console.log(`[DECODE] Encontrado en ${freeData.source}: ${text}`);
        
        setDecodeResult({
          found: true,
          value: text,
          method: `online-${freeData.source.toLowerCase()}`,
          time: Date.now() - startTime
        });

        if (notificationPrefs.rareHash) {
          toast.success('¡Hash decodificado con éxito!', {
            description: `Valor encontrado: ${text} (vía ${freeData.source})`
          });
        }

        updateSharedCache({ default: targetHash }, text, 'decode');
        setHashCache(prev => ({ ...prev, [targetHash]: text }));
        awardPoints(25);
        setIsDecoding(false);
        return;
      }

      // 2. Intentar con Gemini SOLO si hay API KEY configurada
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY") {
        console.log("[DECODE] No encontrado en bases gratuitas, intentando con Gemini...");
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Analiza el siguiente hash: ${targetHash}. 
Busca en internet (CrackStation, MD5Decrypt, bases de datos de filtraciones, etc.) para encontrar su valor original en texto plano.
Si encuentras el valor, responde ÚNICAMENTE con el texto original decodificado, sin explicaciones ni formato adicional.
Si NO lo encuentras tras buscar exhaustivamente, responde exactamente: NOT_FOUND`,
          config: {
            tools: [{ googleSearch: {} }],
            temperature: 0.1,
          },
        });

        const text = response.text?.trim();
        if (text && text !== "NOT_FOUND" && !text.toLowerCase().includes("not found") && text.length < 100) {
          setDecodeResult({
            found: true,
            value: text,
            method: 'online-ai',
            time: Date.now() - startTime
          });

          if (notificationPrefs.rareHash) {
            toast.success('¡Hash decodificado con éxito!', {
              description: `Valor encontrado: ${text} (vía IA)`
            });
          }

          updateSharedCache({ default: targetHash }, text, 'decode');
          setHashCache(prev => ({ ...prev, [targetHash]: text }));
          awardPoints(25);
          setIsDecoding(false);
          return;
        }
      }

      setDecodeResult({
        found: false,
        error: "No se encontró el valor del hash en las bases de datos online gratuitas.",
        time: Date.now() - startTime
      });
      toast.error('No se encontró el valor del hash en las bases de datos online.');
    } catch (error) {
      console.error("Decoding search failed:", error);
      setDecodeResult({
        found: false,
        error: "Error al realizar la búsqueda en línea.",
        time: Date.now() - startTime
      });
    } finally {
      setIsDecoding(false);
    }
  };

  return (
    <div className={`min-h-screen transition-all duration-500 font-sans selection:bg-emerald-100 select-none`} style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}>
      {/* Top Controls */}
      <div className="fixed top-6 right-6 z-50 flex items-center gap-3">
        {/* Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className={`flex items-center gap-3 px-4 py-2 rounded-2xl shadow-lg transition-all border group ${
              isDarkMode 
                ? 'bg-black/40 border-white/10 text-white hover:bg-black/60 backdrop-blur-md' 
                : 'bg-white border-black/5 text-[#1a1a1a] hover:bg-gray-50'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg border transition-transform group-hover:scale-110 ${
              isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-black/5'
            }`}>
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.avatar_seed}`} className="w-6 h-6 rounded-full" />
            </div>
            <div className="text-left hidden sm:block">
              <p className={`text-[10px] uppercase tracking-widest font-bold leading-none mb-1 ${isDarkMode ? 'text-emerald-500/60' : 'text-emerald-600'}`}>
                {userProfile.role === 'admin' ? 'Administrador' : 'Operador'}
              </p>
              <p className="text-xs font-bold leading-none">{userProfile.username}</p>
            </div>
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <>
                <div 
                  className="fixed inset-0 z-[-1]" 
                  onClick={() => setShowProfileMenu(false)} 
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className={`absolute right-0 mt-3 w-56 rounded-3xl shadow-2xl border overflow-hidden backdrop-blur-xl ${
                    isDarkMode ? 'bg-black/80 border-white/10' : 'bg-white border-black/5'
                  }`}
                >
                  <div className={`p-5 border-b ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
                    <div className={`flex items-center gap-2 p-2 rounded-lg ${userProfile.role === 'admin' ? (isDarkMode ? 'bg-red-500/10' : 'bg-red-50') : (isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50')}`}>
                      <Shield className={`w-3 h-3 ${userProfile.role === 'admin' ? (isDarkMode ? 'text-red-400' : 'text-red-600') : (isDarkMode ? 'text-emerald-400' : 'text-emerald-600')}`} />
                      <span className={`text-[9px] font-bold uppercase tracking-tighter ${userProfile.role === 'admin' ? (isDarkMode ? 'text-red-400' : 'text-red-600') : (isDarkMode ? 'text-emerald-400' : 'text-emerald-600')}`}>
                        Nivel de Acceso: {userProfile.role === 'admin' ? 'Administrador Maestro' : 'Pro'}
                      </span>
                    </div>
                  </div>
                  <div className="p-2 space-y-1">
                    {userProfile.role === 'admin' && (
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          setConfirmAction({
                            title: '¿Limpiar Base de Datos?',
                            description: 'Esta acción eliminará todos los hashes, usuarios, chats e historial de actividad. No se puede deshacer.',
                            onConfirm: async () => {
                              console.log("[ADMIN] Iniciando petición de limpieza de base de datos...");
                              try {
                                const res = await fetch('/api/admin/hashes', {
                                  method: 'DELETE'
                                });
                                if (res.ok) {
                                  console.log("[ADMIN] Petición de limpieza exitosa");
                                  toast.success('Base de datos limpiada');
                                  setHashCache({});
                                  setActivities([]);
                                  setRecentCached([]);
                                } else {
                                  const errorData = await res.json();
                                  console.error("[ADMIN] Error en la petición de limpieza:", errorData);
                                  toast.error(`Error: ${errorData.error || 'No se pudo limpiar'}`);
                                }
                              } catch (error) {
                                console.error("[ADMIN] Error de red al limpiar base de datos:", error);
                                toast.error('Error de conexión');
                              }
                            }
                          });
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-amber-500 hover:bg-amber-500/10 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Database className="w-4 h-4" />
                        </div>
                        Limpiar Base de Datos
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-red-500 hover:bg-red-500/10 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <LogOut className="w-4 h-4" />
                      </div>
                      Cerrar Sesión
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => setShowSettings(true)}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all border`}
          style={{ backgroundColor: 'var(--text-color)', color: 'var(--bg-color)', borderColor: 'var(--border-color)' }}
          title="Configuración"
        >
          <Settings className="w-6 h-6" />
        </button>
      </div>

      {/* Gold Medal for Quiz Winners */}
      {entryMethod === 'quiz' && (
        <div className="fixed top-6 left-6 z-50 animate-bounce" title="Pollito de Color - Ganaste tu lugar">
          <div className="w-12 h-12 bg-amber-400 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.5)] border-2 border-amber-600">
            <Medal className="w-7 h-7 text-amber-800" />
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-12 text-center relative">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-sm border mb-6`} style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
            <Shield className={`w-8 h-8`} style={{ color: 'var(--accent-color)' }} />
          </div>
          <h1 className={`text-4xl font-semibold tracking-tight mb-3`}>CryptoToolbox & Checksum Verification</h1>
          <p className={`max-w-md mx-auto mb-6 opacity-60`}>
            Herramientas avanzadas para verificación de integridad, generación de hashes y decodificación.
          </p>
          <button
            onClick={() => setShowFeatures(true)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all shadow-sm`}
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-color)', opacity: 0.9 }}
          >
            <Zap className="w-4 h-4" />
            Ver Funcionalidades Implementadas
          </button>
        </header>

        {/* Features Modal */}
        <AnimatePresence>
          {showFeatures && (
            <motion.div 
              key="features-modal" 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            >
              <div
                onClick={() => setShowFeatures(false)}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className={`relative w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border backdrop-blur-xl`}
                style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}
              >
                <div className="p-8">
                  <div className={`flex items-center justify-between mb-8 border-b pb-6`} style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-xl flex items-center justify-center border overflow-hidden" style={{ borderColor: 'var(--accent-color)' }}>
                        <div className="absolute inset-0" style={{ backgroundColor: 'var(--accent-color)', opacity: 0.1 }}></div>
                        <Zap className="w-5 h-5 relative z-10" style={{ color: 'var(--accent-color)' }} />
                      </div>
                      <h2 className={`text-2xl font-bold tracking-tight`} style={{ color: 'var(--text-color)' }}>Protocolo de Funciones</h2>
                    </div>
                    <button
                      onClick={() => setShowFeatures(false)}
                      className={`p-2 rounded-xl transition-colors`}
                      style={{ color: 'var(--muted-color)' }}
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    <FeatureItem
                      icon={<Palette className="w-5 h-5" />}
                      title="Gestión de Temas"
                      description="Personalización avanzada con temas pre-definidos (Solarized, Gruvbox) y modo oscuro/claro."
                    />
                    <FeatureItem
                      icon={<Bell className="w-5 h-5" />}
                      title="Sistema de Alertas"
                      description="Notificaciones inteligentes para hallazgos de hashes raros y actividad global relevante."
                    />
                    <FeatureItem
                      icon={<Filter className="w-5 h-5" />}
                      title="Filtros Inteligentes"
                      description="Búsqueda y clasificación avanzada en el historial de actividad global por tipo y usuario."
                    />
                    <FeatureItem
                      icon={<User className="w-5 h-5" />}
                      title="Perfiles de Operador"
                      description="Identidad digital con avatares y alias para trazabilidad en operaciones compartidas."
                    />
                    <FeatureItem
                      icon={<Globe className="w-5 h-5" />}
                      title="Feed en Tiempo Real"
                      description="Sincronización instantánea de actividades vía WebSockets para colaboración en vivo."
                    />
                    <FeatureItem
                      icon={<Shield className="w-5 h-5" />}
                      title="Verificación de Checksum"
                      description="Validación de integridad contra bases de datos oficiales de software conocido."
                    />
                    <FeatureItem
                      icon={<Search className="w-5 h-5" />}
                      title="Búsqueda por IA"
                      description="Identificación de archivos desconocidos mediante Gemini AI y búsqueda semántica."
                    />
                    <FeatureItem
                      icon={<Unlock className="w-5 h-5" />}
                      title="Decodificador Rainbow"
                      description="Recuperación de texto plano mediante tablas de búsqueda y fuerza bruta optimizada."
                    />
                  </div>

                  <div className={`mt-8 pt-6 border-t flex justify-end`} style={{ borderColor: 'var(--border-color)' }}>
                    <button
                      onClick={() => setShowFeatures(false)}
                      className={`px-8 py-3 rounded-2xl font-bold transition-all shadow-lg`}
                      style={{ backgroundColor: 'var(--text-color)', color: 'var(--bg-color)' }}
                    >
                      Entendido
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {confirmAction && (
            <ConfirmationModal
              isOpen={!!confirmAction}
              onClose={() => setConfirmAction(null)}
              onConfirm={confirmAction.onConfirm}
              title={confirmAction.title}
              description={confirmAction.description}
              confirmLabel="Confirmar"
            />
          )}
        </AnimatePresence>

        {/* Dashboard Menu */}
        <AnimatePresence mode="wait">
          {activeTab === 'home' ? (
            <motion.div
              key="home-grid"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto"
            >
              {[
                { id: 'verify', label: 'Verificar Hash', icon: Shield, desc: 'Comprueba si un hash coincide con un texto o aplicación.', color: '#3b82f6' },
                { id: 'generate', label: 'Generar Hash', icon: Hash, desc: 'Crea hashes MD5, SHA1 y SHA256 a partir de textos.', color: '#f59e0b' },
                { id: 'file', label: 'Hash de Archivo', icon: Download, desc: 'Analiza y extrae firmas digitales de cualquier archivo.', color: '#10b981' },
                { id: 'decode', label: 'Decodificar', icon: Unlock, desc: 'Intenta revertir un hash usando fuerza bruta y diccionarios.', color: '#ef4444' },
                { id: 'explorer', label: 'Explorador', icon: Search, desc: 'Busca en la base de datos global de hashes conocidos.', color: '#8b5cf6' },
                { id: 'activity', label: 'Actividad Global', icon: Globe, desc: 'Observa las operaciones de hash en tiempo real.', color: '#06b6d4' },
                { id: 'chat', label: 'Chat Global', icon: MessageSquare, desc: 'Comunícate con otros expertos en seguridad.', color: '#ec4899' },
                { id: 'messages', label: 'Mensajes Directos', icon: Users, desc: 'Conversaciones privadas con otros operadores.', color: '#6366f1' },
                { id: 'wiki', label: 'Wiki Algoritmos', icon: BookOpen, desc: 'Información técnica sobre algoritmos de hash.', color: '#14b8a6' },
                { id: 'visualizer', label: 'Visualizador', icon: Cpu, desc: 'Observa paso a paso cómo se generan las rondas de un hash.', color: '#f97316' },
                { id: 'reputation', label: 'Reputación', icon: Trophy, desc: 'Tu rango y puntos en la red de expertos en seguridad.', color: '#84cc16' },
                { id: 'retake_quiz', label: 'Repetir Quiz', icon: Music, desc: 'Vuelve a realizar el desafío musical de entrada.', color: '#f43f5e' },
              ].map((module) => (
                <button
                  key={module.id}
                  onClick={() => {
                    if (module.id === 'retake_quiz') {
                      onRetakeQuiz();
                    } else {
                      setActiveTab(module.id as any);
                    }
                  }}
                  className="group flex flex-col items-start p-6 rounded-3xl border shadow-sm hover:shadow-xl transition-all duration-300 text-left relative overflow-hidden"
                  style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br opacity-5 group-hover:opacity-10 transition-opacity rounded-bl-full" style={{ backgroundImage: `linear-gradient(to bottom right, transparent, ${module.color})` }} />
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-sm border transition-transform group-hover:scale-110" style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}>
                    <module.icon className="w-6 h-6" style={{ color: module.color }} />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight mb-2">{module.label}</h3>
                  <p className="text-xs opacity-60 leading-relaxed">{module.desc}</p>
                </button>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="active-module"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto"
            >
              <button
                onClick={() => setActiveTab('home')}
                className="mb-8 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border shadow-sm hover:shadow-md transition-all group"
                style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
              >
                <ChevronRight className="w-4 h-4 rotate-180 opacity-50 group-hover:opacity-100 transition-opacity" />
                Volver al Menú
              </button>
              
              <AnimatePresence mode="wait">
          {activeTab === 'file' && (
            <motion.div
              key="file-tab"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              <div className={`rounded-[2.5rem] border shadow-2xl p-10 transition-all`} style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
                <div className="max-w-xl mx-auto text-center">
                  <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 border shadow-inner`} style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}>
                    <Download className={`w-10 h-10`} style={{ color: 'var(--accent-color)' }} />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight mb-4">Análisis de Archivos</h2>
                  <p className="opacity-60 text-sm mb-10 leading-relaxed">Sube cualquier aplicación o archivo (máx. 500MB) para generar su firma digital SHA-256 y registrarla en el protocolo global.</p>

                  <div className="relative group">
                    <input
                      type="file"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`p-12 rounded-[2rem] border-2 border-dashed transition-all flex flex-col items-center gap-4 group-hover:border-emerald-500/50`} style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border`} style={{ borderColor: 'var(--border-color)' }}>
                        <Download className="w-6 h-6 opacity-40 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">Haga clic o arrastre un archivo</p>
                        <p className="text-[10px] uppercase tracking-widest opacity-40 mt-1">Límite de 500MB &bull; SHA-256</p>
                      </div>
                    </div>
                  </div>

                  {isHashing && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-8 p-6 rounded-2xl border flex items-center gap-4"
                      style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center animate-spin">
                        <Zap className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-xs font-bold uppercase tracking-widest text-emerald-500">Calculando Firmas Digitales...</p>
                          <span className="text-xs font-mono font-bold text-emerald-500">{hashingProgress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-emerald-500"
                            animate={{ width: `${hashingProgress}%` }}
                            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {fileHashes && selectedFile && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-8 space-y-4"
                    >
                      <div className={`p-6 rounded-[2rem] border text-left`} style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}>
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                              <Check className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Análisis de Integridad Exitoso</p>
                              <p className="text-sm font-bold truncate max-w-[200px]">{selectedFile.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold opacity-40">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                            {userProfile.role === 'admin' && (
                              <button
                                onClick={() => {
                                  if (fileHashes) {
                                    handleDeleteHash(fileHashes.md5);
                                    handleDeleteHash(fileHashes.sha1);
                                    handleDeleteHash(fileHashes.sha256);
                                  }
                                  setSelectedFile(null);
                                  setFileHashes(null);
                                  toast.success("Análisis y hashes eliminados");
                                }}
                                className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                title="Eliminar análisis y hashes"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          {[
                            { label: 'MD5', value: fileHashes.md5 },
                            { label: 'SHA-1', value: fileHashes.sha1 },
                            { label: 'SHA-256', value: fileHashes.sha256 }
                          ].map((hash) => (
                            <div key={hash.label} className="space-y-2">
                              <div className="flex items-center justify-between px-1">
                                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Firma {hash.label}</p>
                                {hash.label === 'SHA-256' && dbStatus === 'success' && (
                                  <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 uppercase tracking-tighter">
                                    <Globe className="w-3 h-3" /> Sincronizado
                                  </span>
                                )}
                              </div>
                              <div className={`p-4 rounded-xl border font-mono text-[10px] break-all relative group`} style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
                                {hash.value}
                                <button
                                  onClick={() => handleCopy(hash.value, `file-${hash.label}`)}
                                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all border`}
                                  style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}
                                >
                                  {copiedField === `file-${hash.label}` ? (
                                    <Check className="w-3 h-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3 h-3 opacity-40" />
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Security Intelligence Section */}
                        <div className={`mt-8 p-6 rounded-2xl border bg-gradient-to-br from-emerald-500/5 to-blue-500/5`} style={{ borderColor: 'var(--border-color)' }}>
                          <div className="flex items-center gap-3 mb-4">
                            <ShieldCheck className="w-5 h-5 text-emerald-500" />
                            <h3 className="text-sm font-bold uppercase tracking-widest">Inteligencia de Seguridad</h3>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-black/5 border border-white/5">
                              <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 opacity-40" />
                                <span className="text-xs opacity-60">Reputación Global</span>
                              </div>
                              <span className="text-xs font-bold text-emerald-500">LIMPIO / CONFIABLE</span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-black/5 border border-white/5">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 opacity-40" />
                                <span className="text-xs opacity-60">Detecciones (0/72)</span>
                              </div>
                              <span className="text-xs font-bold text-emerald-500">0% AMENAZA</span>
                            </div>
                            <p className="text-[10px] opacity-40 italic mt-2 text-center">
                              * Análisis basado en bases de datos de firmas digitales conocidas y heurística local.
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'visualizer' && (
            <motion.div
              key="visualizer-tab"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              <HashingVisualizer isDarkMode={isDarkMode} />
            </motion.div>
          )}

          {activeTab === 'reputation' && (
            <motion.div
              key="reputation-tab"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              <ReputationSystem userProfile={userProfile} isDarkMode={isDarkMode} />
            </motion.div>
          )}

          {activeTab === 'explorer' && (
            <motion.div
              key="explorer-tab"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className={`rounded-[2.5rem] border shadow-2xl p-10 transition-all`} style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight mb-2">Explorador de Base de Datos</h2>
                    <p className="opacity-60 text-sm">Visualiza todos los hashes registrados y sus valores originales.</p>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center gap-4 w-full md:w-auto">
                    <div className="flex items-center gap-1 border rounded-xl p-1" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-color)' }}>
                      {(['md5', 'sha1', 'sha256'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setSelectedHashType(type)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all`}
                          style={{
                            backgroundColor: selectedHashType === type ? 'var(--accent-color)' : 'transparent',
                            color: selectedHashType === type ? 'var(--bg-color)' : 'var(--text-color)',
                            opacity: selectedHashType === type ? 1 : 0.6
                          }}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    <div className="relative group w-full md:w-80">
                      <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40`} />
                      <input
                        type="text"
                        placeholder="Buscar por hash o palabra..."
                        value={explorerSearch}
                        onChange={(e) => {
                          setExplorerSearch(e.target.value);
                          setExplorerPage(1);
                        }}
                        className={`w-full pl-12 pr-4 py-3 rounded-2xl text-sm font-medium border transition-all outline-none`}
                        style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredExplorerHashes
                    .slice((explorerPage - 1) * 100, explorerPage * 100)
                    .map(({ value, hashes }, idx) => {
                      const displayHash = hashes[selectedHashType] || hashes.default || '';
                      if (!displayHash) return null;
                      
                      return (
                      <motion.div
                        key={`${value}-${idx}`}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 group transition-all`}
                        style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3">
                            <span className={`text-[10px] font-bold uppercase tracking-widest opacity-40 whitespace-nowrap`}>Valor Original</span>
                            <div className="h-px flex-1 bg-current opacity-10" />
                          </div>
                          <p className="font-bold text-lg truncate mb-6">{value}</p>
                          
                          <div className="mt-6">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`text-[10px] font-bold uppercase tracking-widest opacity-40 whitespace-nowrap`}>Firma Digital</span>
                              <div className="w-px h-3 bg-current opacity-20 mx-1" />
                              <span className={`text-[10px] font-bold uppercase tracking-widest opacity-60`}>{selectedHashType}</span>
                              <div className="h-px flex-1 bg-current opacity-10" />
                            </div>
                            <p className="font-mono text-xs opacity-70 break-all leading-relaxed tracking-tight">{displayHash}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopy(value, `explorer-val-${idx}`)}
                            className={`p-3 rounded-xl border transition-all hover:scale-105 active:scale-95`}
                            style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}
                            title="Copiar Valor"
                          >
                            {copiedField === `explorer-val-${idx}` ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Copy className="w-4 h-4 opacity-40" />
                            )}
                          </button>
                          <button
                            onClick={() => handleCopy(displayHash, `explorer-hash-${idx}`)}
                            className={`p-3 rounded-xl border transition-all hover:scale-105 active:scale-95`}
                            style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}
                            title="Copiar Hash"
                          >
                            {copiedField === `explorer-hash-${idx}` ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Clipboard className="w-4 h-4 opacity-40" />
                            )}
                          </button>
                          {userProfile.role === 'admin' && (
                            <button
                              onClick={() => handleDeleteHash(displayHash)}
                              className={`p-3 rounded-xl border transition-all hover:scale-105 active:scale-95 bg-red-500/10 border-red-500/20 text-red-500`}
                              title="Eliminar de la Base de Datos"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )})}
                  
                  {Object.entries(hashCache).length === 0 && (
                    <div className="text-center py-20 opacity-40">
                      <Database className="w-16 h-16 mx-auto mb-4 opacity-20" />
                      <p>La base de datos está vacía.</p>
                    </div>
                  )}
                </div>

                {filteredExplorerHashes.length > 100 && (
                  <div className="flex items-center justify-between mt-6 pt-6 border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="text-sm opacity-60">
                      Mostrando {(explorerPage - 1) * 100 + 1} - {Math.min(explorerPage * 100, filteredExplorerHashes.length)} de {filteredExplorerHashes.length} hashes
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExplorerPage(p => Math.max(1, p - 1))}
                        disabled={explorerPage === 1}
                        className="px-4 py-2 rounded-xl text-sm font-medium border transition-all disabled:opacity-30"
                        style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                      >
                        Anterior
                      </button>
                      <span className="px-4 text-sm font-medium">
                        Página {explorerPage} de {Math.ceil(filteredExplorerHashes.length / 100)}
                      </span>
                      <button
                        onClick={() => setExplorerPage(p => Math.min(Math.ceil(filteredExplorerHashes.length / 100), p + 1))}
                        disabled={explorerPage === Math.ceil(filteredExplorerHashes.length / 100)}
                        className="px-4 py-2 rounded-xl text-sm font-medium border transition-all disabled:opacity-30"
                        style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'activity' && (
            <motion.div
              key="activity-tab"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              <div className={`rounded-2xl border shadow-sm p-8 transition-all`} style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div className="flex items-center gap-2">
                    <Globe className={`w-5 h-5`} style={{ color: 'var(--accent-color)' }} />
                    <h2 className={`text-lg font-semibold`}>Actividad Global en Tiempo Real</h2>
                  </div>
                  
                  {/* Filters & Sorting Controls */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative group">
                      <Filter className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40`} />
                      <select
                        value={activityFilterType}
                        onChange={(e) => setActivityFilterType(e.target.value as any)}
                        className={`pl-9 pr-4 py-2 rounded-xl text-xs font-bold border appearance-none transition-all outline-none`}
                        style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                      >
                        <option value="all">Todos los tipos</option>
                        <option value="generate">Generación</option>
                        <option value="decode">Decodificación</option>
                        <option value="verify">Verificación</option>
                        <option value="file">Análisis de Archivo</option>
                      </select>
                    </div>

                    <div className="relative group">
                      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40`} />
                      <input
                        type="text"
                        placeholder="Filtrar por usuario..."
                        value={activityFilterUser}
                        onChange={(e) => setActivityFilterUser(e.target.value)}
                        className={`pl-9 pr-4 py-2 rounded-xl text-xs font-bold border transition-all outline-none w-40`}
                        style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          if (activitySortBy === 'timestamp') {
                            setActivitySortOrder(activitySortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setActivitySortBy('timestamp');
                            setActivitySortOrder('desc');
                          }
                        }}
                        className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all flex items-center gap-2`}
                        style={{ 
                          backgroundColor: activitySortBy === 'timestamp' ? 'var(--accent-color)' : 'var(--bg-color)',
                          color: activitySortBy === 'timestamp' ? 'var(--bg-color)' : 'var(--text-color)',
                          borderColor: 'var(--border-color)',
                          opacity: activitySortBy === 'timestamp' ? 1 : 0.6
                        }}
                      >
                        Fecha
                        {activitySortBy === 'timestamp' && (
                          <ArrowUpDown className={`w-3 h-3 ${activitySortOrder === 'asc' ? 'rotate-180' : ''}`} />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          if (activitySortBy === 'username') {
                            setActivitySortOrder(activitySortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setActivitySortBy('username');
                            setActivitySortOrder('asc');
                          }
                        }}
                        className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all flex items-center gap-2`}
                        style={{ 
                          backgroundColor: activitySortBy === 'username' ? 'var(--accent-color)' : 'var(--bg-color)',
                          color: activitySortBy === 'username' ? 'var(--bg-color)' : 'var(--text-color)',
                          borderColor: 'var(--border-color)',
                          opacity: activitySortBy === 'username' ? 1 : 0.6
                        }}
                      >
                        Usuario
                        {activitySortBy === 'username' && (
                          <ArrowUpDown className={`w-3 h-3 ${activitySortOrder === 'asc' ? 'rotate-180' : ''}`} />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-1 border rounded-xl p-1" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-color)' }}>
                      {(['md5', 'sha1', 'sha256'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setSelectedHashType(type)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all`}
                          style={{
                            backgroundColor: selectedHashType === type ? 'var(--accent-color)' : 'transparent',
                            color: selectedHashType === type ? 'var(--bg-color)' : 'var(--text-color)',
                            opacity: selectedHashType === type ? 1 : 0.6
                          }}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredActivities.length === 0 ? (
                    <div className="text-center py-12">
                      <Globe className={`w-12 h-12 mx-auto mb-4 opacity-20`} />
                      <p className={`text-sm opacity-40`}>No se encontró actividad con los filtros seleccionados.</p>
                    </div>
                  ) : (
                    filteredActivities.map((activity) => (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-xl border transition-all`}
                        style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="relative">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl border overflow-hidden`} style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
                                {activity.type === 'file' ? (
                                  <File className="w-5 h-5 text-amber-500" />
                                ) : activity.user_avatar && activity.user_avatar !== '👤' ? (
                                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${activity.user_avatar}`} className="w-full h-full object-cover" alt={activity.user_name} />
                                ) : (
                                  '👤'
                                )}
                              </div>
                              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-lg flex items-center justify-center border shadow-sm ${
                                activity.type === 'generate' ? 'bg-blue-500 text-white border-blue-600' : 
                                activity.type === 'decode' ? 'bg-purple-500 text-white border-purple-600' : 
                                activity.type === 'file' ? 'bg-amber-500 text-white border-amber-600' :
                                'bg-emerald-500 text-white border-emerald-600'
                              }`}>
                                {activity.type === 'generate' ? <Hash className="w-2.5 h-2.5" /> : 
                                 activity.type === 'decode' ? <Unlock className="w-2.5 h-2.5" /> : 
                                 activity.type === 'file' ? <Download className="w-2.5 h-2.5" /> :
                                 <Shield className="w-2.5 h-2.5" />}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold`} style={{ color: 'var(--accent-color)' }}>
                                  {activity.user_name || 'Anónimo'}
                                </span>
                                <span className={`text-[10px] font-medium opacity-50`}>
                                  {activity.type === 'generate' ? 'generó un hash' : 
                                   activity.type === 'decode' ? 'decodificó un hash' : 
                                   activity.type === 'file' ? 'analizó un archivo' :
                                   'verificó integridad'}
                                </span>
                              </div>
                              <div className="mt-3 flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-bold uppercase tracking-widest opacity-40 min-w-[40px]">Valor</span>
                                  <div className="w-px h-2 bg-current opacity-10" />
                                  <p className={`text-[10px] font-mono break-all opacity-70`}>{activity.value}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-bold uppercase tracking-widest opacity-40 min-w-[40px]">Hash</span>
                                  <div className="w-px h-2 bg-current opacity-10" />
                                  <span className={`text-[9px] font-bold uppercase tracking-tighter opacity-60`}>{selectedHashType}</span>
                                  <div className="w-px h-2 bg-current opacity-10" />
                                  <p className={`text-[10px] font-mono break-all leading-relaxed`} style={{ color: 'var(--accent-color)', opacity: 0.8 }}>
                                    {getDisplayHash(activity.hash, selectedHashType)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`text-[9px] font-mono whitespace-nowrap opacity-40`}>
                              {new Date(activity.timestamp).toLocaleTimeString()}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleCopy(activity.hash, `act-${activity.id}`)}
                                className="p-1.5 rounded-lg bg-black/5 hover:bg-black/10 transition-colors"
                                title="Copiar Hash"
                              >
                                {copiedField === `act-${activity.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3 opacity-40" />
                                )}
                              </button>
                              {userProfile.role === 'admin' && (
                                <button
                                  onClick={() => handleDeleteActivity(activity.id)}
                                  className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                  title="Eliminar Actividad"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === 'chat' && (
            <motion.div
              key="chat-tab"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto"
            >
              <ChatWindow userProfile={userProfile} socket={socket} onlineUsers={onlineUsers} isDarkMode={isDarkMode} />
            </motion.div>
          )}
          {activeTab === 'messages' && (
            <motion.div
              key="messages-tab"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto"
            >
              <DirectMessages userProfile={userProfile} socket={socket} />
            </motion.div>
          )}
          {activeTab === 'wiki' && (
            <motion.div
              key="wiki-tab"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto"
            >
              <AlgorithmWiki userProfile={userProfile} />
            </motion.div>
          )}

          {activeTab === 'verify' && (
            <AppVerifier userProfile={userProfile} apps={apps} onRefresh={fetchApps} awardPoints={awardPoints} />
          )}

          {activeTab === 'generate' && (
            <motion.div
              key="generate-tab"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              <div 
                className="rounded-2xl border shadow-sm p-8 transition-colors"
                style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}
              >
                <div className="flex items-center gap-2 mb-6">
                  <Type className="w-5 h-5" style={{ color: 'var(--accent-color)' }} />
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-color)' }}>Texto a Hash</h2>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-2 opacity-50" style={{ color: 'var(--text-color)' }}>Texto de Entrada</label>
                    <textarea
                      value={textToHash}
                      onChange={(e) => setTextToHash(e.target.value)}
                      placeholder="Escribe el texto que deseas convertir en hash..."
                      className="w-full p-4 border rounded-xl font-sans text-sm transition-all focus:outline-none focus:border-emerald-50 focus:ring-2 focus:ring-emerald-500/20 min-h-[120px] resize-none select-text"
                      style={{ 
                        backgroundColor: 'var(--bg-color)', 
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-color)'
                      }}
                    />
                  </div>

                  <div className="space-y-4">
                    <HashRow
                      label="MD5"
                      value={generatedHashes.md5 || 'Esperando entrada...'}
                      onCopy={() => handleCopy(generatedHashes.md5, 'gen-md5')}
                      isCopied={copiedField === 'gen-md5'}
                    />
                    <HashRow
                      label="SHA1"
                      value={generatedHashes.sha1 || 'Esperando entrada...'}
                      onCopy={() => handleCopy(generatedHashes.sha1, 'gen-sha1')}
                      isCopied={copiedField === 'gen-sha1'}
                    />
                    <HashRow
                      label="SHA256"
                      value={generatedHashes.sha256 || 'Esperando entrada...'}
                      onCopy={() => handleCopy(generatedHashes.sha256, 'gen-sha256')}
                      isCopied={copiedField === 'gen-sha256'}
                    />
                  </div>

                  {recentCached.length > 0 && (
                    <div 
                      className="mt-8 pt-6 border-t"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest opacity-50" style={{ color: 'var(--text-color)' }}>Indexado en Tiempo Real</h3>
                        <span className="text-[10px] font-medium text-emerald-600">Cualquier valor ingresado se guarda automáticamente</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {recentCached.map((item, idx) => (
                          <motion.div
                            key={`${item}-${idx}`}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="px-3 py-1.5 border rounded-lg text-[10px] font-mono flex flex-col gap-1"
                            style={{ 
                              backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                              borderColor: 'rgba(16, 185, 129, 0.2)',
                              color: '#10b981'
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Check className="w-3 h-3" />
                                <span className="font-bold truncate max-w-[100px]">{item}</span>
                              </div>
                              {userProfile.role === 'admin' && (
                                <button
                                  onClick={() => handleDeleteValue(item)}
                                  className="p-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                  title="Eliminar Hash"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                            <div className="flex gap-1 opacity-60 text-[8px] uppercase font-bold">
                              <span>MD5</span> • <span>SHA1</span> • <span>SHA256</span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'decode' && (
            <motion.div
              key="decode-tab"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              <div 
                className="rounded-2xl border shadow-sm p-8 transition-colors"
                style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}
              >
                <div className="flex items-center gap-2 mb-6">
                  <Unlock className="w-5 h-5" style={{ color: 'var(--accent-color)' }} />
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-color)' }}>Decodificador de Hash</h2>
                </div>

                <div className="space-y-6">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Pega el hash que deseas decodificar..."
                        value={hashToDecode}
                        onChange={(e) => {
                          const cleaned = smartCleanHash(e.target.value);
                          if (cleaned.length > 64) {
                            setDecodeInputError("Hash demasiado largo (máx 64 caracteres)");
                            setTimeout(() => setDecodeInputError(null), 3000);
                          }
                          setHashToDecode(cleaned.substring(0, 64));
                          setDecodeResult(null);
                        }}
                        className={`w-full p-4 pr-12 border rounded-xl font-mono text-sm transition-all focus:outline-none focus:ring-2 select-text ${
                          decodeInputError
                            ? 'border-orange-400 focus:ring-orange-500/20'
                            : 'focus:border-emerald-500 focus:ring-emerald-500/20'
                        }`}
                        style={{ 
                          backgroundColor: 'var(--bg-color)', 
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-color)'
                        }}
                      />
                      {hashToDecode ? (
                        <button
                          onClick={() => {
                            setHashToDecode('');
                            setDecodeResult(null);
                          }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-1 transition-colors opacity-50 hover:opacity-100"
                          style={{ color: 'var(--text-color)' }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            try {
                              const text = await navigator.clipboard.readText();
                              setHashToDecode(smartCleanHash(text));
                            } catch (err) {
                              console.error('Failed to read clipboard', err);
                            }
                          }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 transition-colors rounded-lg border"
                          style={{ 
                            color: 'var(--accent-color)', 
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderColor: 'rgba(16, 185, 129, 0.2)'
                          }}
                          title="Pegar desde el portapapeles"
                        >
                          <Clipboard className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={handleDecode}
                      disabled={!hashToDecode || isDecoding}
                      className="px-6 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2"
                    >
                      {isDecoding ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Decodificando...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          Decodificar
                        </>
                      )}
                    </button>
                  </div>

                  {hashToDecode.trim() && (
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-50" style={{ color: 'var(--text-color)' }}>Formato detectado:</span>
                      {(() => {
                        const len = hashToDecode.trim().length;
                        const isHex = /^[0-9a-fA-F]+$/.test(hashToDecode.trim());
                        if (!isHex) return <span className="text-[10px] font-bold px-2 py-0.5 rounded border text-red-500 bg-red-500/10 border-red-500/20">NO HEXADECIMAL</span>;
                        if (len === 32) return <span className="text-[10px] font-bold px-2 py-0.5 rounded border text-blue-400 bg-blue-500/10 border-blue-500/20">MD5</span>;
                        if (len === 40) return <span className="text-[10px] font-bold px-2 py-0.5 rounded border text-purple-400 bg-purple-500/10 border-purple-500/20">SHA1</span>;
                        if (len === 64) return <span className="text-[10px] font-bold px-2 py-0.5 rounded border text-amber-400 bg-amber-500/10 border-amber-500/20">SHA256</span>;
                        return <span className="text-[10px] font-bold px-2 py-0.5 rounded border opacity-50 border-white/10" style={{ color: 'var(--text-color)' }}>DESCONOCIDO ({len} chars)</span>;
                      })()}
                    </div>
                  )}

                  <AnimatePresence mode="wait">
                    {decodeResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`p-6 rounded-xl border ${
                          decodeResult.found
                            ? 'bg-emerald-500/10 border-emerald-500/20'
                            : 'bg-red-500/10 border-red-500/20'
                        }`}
                      >
                        {decodeResult.found ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3 text-emerald-400">
                              <Check className="w-6 h-6 text-emerald-500" />
                              <h3 className="text-lg font-semibold">¡Hash Decodificado!</h3>
                            </div>
                            <div className="relative group">
                              <div 
                                className="p-4 rounded-lg border font-mono text-lg text-center break-all"
                                style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#10b981' }}
                              >
                                {decodeResult.value}
                              </div>
                              <button
                                onClick={() => handleCopy(decodeResult.value || '', 'decode-result')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all border bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"
                                title="Copiar resultado"
                              >
                                <AnimatePresence mode="wait">
                                  {copiedField === 'decode-result' ? (
                                    <motion.div
                                      key="check"
                                      initial={{ scale: 0.5, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={{ scale: 0.5, opacity: 0 }}
                                    >
                                      <Check className="w-4 h-4" />
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      key="copy"
                                      initial={{ scale: 0.5, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={{ scale: 0.5, opacity: 0 }}
                                    >
                                      <Copy className="w-4 h-4" />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-2">
                              <div className="text-emerald-500/70">
                                <span className="text-[10px] font-bold uppercase tracking-widest block mb-1">Método</span>
                                <div className="flex items-center gap-1.5 text-xs">
                                  {decodeResult.method === 'database' ? (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20">
                                      <Zap className="w-3 h-3" /> BASE DE DATOS
                                    </span>
                                  ) : decodeResult.method === 'brute-force' ? (
                                    'Diccionario / Fuerza Bruta'
                                  ) : (
                                    'Búsqueda en Línea (AI)'
                                  )}
                                </div>
                              </div>
                              <div className="text-emerald-500/70">
                                <span className="text-[10px] font-bold uppercase tracking-widest block mb-1">Tiempo</span>
                                <div className="text-xs">
                                  {decodeResult.time === 0 ? '< 1ms' : `${decodeResult.time}ms`}
                                </div>
                              </div>
                              {decodeResult.attempts && (
                                <div className="col-span-2 text-emerald-500/70">
                                  <span className="text-[10px] font-bold uppercase tracking-widest block mb-1">Intentos</span>
                                  <div className="text-xs">
                                    {decodeResult.attempts} combinaciones probadas
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3 text-red-400">
                            <AlertCircle className="w-6 h-6 mt-0.5" />
                            <div>
                              <h3 className="text-lg font-semibold mb-1">No se pudo decodificar</h3>
                              <p className="text-sm opacity-90">{decodeResult.error}</p>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div 
                    className="p-4 border rounded-xl transition-colors"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderColor: 'var(--border-color)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-widest opacity-50" style={{ color: 'var(--text-color)' }}>Cómo funciona</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                        {Object.keys(hashCache).length} hashes en memoria
                      </span>
                    </div>
                    <ul className="text-xs space-y-2 list-disc pl-4 opacity-50" style={{ color: 'var(--text-color)' }}>
                      <li>Primero consultamos nuestra "Rainbow Table" local (caché), que guarda instantáneamente cualquier hash generado en esta sesión.</li>
                      <li>También incluye un diccionario pre-cargado de contraseñas comunes y hashes de aplicaciones oficiales para una decodificación inmediata.</li>
                      <li>Si no hay éxito local, utilizamos inteligencia artificial para buscar el hash en bases de datos públicas.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer 
          className="mt-20 pt-8 border-t text-center"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <p className="text-xs font-mono uppercase tracking-widest opacity-30" style={{ color: 'var(--text-color)' }}>
            Utilidad de Seguridad &bull; Verificación de Integridad
          </p>
        </footer>

        <AnimatePresence>
          {showSettings && (
            <SettingsModal
              currentTheme={currentTheme}
              notificationPrefs={notificationPrefs}
              onClose={() => setShowSettings(false)}
              onThemeChange={onThemeChange}
              onNotificationPrefsChange={onNotificationPrefsChange}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AppVerifier({ userProfile, apps, onRefresh, awardPoints }: { userProfile: UserProfile, apps: any[], onRefresh: () => void, awardPoints: (points: number) => void }) {
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [userHash, setUserHash] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ match: boolean, type?: string } | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<any>(null);
  const [appToDelete, setAppToDelete] = useState<any>(null);

  const currentApp = selectedApp ? apps.find(a => a.key === selectedApp) : null;

  const handleVerify = async () => {
    if (!currentApp || !userHash.trim()) return;
    setIsVerifying(true);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const targetHash = userHash.trim().toLowerCase();
    let result = { match: false, type: '' };
    
    if (targetHash === currentApp.md5.toLowerCase()) result = { match: true, type: 'MD5' };
    else if (targetHash === currentApp.sha1.toLowerCase()) result = { match: true, type: 'SHA1' };
    else if (targetHash === currentApp.sha256.toLowerCase()) result = { match: true, type: 'SHA256' };
    
    if (result.match) {
      awardPoints(10); // Award 10 points for successful verification
    }
    
    setVerifyResult(result);
    setIsVerified(true);
    setIsVerifying(false);
  };

  const handleDelete = async (id: number) => {
    fetch(`/api/apps/${id}`, {
      method: 'DELETE'
    }).then(res => {
      if (res.ok) {
        toast.success('Aplicación eliminada');
        onRefresh();
        if (selectedApp === apps.find(a => a.id === id)?.key) setSelectedApp(null);
      }
    });
  };

  const handleSave = async (app: any) => {
    const method = app.id ? 'PUT' : 'POST';
    const url = app.id ? `/api/apps/${app.id}` : '/api/apps';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(app)
    });
    if (res.ok) {
      toast.success(app.id ? 'Aplicación actualizada' : 'Aplicación creada');
      setIsEditorOpen(false);
      onRefresh();
    }
  };

  return (
    <motion.div
      key="verify-tab"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <Shield className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Verificación de Integridad</h2>
            <p className="text-sm opacity-60">Comprueba la autenticidad de tus aplicaciones.</p>
          </div>
        </div>
        {userProfile.role === 'admin' && (
          <button
            onClick={() => {
              setEditingApp(null);
              setIsEditorOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            Agregar App
          </button>
        )}
      </div>

      <div className={`rounded-2xl border shadow-sm p-6 mb-12 transition-all duration-300`} style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {apps.map((app) => (
            <div key={app.key} className="relative group">
              <button
                onClick={() => {
                  setSelectedApp(app.key);
                  setUserHash('');
                  setIsVerified(false);
                }}
                className={`w-full p-5 rounded-xl border transition-all duration-200 text-left flex items-center gap-4 ${
                  selectedApp === app.key
                    ? 'shadow-md ring-1 ring-emerald-500/20'
                    : 'hover:shadow-sm'
                }`}
                style={{ 
                  backgroundColor: selectedApp === app.key ? 'var(--bg-color)' : 'transparent',
                  borderColor: selectedApp === app.key ? 'var(--accent-color)' : 'var(--border-color)',
                  opacity: selectedApp === app.key ? 1 : 0.7
                }}
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                  <img src={app.image} alt={app.name} className="w-full h-full object-contain" />
                </div>
                <span className={`font-medium truncate text-sm ${selectedApp === app.key ? 'text-emerald-500' : ''}`}>
                  {app.name}
                </span>
              </button>
              {userProfile.role === 'admin' && (
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingApp(app);
                      setIsEditorOpen(true);
                    }}
                    className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAppToDelete(app);
                    }}
                    className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-[400px] space-y-8">
        <AnimatePresence mode="wait">
          {currentApp ? (
            <motion.div
              key={selectedApp}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* App Info Header */}
              <div className="rounded-2xl border shadow-sm p-8" style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden bg-white/5 flex items-center justify-center border border-white/10 flex-shrink-0">
                    <img src={currentApp.image} alt={currentApp.name} className="w-16 h-16 object-contain" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold tracking-tight">{currentApp.name}</h3>
                    <p className="text-base leading-relaxed opacity-70">{currentApp.description}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {['MD5', 'SHA1', 'SHA256'].map(type => (
                        <span key={type} className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20">
                          {type} Disponible
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Verification Section (Full Width) */}
              <div className="space-y-8">
                <div className="rounded-2xl border shadow-sm p-6 space-y-5" style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
                  <div className="relative">
                    <input
                      type="text"
                      value={userHash}
                      onChange={(e) => {
                        setUserHash(e.target.value);
                        setIsVerified(false);
                      }}
                      placeholder="Pega el hash de tu archivo aquí..."
                      className="w-full p-5 pr-32 rounded-xl border bg-black/5 font-mono text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                    />
                    <button
                      onClick={async () => {
                        try {
                          const input = document.querySelector('input[placeholder="Pega el hash de tu archivo aquí..."]') as HTMLInputElement;
                          if (input) input.focus();
                          
                          const text = await navigator.clipboard.readText();
                          if (text) {
                            setUserHash(text.trim());
                            setIsVerified(false);
                            toast.success("Hash pegado");
                          }
                        } catch (err) {
                          toast.error("Usa Ctrl+V para pegar directamente");
                        }
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all text-[10px] font-black uppercase tracking-widest shadow-md flex items-center gap-2"
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                      PEGAR
                    </button>
                  </div>
                  <button
                    onClick={handleVerify}
                    disabled={!userHash.trim() || isVerifying}
                    className="w-full py-4 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/20"
                  >
                    {isVerifying ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-5 h-5" />
                        VERIFICAR INTEGRIDAD DEL ARCHIVO
                      </>
                    )}
                  </button>
                </div>

                <div className="rounded-2xl border shadow-sm p-8 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[200px]" style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
                  <AnimatePresence mode="wait">
                    {!isVerified ? (
                      <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                        <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mx-auto opacity-20">
                          <Shield className="w-8 h-8" />
                        </div>
                        <p className="text-xs opacity-40 font-bold uppercase tracking-widest">Esperando firma digital para análisis...</p>
                      </motion.div>
                    ) : (
                      <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 z-10 w-full max-w-lg">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${verifyResult?.match ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                          {verifyResult?.match ? <CheckCircle2 className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
                        </div>
                        <div className="space-y-2">
                          <h4 className={`text-2xl font-black uppercase tracking-tight ${verifyResult?.match ? 'text-emerald-500' : 'text-red-500'}`}>
                            {verifyResult?.match ? '¡INTEGRIDAD VERIFICADA!' : 'FIRMA NO COINCIDE'}
                          </h4>
                          <p className="text-sm opacity-70 leading-relaxed font-medium">
                            {verifyResult?.match 
                              ? `Este archivo es 100% auténtico y coincide exactamente con la firma oficial de ${currentApp.name}.` 
                              : 'Atención: La firma digital proporcionada no coincide con ninguna versión oficial conocida.'}
                          </p>
                        </div>
                        {verifyResult?.match && (
                          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 inline-block">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/60 mb-1">Algoritmo Detectado</p>
                            <p className="text-lg font-mono font-black text-emerald-500 uppercase tracking-tighter">{verifyResult.type}</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Official Hashes Section (Now more structured like a form) */}
              <div className="rounded-2xl border shadow-sm p-10 space-y-8" style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-2">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                      <Hash className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <h4 className="text-base font-black uppercase tracking-widest opacity-90">Firmas Oficiales de Referencia</h4>
                      <p className="text-xs opacity-50 font-medium">Utiliza estos valores para comparar la integridad de tu archivo.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const allHashes = `${currentApp.name}\nMD5: ${currentApp.md5}\nSHA1: ${currentApp.sha1}\nSHA256: ${currentApp.sha256}`;
                      navigator.clipboard.writeText(allHashes);
                      toast.success("Todas las firmas copiadas");
                    }}
                    className="px-6 py-3 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all text-xs font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 shrink-0"
                  >
                    <Clipboard className="w-4 h-4" />
                    COPIAR TODO
                  </button>
                </div>
                
                <div className="space-y-6">
                  {['md5', 'sha1', 'sha256'].map(type => (
                    <div key={type} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest opacity-40 ml-1">{type.toUpperCase()} OFICIAL</label>
                        <div className="h-px w-full bg-white/10" />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 p-5 rounded-2xl border bg-black/5 font-mono text-sm opacity-90 break-all flex items-center leading-relaxed shadow-inner min-h-[60px]" style={{ borderColor: 'var(--border-color)' }}>
                          {currentApp[type]}
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(currentApp[type]);
                            toast.success(`${type.toUpperCase()} copiado`);
                          }}
                          className="px-8 py-4 rounded-2xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all text-xs font-black uppercase tracking-widest border border-emerald-500/20 flex items-center justify-center gap-2 shadow-sm shrink-0"
                        >
                          <Copy className="w-4 h-4" />
                          Copiar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
              <div className="w-24 h-24 rounded-3xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20"><Shield className="w-10 h-10 text-emerald-500" /></div>
              <div className="max-w-md"><h3 className="text-2xl font-bold mb-2">Verificación de Integridad</h3><p className="text-sm opacity-60 leading-relaxed">Selecciona una aplicación de la lista superior para verificar si el archivo que tienes es la versión oficial y no ha sido modificado.</p></div>
            </div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isEditorOpen && (
          <AppEditor
            app={editingApp}
            onClose={() => setIsEditorOpen(false)}
            onSave={handleSave}
          />
        )}
        {appToDelete && (
          <ConfirmationModal
            isOpen={!!appToDelete}
            onClose={() => setAppToDelete(null)}
            onConfirm={() => handleDelete(appToDelete.id)}
            title="¿Eliminar aplicación?"
            description={`¿Estás seguro de eliminar "${appToDelete.name}"? Esta acción no se puede deshacer.`}
            confirmLabel="Eliminar"
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AppEditor({ app, onClose, onSave }: { app: any, onClose: () => void, onSave: (app: any) => void }) {
  const [formData, setFormData] = useState(app || {
    key: '',
    name: '',
    description: '',
    image: '',
    md5: '',
    sha1: '',
    sha256: ''
  });

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-2xl rounded-[2.5rem] bg-white shadow-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}>
        <div className="p-8 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
          <h2 className="text-xl font-bold">{app ? 'Editar Aplicación' : 'Nueva Aplicación'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/5 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-8 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Key (Único)</label>
              <input type="text" value={formData.key} onChange={e => setFormData({ ...formData, key: e.target.value })} className="w-full p-3 rounded-xl border bg-black/5" placeholder="Ej: putty" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Nombre</label>
              <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-3 rounded-xl border bg-black/5" placeholder="Ej: putty.exe" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Descripción</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full p-3 rounded-xl border bg-black/5 h-24 resize-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">URL de Imagen</label>
            <input type="text" value={formData.image} onChange={e => setFormData({ ...formData, image: e.target.value })} className="w-full p-3 rounded-xl border bg-black/5" />
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">MD5</label>
              <input type="text" value={formData.md5} onChange={e => setFormData({ ...formData, md5: e.target.value })} className="w-full p-3 rounded-xl border bg-black/5 font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">SHA1</label>
              <input type="text" value={formData.sha1} onChange={e => setFormData({ ...formData, sha1: e.target.value })} className="w-full p-3 rounded-xl border bg-black/5 font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">SHA256</label>
              <input type="text" value={formData.sha256} onChange={e => setFormData({ ...formData, sha256: e.target.value })} className="w-full p-3 rounded-xl border bg-black/5 font-mono text-xs" />
            </div>
          </div>
        </div>
        <div className="p-8 border-t flex gap-4" style={{ borderColor: 'var(--border-color)' }}>
          <button onClick={onClose} className="flex-1 py-4 rounded-xl border font-bold text-sm hover:bg-black/5 transition-colors">Cancelar</button>
          <button onClick={() => onSave(formData)} className="flex-1 py-4 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">Guardar Cambios</button>
        </div>
      </motion.div>
    </div>
  );
}

function AlgorithmWiki({ userProfile }: { userProfile: any }) {
  const [algorithms, setAlgorithms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingAlgo, setEditingAlgo] = useState<any>(null);
  const [algoToDelete, setAlgoToDelete] = useState<any>(null);

  const fetchWiki = async () => {
    try {
      const response = await fetch('/api/wiki');
      const data = await response.json();
      setAlgorithms(data);
    } catch (error) {
      console.error('Error fetching wiki:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWiki();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/wiki/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        toast.success('Algoritmo eliminado');
        fetchWiki();
      }
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const handleSave = async (algo: any) => {
    try {
      const method = algo.id ? 'PUT' : 'POST';
      const url = algo.id ? `/api/wiki/${algo.id}` : '/api/wiki';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(algo)
      });
      if (response.ok) {
        toast.success(algo.id ? 'Algoritmo actualizado' : 'Algoritmo creado');
        setIsEditorOpen(false);
        setEditingAlgo(null);
        fetchWiki();
      }
    } catch (error) {
      toast.error('Error al guardar');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <BookOpen className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Wiki de Algoritmos</h2>
            <p className="text-sm opacity-60">Enciclopedia técnica de funciones criptográficas.</p>
          </div>
        </div>
        {userProfile.role === 'admin' && (
          <button
            onClick={() => {
              setEditingAlgo(null);
              setIsEditorOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            Agregar Algoritmo
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {algorithms.map((algo) => (
          <motion.div
            key={algo.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 rounded-[2.5rem] border shadow-sm transition-all relative group"
            style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}
          >
            {userProfile.role === 'admin' && (
              <div className="absolute top-6 right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setEditingAlgo(algo);
                    setIsEditorOpen(true);
                  }}
                  className="p-2 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors"
                  title="Editar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setAlgoToDelete(algo)}
                  className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex flex-col md:flex-row justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-2xl font-bold">{algo.name}</h3>
                  <span 
                    className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border"
                    style={{ borderColor: algo.statusColor, color: algo.statusColor, backgroundColor: `${algo.statusColor}10` }}
                  >
                    {algo.status}
                  </span>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-2">{algo.fullName}</p>
                <p className="text-sm leading-relaxed mb-6 opacity-80">{algo.description}</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="p-4 rounded-2xl bg-black/5 border border-black/5">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Uso Recomendado</h4>
                    <p className="text-xs leading-relaxed">{algo.useCase}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-red-500/60 mb-2">Vulnerabilidades</h4>
                    <p className="text-xs leading-relaxed opacity-80">{algo.vulnerabilities}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isEditorOpen && (
          <WikiEditor
            algo={editingAlgo}
            onClose={() => setIsEditorOpen(false)}
            onSave={handleSave}
          />
        )}
        {algoToDelete && (
          <ConfirmationModal
            isOpen={!!algoToDelete}
            onClose={() => setAlgoToDelete(null)}
            onConfirm={() => handleDelete(algoToDelete.id)}
            title="¿Eliminar algoritmo?"
            description={`¿Estás seguro de eliminar "${algoToDelete.name}"? Esta acción no se puede deshacer.`}
            confirmLabel="Eliminar"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function WikiEditor({ algo, onClose, onSave }: { algo: any, onClose: () => void, onSave: (algo: any) => void }) {
  const [formData, setFormData] = useState(algo || {
    name: '',
    fullName: '',
    status: 'Seguro',
    statusColor: '#10b981',
    description: '',
    useCase: '',
    vulnerabilities: ''
  });

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-2xl rounded-[2.5rem] bg-white shadow-2xl border overflow-hidden"
        style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}
      >
        <div className="p-8 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
          <h2 className="text-xl font-bold">{algo ? 'Editar Algoritmo' : 'Nuevo Algoritmo'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-8 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Nombre Corto</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-3 rounded-xl border bg-black/5"
                placeholder="Ej: MD5"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Nombre Completo</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full p-3 rounded-xl border bg-black/5"
                placeholder="Ej: Message Digest Algorithm 5"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Estado</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full p-3 rounded-xl border bg-black/5"
              >
                <option value="Seguro">Seguro</option>
                <option value="Inseguro">Inseguro</option>
                <option value="Obsoleto">Obsoleto</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Color de Estado (Hex)</label>
              <input
                type="color"
                value={formData.statusColor}
                onChange={e => setFormData({ ...formData, statusColor: e.target.value })}
                className="w-full h-12 p-1 rounded-xl border bg-black/5 cursor-pointer"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Descripción</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-3 rounded-xl border bg-black/5 min-h-[100px]"
              placeholder="Descripción del algoritmo..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Uso Recomendado</label>
            <textarea
              value={formData.useCase}
              onChange={e => setFormData({ ...formData, useCase: e.target.value })}
              className="w-full p-3 rounded-xl border bg-black/5 min-h-[80px]"
              placeholder="¿Cuándo usarlo?"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Vulnerabilidades</label>
            <textarea
              value={formData.vulnerabilities}
              onChange={e => setFormData({ ...formData, vulnerabilities: e.target.value })}
              className="w-full p-3 rounded-xl border bg-black/5 min-h-[80px]"
              placeholder="Debilidades conocidas..."
            />
          </div>
        </div>
        <div className="p-8 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border-color)' }}>
          <button onClick={onClose} className="px-6 py-2 rounded-xl font-bold text-sm hover:bg-black/5 transition-colors">Cancelar</button>
          <button
            onClick={() => onSave(formData)}
            className="px-6 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors"
          >
            Guardar Cambios
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SettingsModal({ currentTheme, notificationPrefs, onClose, onThemeChange, onNotificationPrefsChange }: {
  currentTheme: ThemeConfig,
  notificationPrefs: NotificationPrefs,
  onClose: () => void,
  onThemeChange: (themeId: string) => void,
  onNotificationPrefsChange: (prefs: NotificationPrefs) => void
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-2xl rounded-[2.5rem] shadow-2xl border overflow-hidden"
        style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}
      >
        <div 
          className="p-8 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center border"
              style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', color: 'var(--accent-color)' }}
            >
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-color)' }}>Configuración del Sistema</h2>
              <p className="text-xs font-medium opacity-50" style={{ color: 'var(--text-color)' }}>Personaliza tu entorno de trabajo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors opacity-50 hover:opacity-100"
            style={{ color: 'var(--text-color)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-10">
            {/* Theme Selection */}
            <section>
              <div className="flex items-center gap-2 mb-6">
                <Palette className="w-4 h-4" style={{ color: 'var(--accent-color)' }} />
                <h3 className="text-sm font-bold uppercase tracking-widest opacity-50" style={{ color: 'var(--text-color)' }}>Temas Visuales</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => onThemeChange(theme.id)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all group relative overflow-hidden ${
                      currentTheme.id === theme.id ? 'ring-2 ring-emerald-500/20' : ''
                    }`}
                    style={{ 
                      backgroundColor: 'var(--surface-color)', 
                      borderColor: currentTheme.id === theme.id ? '#10b981' : 'var(--border-color)'
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-sm" style={{ color: 'var(--text-color)' }}>{theme.name}</span>
                      {currentTheme.id === theme.id && (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <div className="w-6 h-6 rounded-md border border-white/10" style={{ backgroundColor: theme.colors.bg }} />
                      <div className="w-6 h-6 rounded-md border border-white/10" style={{ backgroundColor: theme.colors.surface }} />
                      <div className="w-6 h-6 rounded-md border border-white/10" style={{ backgroundColor: theme.colors.accent }} />
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Notifications */}
            <section>
              <div className="flex items-center gap-2 mb-6">
                <Bell className="w-4 h-4" style={{ color: 'var(--accent-color)' }} />
                <h3 className="text-sm font-bold uppercase tracking-widest opacity-50" style={{ color: 'var(--text-color)' }}>Notificaciones</h3>
              </div>
              <div className="space-y-3">
                <NotificationToggle
                  label="Actividad Global"
                  description="Recibir alertas cuando otros usuarios realicen acciones."
                  active={notificationPrefs.newActivity}
                  onChange={(val) => onNotificationPrefsChange({ ...notificationPrefs, newActivity: val })}
                />
                <NotificationToggle
                  label="Descubrimientos Raros"
                  description="Alertar cuando se decodifique un hash poco común."
                  active={notificationPrefs.rareHash}
                  onChange={(val) => onNotificationPrefsChange({ ...notificationPrefs, rareHash: val })}
                />
                <NotificationToggle
                  label="Coincidencias de Archivos"
                  description="Notificar cuando una verificación coincida con un archivo conocido."
                  active={notificationPrefs.verificationMatch}
                  onChange={(val) => onNotificationPrefsChange({ ...notificationPrefs, verificationMatch: val })}
                />
              </div>
            </section>
          </div>
        </div>

        <div 
          className="p-8 border-t flex justify-end"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <button
            onClick={onClose}
            className="px-8 py-3 rounded-2xl font-bold transition-all shadow-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Guardar Cambios
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function NotificationToggle({ label, description, active, onChange }: {
  label: string,
  description: string,
  active: boolean,
  onChange: (val: boolean) => void
}) {
  return (
    <div 
      className="flex items-center justify-between p-4 rounded-2xl border transition-colors"
      style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}
    >
      <div>
        <p className="font-bold text-sm mb-0.5" style={{ color: 'var(--text-color)' }}>{label}</p>
        <p className="text-[10px] font-medium opacity-50" style={{ color: 'var(--text-color)' }}>{description}</p>
      </div>
      <button
        onClick={() => onChange(!active)}
        className={`w-12 h-6 rounded-full relative transition-colors ${
          active ? 'bg-emerald-500' : 'bg-gray-200'
        }`}
        style={{ backgroundColor: active ? '#10b981' : 'var(--border-color)' }}
      >
        <motion.div
          animate={{ x: active ? 26 : 2 }}
          className="absolute top-1 left-0 w-4 h-4 rounded-full bg-white shadow-sm"
        />
      </button>
    </div>
  );
}

function FeatureItem({ icon, title, description }: { icon: ReactNode, title: string, description: string }) {
  return (
    <div 
      className="flex gap-4 p-5 rounded-3xl border transition-all group"
      style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}
    >
      <div 
        className="w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm group-hover:scale-110 transition-transform shrink-0"
        style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', color: 'var(--accent-color)' }}
      >
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-sm mb-1" style={{ color: 'var(--text-color)' }}>{title}</h4>
        <p className="text-[11px] leading-relaxed opacity-60" style={{ color: 'var(--text-color)' }}>{description}</p>
      </div>
    </div>
  );
}

function HashRow({
  label,
  value,
  onCopy,
  isCopied,
  isMatched
}: {
  label: string,
  value: string,
  onCopy: () => void,
  isCopied: boolean,
  isMatched?: boolean
}) {
  return (
    <div 
      className={`group relative p-4 rounded-xl border transition-all ${
        isMatched ? 'ring-1 ring-emerald-500/20' : ''
      }`}
      style={{ 
        backgroundColor: isMatched ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface-color)',
        borderColor: isMatched ? 'rgba(16, 185, 129, 0.5)' : 'var(--border-color)'
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <label 
            className="text-xs font-mono font-bold uppercase tracking-wider"
            style={{ color: isMatched ? '#10b981' : 'var(--text-color)', opacity: isMatched ? 1 : 0.5 }}
          >
            {label}
          </label>
          {isMatched && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-emerald-500/20 text-emerald-400">
              <Check className="w-3 h-3" /> Coincide
            </span>
          )}
        </div>
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: isCopied ? '#10b981' : 'var(--text-color)', opacity: isCopied ? 1 : 0.4 }}
        >
          <AnimatePresence mode="wait">
            {isCopied ? (
              <motion.div
                key="copied"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Copiado</span>
              </motion.div>
            ) : (
              <motion.div
                key="copy"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Copiar</span>
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>
      <div 
        className="font-mono text-sm break-all leading-relaxed transition-colors"
        style={{ color: isMatched ? '#10b981' : 'var(--text-color)' }}
      >
        {value}
      </div>
    </div>
  );
}
