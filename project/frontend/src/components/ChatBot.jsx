import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Brain, ChevronDown, ChevronRight, X, MessageSquare } from 'lucide-react';

// Custom lightweight Markdown renderer to avoid npm installation risks
function SimpleMarkdown({ content }) {
  if (!content) return null;
  
  const lines = content.split('\n');
  
  const parseInline = (text) => {
    // Bold: **text**
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="text-white font-semibold">{part}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        
        // Headers (e.g. ### Header or *   **Header:**)
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={i} className="text-white font-semibold text-[0.95rem] mt-2 mb-1">
              {trimmed.slice(4)}
            </h4>
          );
        }
        
        // Bullet lists (e.g. * Item or - Item)
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          return (
            <div key={i} className="flex gap-2 pl-3 items-start text-[0.85rem] leading-snug">
              <span className="text-[var(--brand-primary)] mt-1">•</span>
              <div>{parseInline(trimmed.slice(2))}</div>
            </div>
          );
        }

        // Empty lines
        if (!trimmed) {
          return <div key={i} className="h-1" />;
        }

        // Regular paragraphs
        return (
          <p key={i} className="m-0 text-[0.875rem] leading-relaxed text-[var(--text-main)]">
            {parseInline(line)}
          </p>
        );
      })}
    </div>
  );
}

