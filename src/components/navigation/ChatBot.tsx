// Mantri AI Coach — Floating ChatBot (Routed through secure backend → Chess RAG API)
import React, { useState, useRef, useEffect } from 'react';
import { chatbotApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
}

const INITIAL_SUGGESTIONS_EN = [
  'How to plan my next move like a master?',
  'What is the best opening for beginners?',
  'How do I improve my endgame?',
  'Explain the concept of pawn structure.',
];

const INITIAL_SUGGESTIONS_TA = [
  'ஒரு மாஸ்டர் போல எனது அடுத்த நகர்வை எவ்வாறு திட்டமிடுவது?',
  'ஆரம்பநிலையினருக்கு சிறந்த தொடக்கம் எது?',
  'எனது இறுதி ஆட்டத்தை எவ்வாறு மேம்படுத்துவது?',
  'சிப்பாய் அமைப்பின் கருத்தை விளக்குங்கள்.',
];

/**
 * Client-side bilingual keyword mapping engine. Analyzes the AI's reply and returns 3 highly
 * relevant follow-up questions in the chosen language.
 */
function getFollowUpSuggestions(reply: string, lang: 'en' | 'ta'): string[] {
  const text = reply.toLowerCase();
  const isTa = lang === 'ta';

  // Pawn structure related
  if (text.includes('pawn') || text.includes('structure') || text.includes('passed') || text.includes('chain') || text.includes('சிப்பாய்') || text.includes('அமைப்பு')) {
    return isTa ? [
      'கடந்து வந்த சிப்பாய் என்றால் என்ன, அது ஏன் வலிமையானது?',
      'தனித்த அல்லது இரட்டை சிப்பாய்களை நான் எவ்வாறு கையாள்வது?',
      'சிப்பாய் சங்கிலி என்றால் என்ன?'
    ] : [
      'What is a passed pawn and why is it strong?',
      'How should I deal with isolated or doubled pawns?',
      'What is a pawn chain and how do I attack it?',
    ];
  }

  // Opening related
  if (text.includes('opening') || text.includes('defense') || text.includes('sicilian') || text.includes('gambit') || text.includes('தொடக்கம்') || text.includes('சதுரங்க')) {
    return isTa ? [
      'கருப்பு நிறத்திற்கு பாதுகாப்பான தொடக்கம் எது?',
      'ஆரம்ப வீரர்கள் ராணியின் கேம்பிட்டை விளையாட வேண்டுமா?',
      'சிசிலியன் தற்காப்பின் முக்கிய யோசனை என்ன?'
    ] : [
      'What is the safest opening for black?',
      'Should beginner players try the Queen\'s Gambit?',
      'What is the key idea behind the Sicilian Defense?',
    ];
  }

  // Endgame related
  if (text.includes('endgame') || text.includes('opposition') || text.includes('checkmate') || text.includes('இறுதி ஆட்டம்') || text.includes('இறுதி')) {
    return isTa ? [
      'சதுரங்க இறுதி ஆட்டத்தில் ஆப்போசிஷன் என்றால் என்ன?',
      'ராஜா மற்றும் கோட்டையைக் கொண்டு செக்மேட் செய்வது எப்படி?',
      'சிப்பாய் இறுதி ஆட்டங்களின் பொன்னான விதிகள் யாவை?'
    ] : [
      'What is opposition in the chess endgame?',
      'How do I checkmate with a King and Rook?',
      'What are the golden rules of pawn endgames?',
    ];
  }

  // Tactics related
  if (text.includes('tactic') || text.includes('fork') || text.includes('pin') || text.includes('skewer') || text.includes('உத்திகள்') || text.includes('ஃபோர்க்')) {
    return isTa ? [
      'பின் மற்றும் ஸ்கேவர் இடையே உள்ள வேறுபாடு என்ன?',
      'விளையாட்டின் போது ஃபோர்க் உத்திகளை நான் எவ்வாறு கண்டுபிடிப்பது?',
      'புதிர்களைப் பயிற்சி செய்ய சிறந்த வழி எது?'
    ] : [
      'What is the difference between a pin and a skewer?',
      'How can I spot tactical forks during a game?',
      'What is the best way to practice puzzles?',
    ];
  }

  // General fallback
  return isTa ? [
    'ஒரு மாஸ்டர் போல எனது அடுத்த நகர்வை எவ்வாறு திட்டமிடுவது?',
    'எனது விளையாட்டுகளை பகுப்பாய்வு செய்ய சிறந்த வழி எது?',
    'சதுரங்கத்தில் எனது உணர்ச்சிகளை எவ்வாறு கட்டுப்படுத்துவது?'
  ] : [
    'How do I plan my next move like a master?',
    'What is the best way to analyze my games?',
    'How can I control my emotions in chess?',
  ];
}

function ChatBotPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();

  // Sync initial language state with the application settings (sessionStorage)
  const [lang, setLang] = useState<'en' | 'ta'>(() => {
    const saved = sessionStorage.getItem('sigaram64_quiz_lang');
    return saved === 'tamil' ? 'ta' : 'en';
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const isTa = sessionStorage.getItem('sigaram64_quiz_lang') === 'tamil';
    const nameStr = user?.name || (isTa ? 'மாணவரே' : 'Student');
    return [
      {
        role: 'bot',
        text: isTa 
          ? `வணக்கம், ${nameStr}! 👋 நான் மந்திரி, உங்கள் சதுரங்க பயிற்சியாளர். சதுரங்க உத்திகள், தொடக்க ஆட்டங்கள் அல்லது உங்கள் விளையாட்டை மேம்படுத்துவது பற்றி எதையும் என்னிடம் கேளுங்கள்!`
          : `Hello, ${nameStr}! 👋 I am Mantri, your AI chess coach. Ask me anything about chess strategy, openings, tactics, or how to improve your game!`,
      }
    ];
  });
  
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(() => {
    const isTa = sessionStorage.getItem('sigaram64_quiz_lang') === 'tamil';
    return isTa ? INITIAL_SUGGESTIONS_TA : INITIAL_SUGGESTIONS_EN;
  });
  const messagesEndRef                 = useRef<HTMLDivElement>(null);

  // --- Voice Read Aloud States (English Only) ---
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [playingAudio, setPlayingAudio]   = useState(false);
  const activeAudioRef                    = useRef<HTMLAudioElement | null>(null);

  // Sync state if user clicks global toggle in header
  useEffect(() => {
    const handleLangChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'tamil') {
        setLang('ta');
        setSuggestions(INITIAL_SUGGESTIONS_TA);
      } else if (detail === 'english') {
        setLang('en');
        setSuggestions(INITIAL_SUGGESTIONS_EN);
      }
    };
    window.addEventListener('quiz-lang-changed', handleLangChange);
    return () => {
      window.removeEventListener('quiz-lang-changed', handleLangChange);
    };
  }, []);

  // Update suggestions list when local state language switches manually
  useEffect(() => {
    if (messages.length === 1) {
      setSuggestions(lang === 'ta' ? INITIAL_SUGGESTIONS_TA : INITIAL_SUGGESTIONS_EN);
      const nameStr = user?.name || (lang === 'ta' ? 'மாணவரே' : 'Student');
      setMessages([
        {
          role: 'bot',
          text: lang === 'ta'
            ? `வணக்கம், ${nameStr}! 👋 நான் மந்திரி, உங்கள் சதுரங்க பயிற்சியாளர். சதுரங்க உத்திகள், தொடக்க ஆட்டங்கள் அல்லது உங்கள் விளையாட்டை மேம்படுத்துவது பற்றி எதையும் என்னிடம் கேளுங்கள்!`
            : `Hello, ${nameStr}! 👋 I am Mantri, your AI chess coach. Ask me anything about chess strategy, openings, tactics, or how to improve your game!`,
        }
      ]);
    } else {
      // Regenerate suggestions based on the last bot response
      const lastBotMsg = [...messages].reverse().find(m => m.role === 'bot');
      if (lastBotMsg) {
        setSuggestions(getFollowUpSuggestions(lastBotMsg.text, lang));
      }
    }
  }, [lang, user]);

  // Auto-scroll to bottom on new message or when suggestion buttons render
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, suggestions]);

  // Clean up any active audio sessions on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  // --- Voice TTS (Text-to-Speech) Read Aloud functions (English only) ---
  async function readAloud(text: string, index: number) {
    if (playingAudio) {
      if (speakingIndex === index) {
        stopAudio();
        return;
      }
      stopAudio();
    }

    setSpeakingIndex(index);
    setPlayingAudio(true);

    try {
      const res = await chatbotApi.textToSpeech(text, lang);
      if (res?.audio) {
        const audioUrl = `data:audio/mp3;base64,${res.audio}`;
        const audio = new Audio(audioUrl);
        activeAudioRef.current = audio;

        audio.onended = () => {
          setSpeakingIndex(null);
          setPlayingAudio(false);
        };

        audio.onerror = (e) => {
          console.error('Audio playback error:', e);
          setSpeakingIndex(null);
          setPlayingAudio(false);
        };

        await audio.play();
      } else {
        setSpeakingIndex(null);
        setPlayingAudio(false);
      }
    } catch (err) {
      console.error('TTS synthesis failed:', err);
      setSpeakingIndex(null);
      setPlayingAudio(false);
    }
  }

  function stopAudio() {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    setSpeakingIndex(null);
    setPlayingAudio(false);
  }

  async function sendMessage(text?: string) {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;

    // Get the current active ChessBoard FEN if it exists globally on the page
    const activeFen = (window as any).currentChessBoardFen;

    setMessages(m => [...m, { role: 'user', text: userText }]);
    setInput('');
    setLoading(true);

    // Stop speaking if user types a new question
    stopAudio();

    // --- 1. Client-Side Greeting Interception ---
    const GREETINGS = ['hi', 'hello', 'hey', 'வணக்கம்', 'ஹலோ', 'hi there', 'hello there', 'greetings', 'vanakkam'];
    const cleaned = userText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();

    if (GREETINGS.includes(cleaned)) {
      const nameStr = user?.name || (lang === 'ta' ? 'மாணவரே' : 'Student');
      setTimeout(() => {
        setMessages(m => [...m, {
          role: 'bot',
          text: lang === 'ta'
            ? `வணக்கம், ${nameStr}! 👋 நான் மந்திரி, உங்கள் சதுரங்க பயிற்சியாளர். நான் உங்களுக்கு இன்று எவ்வாறு உதவ முடியும்?`
            : `Hello, ${nameStr}! 👋 I am Mantri, your AI chess coach. How can I help you today?`
        }]);
        setLoading(false);
      }, 300);
      return;
    }

    // --- 2. Standard Query Proxy Pipeline ---
    try {
      const res = await chatbotApi.ask(userText, activeFen, lang);
      setMessages(m => [...m, { role: 'bot', text: res.reply }]);
      
      const nextSuggestions = getFollowUpSuggestions(res.reply, lang);
      setSuggestions(nextSuggestions);
    } catch (err) {
      console.error('Chatbot query failed:', err);
      setMessages(m => [
        ...m,
        {
          role: 'bot',
          text: lang === 'ta' 
            ? 'மன்னிக்கவும், என்னால் இப்போது பதிலளிக்க முடியவில்லை. சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.' 
            : 'Sorry, I am unable to reply at the moment. Please try again shortly.',
        },
      ]);
      setSuggestions(lang === 'ta' ? INITIAL_SUGGESTIONS_TA : INITIAL_SUGGESTIONS_EN);
    } finally {
      setLoading(false);
    }
  }

  const renderedSuggestions = (() => {
    const activeFen = (window as any).currentChessBoardFen;
    if (!activeFen) return suggestions;

    const boardQuestion = lang === 'ta'
      ? '🔍 எனது தற்போதைய போர்டு நிலையை விளக்கு'
      : '🔍 Explain my current board position';

    if (suggestions.includes(boardQuestion) || suggestions.some(s => s.includes('board position') || s.includes('போர்டு நிலையை'))) {
      return suggestions;
    }

    return [boardQuestion, ...suggestions];
  })();

  const lastMessage = messages[messages.length - 1];
  const showSuggestions = !loading && lastMessage && lastMessage.role === 'bot';

  return (
    <div
      className="fixed bottom-20 lg:bottom-8 right-4 z-[60] w-80 flex flex-col rounded-2xl border border-gold/40 shadow-2xl overflow-hidden animate-slideUp text-xs animate-fadeIn"
      style={{ background: 'var(--navy)', maxHeight: '480px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E2E52] bg-navy-mid select-none flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg animate-pulse">🤖</span>
          <div>
            <p className="text-white text-sm font-bold">Mantri AI Coach</p>
            <p className="text-green-400 text-[10px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
              Online
            </p>
          </div>
        </div>

        {/* Language Selection Toggle */}
        <button
          onClick={() => setLang(l => l === 'en' ? 'ta' : 'en')}
          className="ml-auto mr-3 px-2 py-0.5 rounded-md border border-gold/40 bg-navy text-[9px] font-bold text-gold hover:bg-gold hover:text-navy transition-all active:scale-95 duration-150 uppercase tracking-wider"
          title="Switch Language / மொழியை மாற்றவும்"
        >
          {lang === 'en' ? 'தமிழ்' : 'ENGLISH'}
        </button>

        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg transition-colors">✕</button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ maxHeight: '320px' }}>
        {messages.map((m, i) => {
          const isBot = m.role === 'bot';
          const isSpeaking = speakingIndex === i;
          return (
            <div key={i} className={`flex ${isBot ? 'justify-start' : 'justify-end'} items-start animate-slideUp`}>
              {isBot && (
                <span className="text-base mr-1.5 flex-shrink-0 mt-0.5 select-none">🤖</span>
              )}
              <div className="relative group max-w-[85%] flex items-end gap-1.5">
                <div
                  className={`px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap transition-all shadow-md ${
                    m.role === 'user'
                      ? 'bg-gold text-navy font-bold rounded-br-sm'
                      : 'bg-navy-mid text-gray-200 border border-[#1E2E52]/40 rounded-bl-sm'
                  }`}
                >
                  {m.text}
                </div>

                {isBot && lang === 'en' && (
                  <button
                    onClick={() => readAloud(m.text, i)}
                    disabled={loading}
                    className={`p-1 rounded-md text-[11px] opacity-60 hover:opacity-100 transition-opacity active:scale-90 flex-shrink-0 ${
                      isSpeaking ? 'text-gold animate-bounce' : 'text-gray-400'
                    }`}
                    title={isSpeaking ? 'Stop Reading' : 'Read Aloud (Voice)'}
                  >
                    {isSpeaking ? '🎵' : '🔊'}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start items-center gap-2 animate-pulse">
            <span className="text-base select-none">🤖</span>
            <div className="bg-navy-mid text-gray-400 border border-[#1E2E52]/40 px-3 py-2 rounded-xl rounded-bl-sm text-xs italic">
              <span className="inline-flex gap-1 mr-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>•</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>•</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>•</span>
              </span>
              {lang === 'ta' ? 'மந்திரி யோசிக்கிறார்...' : 'Mantri is thinking…'}
            </div>
          </div>
        )}

        {/* Dynamic Suggested follow-up questions */}
        {showSuggestions && renderedSuggestions.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-[#1E2E52]/30 animate-fadeIn">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider px-1">
              {lang === 'ta' ? 'பரிந்துரைக்கப்பட்ட கேள்விகள்:' : 'Suggested Follow-ups:'}
            </p>
            <div className="flex flex-col gap-1.5">
              {renderedSuggestions.map((q, i) => {
                const isBoardAction = q.startsWith('🔍');
                return (
                  <button
                    key={i}
                    onClick={() => sendMessage(q.replace('🔍 ', ''))}
                    className={`w-full text-left text-[10px] rounded-lg px-3 py-1.5 transition-all hover:translate-x-1 active:scale-95 duration-200 leading-relaxed font-semibold ${
                      isBoardAction 
                        ? 'text-cyan-400 border border-cyan-400/30 bg-cyan-400/5 hover:bg-cyan-400/15'
                        : 'text-gold border border-gold/20 bg-gold/5 hover:bg-gold/15'
                    }`}
                  >
                    {q}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input UI */}
      <div className="px-3 py-2 border-t border-[#1E2E52] flex items-center gap-2 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder={lang === 'ta' ? 'சதுரங்கக் கேள்வி கேளுங்கள்...' : 'Ask a chess question…'}
          disabled={loading}
          className="flex-1 bg-dark-bg border border-[#1E2E52] rounded-full px-3 py-1.5 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-gold transition-colors disabled:opacity-50"
        />

        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          className="w-8 h-8 rounded-full bg-gold flex items-center justify-center text-navy text-sm font-bold hover:bg-gold-light transition-colors active:scale-90 disabled:opacity-50 flex-shrink-0"
        >
          →
        </button>
      </div>
    </div>
  );
}

export default function ChatBot() {
  const [showChat, setShowChat] = useState(false);

  return (
    <>
      {showChat && <ChatBotPanel onClose={() => setShowChat(false)} />}
      <button
        onClick={() => setShowChat(c => !c)}
        className="fixed bottom-24 lg:bottom-8 right-4 z-[55] w-14 h-14 rounded-full bg-gold shadow-lg flex items-center justify-center text-navy text-2xl hover:bg-gold-light transition-all active:scale-90 animate-glowPulse border-[3px] border-dark-bg"
        title="Ask Mantri AI Coach"
      >
        🤖
      </button>
    </>
  );
}
