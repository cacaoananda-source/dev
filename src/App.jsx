import { useState, useRef, useEffect } from "react";
import { Send, User, Settings, X, RotateCcw } from "lucide-react";

// ─── API Key - Replace with your own from console.anthropic.com ──────────────
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";

// ─── System Prompts ───────────────────────────────────────────────────────────
const buildArchitectPrompt = (profile, patterns) => `You are The Architect — a direct, clear-thinking advisor who cuts through emotional noise and gives structured, honest analysis. You are warm but unsentimental. You give real answers, not leading questions.

${profile.name ? `You are speaking with ${profile.name}.` : ""}
${profile.context ? `Context about them: ${profile.context}` : ""}
${patterns.length > 0 ? `Patterns you've noticed this session:\n${patterns.map(p => `- ${p}`).join("\n")}` : ""}

For every message, structure your response clearly with these sections. Use plain readable headers — no brackets, no all-caps, no bullet overload:

Root Problem
What is this actually about at its core? (Money / Ego / Health / Energy)

Six Month View
What happens if they continue on this path?

What's Actually In Their Control
Only list what they can genuinely act on right now.

The Real Trade-off
What are they actually giving up or avoiding?

The Directive
One clear recommended action. No hedging.

If you spot a recurring pattern across the conversation, add:
Pattern I'm Noticing
Name it plainly.

Write in plain prose, not bullet lists. Be direct and warm. This is an ongoing conversation — reference earlier context when relevant.`;

const buildAuntiePrompt = (profile, patterns) => `You are The Auntie — a warm, wise, deeply loving but no-nonsense advisor. You talk like a brilliant favorite aunt who has seen everything and will tell you the truth with love. You use natural conversational language, occasional humor, and genuine warmth. You are never mean but always honest.

${profile.name ? `You're talking to ${profile.name}. Use their name naturally.` : ""}
${profile.context ? `What you know about them: ${profile.context}` : ""}
${patterns.length > 0 ? `What you've noticed this session:\n${patterns.map(p => `- ${p}`).join("\n")}` : ""}

For every message, respond with these sections in your natural voice:

Six Months From Now
Paint the picture of where this path leads.

What's Really Going On
The honest root of the problem. (Money / Ego / Health / Energy)

What You're Actually Sacrificing
The real cost of their current approach.

What You Can Do Right Now
Practical steps only — what's actually in their control.

Auntie's Verdict
One clear, loving but firm recommendation.

If you notice a pattern emerging:
Honey, I'm Noticing Something
Call it out with warmth.