import { useStore } from '../store/useStore'
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function ChatBot() {
  const { activeField } = useStore();
  const activeFieldContext = activeField;
  
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { 
      role: 'model', 
      content: "Hello! I am the **PRAGATI AI Assistant**, trained to analyze remote sensing data and agricultural trends.\n\nSelect a field on the map, then ask me anything about its crop type, moisture stress, yield, or irrigation needs." 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedThoughts, setExpandedThoughts] = useState({});
  
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Suggested questions
  const SUGGESTIONS = [
    "What crop is detected in my field?",
    "Is my field under moisture stress?",
    "Should I irrigate today?",
    "What is the expected yield?",
    "What do the satellite images indicate?",
    "What should I do next to improve crop health?"
  ];

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Adjust textarea height dynamically based on input length
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 100) + 'px';
      textareaRef.current.style.overflowY = scrollHeight > 100 ? 'auto' : 'hidden';
    }
  }, [input]);

  const toggleThought = (idx) => {
    setExpandedThoughts(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleSend = async (e, overrideText = null) => {
    e?.preventDefault();
    const textToSend = overrideText || input;
    if (!textToSend.trim() || isLoading) return;

    if (!overrideText) setInput('');
    setIsLoading(true);

    const newMessages = [...messages, { role: 'user', content: textToSend.trim() }];
    setMessages(newMessages);

    // Add placeholder model message
    const nextIdx = newMessages.length;
    let thinking = '';
    let reply = '';
    let suggestions = [];

    // Add empty response placeholder
    setMessages(prev => [
      ...prev, 
      { role: 'model', content: '', thoughts: '', suggestions: [] }
    ]);

    try {
      // Use Fetch API for streaming response via SSE
      const response = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend.trim(),
          history: newMessages.slice(0, -1),
          field_id: activeFieldContext?.field_id || null,
          crop: activeFieldContext?.crop || null,
          vci: activeFieldContext?.vci !== undefined ? activeFieldContext.vci : null,
          stage: activeFieldContext?.stage || null,
          rainfall_mm: activeFieldContext?.rainfall_mm !== undefined ? activeFieldContext.rainfall_mm : null
        })
      });

      if (!response.ok) {
        throw new Error("Failed to connect to chatbot service.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Save incomplete line for next iteration

        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine.startsWith('data: ')) {
            const dataStr = cleanLine.slice(6).trim();
            if (dataStr === '[DONE]') break;
            
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'THOUGHT') {
                thinking += (thinking ? '\n' : '') + parsed.content;
              } else if (parsed.type === 'SUGGESTION') {
                suggestions.push(parsed.content);
              } else if (parsed.type === 'FINAL_RESPONSE') {
                reply += parsed.content;
              }

              // Update the current streaming message
              setMessages(prev => {
                const updated = [...prev];
                updated[nextIdx] = {
                  role: 'model',
                  content: reply,
                  thoughts: thinking,
                  suggestions: suggestions
                };
                return updated;
              });
            } catch (err) {
              console.error("Error parsing stream line:", err, dataStr);
            }
          }
        }
      }
    } catch (error) {
      console.error("Chatbot error:", error);
      setMessages(prev => {
        const updated = [...prev];
        updated[nextIdx] = {
          role: 'model',
          content: `⚠️ **Connection Error:** Could not reach the AI Assistant. Make sure the backend server is running.`,
          thoughts: 'Connection failed.',
          suggestions: []
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Chat Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open AI Chatbot"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'var(--blue-600)',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 20px rgba(37,99,235,0.35), 0 0 0 1px rgba(255,255,255,0.1)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          transition: 'transform 0.2s ease, background 0.2s ease',
          transform: isOpen ? 'scale(0)' : 'scale(1)',
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        <MessageSquare size={24} />
      </button>

      {/* Slide-out Chat Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: '380px',
          background: 'rgba(5, 8, 20, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'var(--blue-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bot size={16} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'white' }}>PRAGATI AI Assistant</div>
              {activeFieldContext ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--emerald-500)' }}>
                  Active Field: {activeFieldContext.field_id} ({activeFieldContext.crop})
                </div>
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No active field selected</div>
              )}
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close Chatbot"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              borderRadius: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              display: 'flex',
              gap: '10px',
              flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
              alignItems: 'flex-start'
            }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: m.role === 'user' ? 'var(--navy-600)' : 'var(--navy-800)',
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {m.role === 'user' ? <User size={14} color="var(--text-main)" /> : <Bot size={14} color="var(--blue-400)" />}
              </div>
              <div style={{ maxWidth: '82%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                
                {/* Collapsible Thoughts Box */}
                {m.role === 'model' && m.thoughts && m.thoughts.trim().length > 0 && (
                  <div style={{
                    background: 'rgba(59,130,246,0.04)',
                    border: '1px solid rgba(59,130,246,0.15)',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}>
                    <button
                      onClick={() => toggleThought(i)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        background: 'none',
                        border: 'none',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        color: 'var(--blue-400)',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      {expandedThoughts[i] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <Brain size={12} />
                      <span>
                        {m.content && m.content.length > 0 ? "View reasoning process" : "Analyzing data..."}
                      </span>
                    </button>
                    {expandedThoughts[i] && (
                      <div style={{
                        padding: '8px 10px',
                        borderTop: '1px solid rgba(59,130,246,0.15)',
                        background: 'rgba(0,0,0,0.15)',
                        fontSize: '0.7rem',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-muted)',
                        maxHeight: '150px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        {m.thoughts.split('\n').filter(l => l.trim().length > 0).map((line, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '4px' }}>
                            <span style={{ color: 'var(--blue-500)' }}>›</span>
                            <span>{line}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Loading indicator */}
                {m.role === 'model' && !m.content && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                    padding: '4px 8px'
                  }}>
                    <Loader2 size={12} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                    Thinking...
                  </div>
                )}

                {/* Response Text */}
                {m.content && (
                  <div style={{
                    padding: '10px 12px',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    lineHeight: '1.4',
                    background: m.role === 'user' ? 'var(--blue-600)' : 'var(--navy-800)',
                    color: m.role === 'user' ? 'white' : 'var(--text-main)',
                    border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    borderTopRightRadius: m.role === 'user' ? '0px' : '12px',
                    borderTopLeftRadius: m.role === 'user' ? '12px' : '0px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}>
                    {m.role === 'model' ? (
                      <SimpleMarkdown content={m.content} />
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                    )}
                  </div>
                )}

                {/* Suggestions Buttons inside the message trail (for model's custom follow-ups) */}
                {m.role === 'model' && m.suggestions && m.suggestions.length > 0 && !isLoading && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                    {m.suggestions.slice(0, 2).map((s, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => handleSend(e, s)}
                        disabled={isLoading}
                        style={{
                          textAlign: 'left',
                          fontSize: '0.75rem',
                          background: 'rgba(37,99,235,0.08)',
                          color: 'var(--blue-300)',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(37,99,235,0.2)',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(37,99,235,0.15)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(37,99,235,0.08)'}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Floating Suggestions (Only shows at the bottom when no request is loading) */}
        {!isLoading && messages.length === 1 && (
          <div style={{
            padding: '8px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            maxHeight: '180px',
            overflowY: 'auto',
            borderTop: '1px solid rgba(255,255,255,0.04)'
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suggested Questions</div>
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                onClick={(e) => handleSend(e, s)}
                style={{
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  background: 'rgba(255,255,255,0.03)',
                  color: 'var(--text-main)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input Form */}
        <form
          onSubmit={handleSend}
          style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            background: 'var(--navy-950)',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '8px',
            position: 'relative'
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ask PRAGATI Assistant..."
            rows={1}
            style={{
              flex: 1,
              background: 'var(--navy-900)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '10px 38px 10px 12px',
              fontSize: '0.85rem',
              color: 'white',
              outline: 'none',
              resize: 'none',
              lineHeight: '1.4',
              maxHeight: '100px',
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            style={{
              position: 'absolute',
              right: '24px',
              bottom: '20px',
              background: 'var(--blue-600)',
              border: 'none',
              color: 'white',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              opacity: (!input.trim() || isLoading) ? 0.5 : 1,
              transition: 'opacity 0.2s ease',
            }}
          >
            <Send size={12} />
          </button>
        </form>
      </div>

      {/* CSS Animation Keyframes for Loader spinning */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </>
  );
}