Write conversationally — like you're talking to them, not filing a report. Use **bold** sparingly for emphasis. This is an ongoing conversation, refer back to what's been said.`;

// ─── Format Response ──────────────────────────────────────────────────────────
function ResponseBubble({ text, isArch }) {
  const accentColor = isArch ? "#0A84FF" : "#8E44AD";
  const sections = [];
  const lines = text.split("\n");
  let current = { header: null, body: [] };

  // Known section headers for both personas
  const headers = [
    "Root Problem", "Six Month View", "What's Actually In Their Control",
    "The Real Trade-off", "The Directive", "Pattern I'm Noticing",
    "Six Months From Now", "What's Really Going On", "What You're Actually Sacrificing",
    "What You Can Do Right Now", "Auntie's Verdict", "Honey, I'm Noticing Something"
  ];

  lines.forEach(line => {
    const trimmed = line.trim();
    const isHeader = headers.some(h => trimmed === h || trimmed.startsWith(h));
    if (isHeader) {
      if (current.body.length > 0 || current.header) sections.push({ ...current });
      current = { header: trimmed, body: [] };
    } else if (trimmed) {
      current.body.push(trimmed);
    }
  });
  if (current.header || current.body.length > 0) sections.push(current);

  const isPattern = (h) => h && (h.includes("Pattern") || h.includes("Noticing Something"));

  const renderText = (t) => {
    const parts = t.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={i} style={{ fontWeight: 600 }}>{p.slice(2, -2)}</strong>
        : p
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {sections.length > 0 ? sections.map((s, i) => (
        <div key={i}>
          {s.header && (
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: isPattern(s.header) ? "#FF3B30" : accentColor,
              marginBottom: 5,
              opacity: 0.85,
            }}>
              {s.header}
            </div>
          )}
          <div style={{ fontSize: 15, lineHeight: 1.65, color: "#1C1C1E" }}>
            {s.body.map((line, j) => (
              <p key={j} style={{ margin: "0 0 6px 0" }}>{renderText(line)}</p>
            ))}
          </div>
        </div>
      )) : (
        <div style={{ fontSize: 15, lineHeight: 1.65, color: "#1C1C1E" }}>
          {text.split("\n").filter(l => l.trim()).map((line, i) => (
            <p key={i} style={{ margin: "0 0 6px 0" }}>{renderText(line)}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function ChaosFilter() {
  const [persona, setPersona] = useState("architect");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [patterns, setPatterns] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [profile, setProfile] = useState({ name: "", context: "" });
  const [profileDraft, setProfileDraft] = useState({ name: "", context: "" });
  const [apiKey, setApiKey] = useState(API_KEY);
  const [apiKeyDraft, setApiKeyDraft] = useState(API_KEY);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const isArch = persona === "architect";

  const archColor = "#0A84FF";
  const auntieColor = "#8E44AD";
  const activeColor = isArch ? archColor : auntieColor;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const extractPatterns = (text) => {
    const triggers = ["Pattern I'm Noticing", "Honey, I'm Noticing Something"];
    for (const trigger of triggers) {
      const idx = text.indexOf(trigger);
      if (idx !== -1) {
        const snippet = text.slice(idx + trigger.length, idx + trigger.length + 120).trim().split("\n")[0].trim();
        if (snippet.length > 5) {
          setPatterns(prev => [...new Set([...prev, snippet])].slice(-4));
        }
      }
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
   const res = await fetch("/api/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1200,
          system: isArch
            ? buildArchitectPrompt(profile, patterns)
            : buildAuntiePrompt(profile, patterns),
          messages: newMessages,
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "Something went wrong. Try again.";
      extractPatterns(text);
      setMessages(prev => [...prev, { role: "assistant", content: text }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error. Check your API key in Settings." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setPatterns([]);
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: "#F2F2F7", fontFamily: "-apple-system, 'SF Pro Text', sans-serif",
    }}>

      {/* ── HEADER ── */}
      <div style={{
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        padding: "12px 16px 10px",
        display: "flex", flexDirection: "column", gap: 10,
        flexShrink: 0,
        position: "sticky", top: 0, zIndex: 50,
      }}>
        {/* Top row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#1C1C1E", letterSpacing: "-0.3px" }}>
              Chaos Filter
            </div>
            <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 1 }}>
              {isArch ? "The Architect" : "The Auntie"} · {messages.filter(m => m.role === "user").length} exchanges
              {patterns.length > 0 && ` · ${patterns.length} pattern${patterns.length > 1 ? "s" : ""} detected`}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {messages.length > 0 && (
              <button onClick={clearChat} style={{ background: "none", border: "none", cursor: "pointer", color: "#8E8E93", padding: 6, borderRadius: 8, display: "flex", alignItems: "center" }}>
                <RotateCcw size={16} />
              </button>
            )}
            <button onClick={() => { setProfileDraft(profile); setShowProfile(true); }} style={{
              background: profile.name ? activeColor : "#E5E5EA",
              border: "none", borderRadius: 20, padding: "5px 12px",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              color: profile.name ? "#fff" : "#3C3C43",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <User size={13} />
              {profile.name || "Profile"}
            </button>
            <button onClick={() => { setApiKeyDraft(apiKey); setShowSettings(true); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#8E8E93", padding: 6, display: "flex" }}>
              <Settings size={18} />
            </button>
          </div>
        </div>

        {/* Persona toggle */}
        <div style={{
          display: "flex", background: "#E5E5EA", borderRadius: 10, padding: 2,
        }}>
          {[
            { key: "architect", label: "The Architect" },
            { key: "auntie", label: "The Auntie" },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setPersona(key)} style={{
              flex: 1, padding: "7px 0", border: "none", borderRadius: 8, cursor: "pointer",
              fontSize: 14, fontWeight: persona === key ? 600 : 400,
              background: persona === key ? "#fff" : "transparent",
              color: persona === key ? (key === "architect" ? archColor : auntieColor) : "#8E8E93",
              boxShadow: persona === key ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
              transition: "all 0.2s",
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* Pattern banner */}
        {patterns.length > 0 && (
          <div style={{
            background: "#FFF3F3", border: "1px solid rgba(255,59,48,0.2)",
            borderRadius: 10, padding: "8px 12px",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#FF3B30", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>
              Patterns Detected
            </div>
            {patterns.map((pat, i) => (
              <div key={i} style={{ fontSize: 12, color: "#3C3C43", lineHeight: 1.5 }}>· {pat.length > 80 ? pat.slice(0, 80) + "…" : pat}</div>
            ))}
          </div>
        )}
      </div>

      {/* ── CHAT AREA ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>

        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 24px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{isArch ? "⚡" : "✨"}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1C1C1E", marginBottom: 8 }}>
              {isArch ? "What do you need to figure out?" : "What's going on, baby?"}
            </div>
            <div style={{ fontSize: 15, color: "#8E8E93", lineHeight: 1.6, maxWidth: 280, margin: "0 auto" }}>
              {isArch
                ? "Describe your situation. Get structured, honest analysis — no fluff, no leading questions."
                : "Tell Auntie what's happening. She's got you and she'll tell you the truth."}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          return (
            <div key={i} style={{
              display: "flex",
              justifyContent: isUser ? "flex-end" : "flex-start",
              marginBottom: 12,
              alignItems: "flex-end",
              gap: 8,
            }}>
              {!isUser && (
                <div style={{
                  width: 30, height: 30, borderRadius: 15, flexShrink: 0,
                  background: isArch ? archColor : auntieColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, color: "#fff", fontWeight: 700,
                  marginBottom: 2,
                }}>
                  {isArch ? "A" : "👵"}
                </div>
              )}

              <div style={{
                maxWidth: "82%",
                background: isUser ? activeColor : "#fff",
                borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                padding: isUser ? "10px 14px" : "14px 16px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              }}>
                {isUser ? (
                  <div style={{ fontSize: 15, color: "#fff", lineHeight: 1.5 }}>
                    {msg.content}
                  </div>
                ) : (
                  <ResponseBubble text={msg.content} isArch={isArch} />
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 12 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 15, flexShrink: 0,
              background: isArch ? archColor : auntieColor,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, color: "#fff", fontWeight: 700,
            }}>
              {isArch ? "A" : "👵"}
            </div>
            <div style={{
              background: "#fff", borderRadius: "18px 18px 18px 4px",
              padding: "14px 18px", boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              display: "flex", gap: 5, alignItems: "center",
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: 4,
                  background: "#C7C7CC",
                  animation: `bounce 1.2s ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ── INPUT BAR ── */}
      <div style={{
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(0,0,0,0.08)",
        padding: "10px 12px",
        display: "flex", alignItems: "flex-end", gap: 10,
        flexShrink: 0,
      }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isArch ? "Describe your situation…" : "Tell Auntie what's going on…"}
          disabled={loading}
          rows={1}
          style={{
            flex: 1, background: "#F2F2F7", border: "none", outline: "none",
            borderRadius: 20, padding: "10px 16px",
            fontFamily: "-apple-system, 'SF Pro Text', sans-serif",
            fontSize: 15, lineHeight: 1.5, color: "#1C1C1E",
            resize: "none", maxHeight: 120, overflowY: "auto",
          }}
          onInput={e => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          style={{
            width: 36, height: 36, borderRadius: 18, border: "none",
            background: !input.trim() || loading ? "#C7C7CC" : activeColor,
            cursor: !input.trim() || loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "background 0.2s",
          }}
        >
          <Send size={16} color="#fff" style={{ marginLeft: 2 }} />
        </button>
      </div>

      {/* ── PROFILE MODAL ── */}
      {showProfile && (
        <Modal title="Your Profile" onClose={() => setShowProfile(false)} onSave={() => { setProfile(profileDraft); setShowProfile(false); }} saveLabel="Save">
          <ModalField label="Your name" value={profileDraft.name} onChange={v => setProfileDraft(d => ({ ...d, name: v }))} placeholder="What should we call you?" />
          <ModalField label="Your situation" value={profileDraft.context} onChange={v => setProfileDraft(d => ({ ...d, context: v }))} placeholder="Give some context about your life, what you're working through, patterns you know you have…" multiline />
          {(profile.name || profile.context) && (
            <button onClick={() => { setProfile({ name: "", context: "" }); setProfileDraft({ name: "", context: "" }); setShowProfile(false); }}
              style={{ width: "100%", padding: "12px", background: "none", border: "1px solid #FF3B30", borderRadius: 12, color: "#FF3B30", fontSize: 15, cursor: "pointer", marginTop: 4 }}>
              Clear Profile
            </button>
          )}
        </Modal>
      )}

      {/* ── SETTINGS MODAL ── */}
      {showSettings && (
        <Modal title="Settings" onClose={() => setShowSettings(false)} onSave={() => { setApiKey(apiKeyDraft); setShowSettings(false); }} saveLabel="Save">
          <ModalField
            label="Anthropic API Key"
            value={apiKeyDraft}
            onChange={v => setApiKeyDraft(v)}
            placeholder="sk-ant-..."
          />
          <div style={{ fontSize: 13, color: "#8E8E93", lineHeight: 1.5, marginTop: 4 }}>
            Get your key at console.anthropic.com — you'll get free credits to start.
          </div>
        </Modal>
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        textarea::placeholder { color: #C7C7CC; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 0; }
      `}</style>
    </div>
  );
}

// ─── Reusable Modal ───────────────────────────────────────────────────────────
function Modal({ title, onClose, onSave, saveLabel, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      zIndex: 200, padding: "0 0 0 0",
    }}>
      <div style={{
        background: "#fff", borderRadius: "20px 20px 0 0",
        padding: "20px 20px 40px", width: "100%", maxWidth: 500,
        boxShadow: "0 -4px 30px rgba(0,0,0,0.15)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1C1C1E" }}>{title}</div>
          <button onClick={onClose} style={{ background: "#E5E5EA", border: "none", borderRadius: 15, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} color="#8E8E93" />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {children}
        </div>
        <button onClick={onSave} style={{
          width: "100%", marginTop: 20, padding: "14px",
          background: "#0A84FF", border: "none", borderRadius: 12,
          color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer",
        }}>
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

function ModalField({ label, value, onChange, placeholder, multiline }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#3C3C43", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={4}
          style={{ width: "100%", background: "#F2F2F7", border: "none", outline: "none", borderRadius: 10, padding: "12px", fontFamily: "-apple-system, sans-serif", fontSize: 15, color: "#1C1C1E", resize: "none", lineHeight: 1.5 }} />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ width: "100%", background: "#F2F2F7", border: "none", outline: "none", borderRadius: 10, padding: "12px", fontFamily: "-apple-system, sans-serif", fontSize: 15, color: "#1C1C1E" }} />
      )}
    </div>
  );
}