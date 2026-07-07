import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatbotApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { VOICE_CONFIG } from '../../config/voiceConfig';

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
}

type MicState = 'idle' | 'recording' | 'processing';

const INITIAL_SUGGESTIONS_EN = [
  'How to plan my next move like a master?',
  'What is the best opening for beginners?',
  'Where can I play a game?',
  'Where can I see my game history?',
  'Where can I watch chess video lessons?',
  'How do I change the chatbot language?',
];

const INITIAL_SUGGESTIONS_TA = [
  'ஒரு மாஸ்டர் போல எனது அடுத்த நகர்வை எவ்வாறு திட்டமிடுவது?',
  'ஆரம்பநிலையினருக்கு சிறந்த தொடக்கம் எது?',
  'நான் எங்கு கேம் விளையாடலாம்?',
  'எனது விளையாட்டு வரலாற்றை எங்கே பார்க்கலாம்?',
  'நான் எங்கு வீடியோ பாடங்களை பார்க்கலாம்?',
  'எனது சாட்பாட் மொழியை எவ்வாறு மாற்றுவது?',
];

function getFollowUpSuggestions(reply: string, lang: 'en' | 'ta'): string[] {
  const text = reply.toLowerCase();
  const isTa = lang === 'ta';

  // Platform related
  if (text.includes('sigaram') || text.includes('feature') || text.includes('rating') || text.includes('மதிப்பீடு') || text.includes('வசதி') || text.includes('புதிர்')) {
    return isTa ? [
      'நான் எங்கு கேம் விளையாடலாம்?',
      'எனது சுயவிவரப் பக்கம் எங்கே உள்ளது?',
      'எனது விளையாட்டு வரலாற்றை எங்கே பார்க்கலாம்?'
    ] : [
      'Where can I play a game?',
      'Where is my profile page?',
      'Where can I see my game history?'
    ];
  }

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
  const navigate = useNavigate();

  // Helper function to render text containing [Label](/path) as clickable buttons
  function renderMessageText(text: string) {
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const label = match[1];
      const path = match[2];
      parts.push(
        <span
          key={match.index}
          onClick={() => {
            navigate(path);
            onClose(); // Close chatbot panel on navigation
          }}
          className="text-gold hover:text-gold-light font-extrabold underline cursor-pointer select-none mx-0.5 focus:outline-none"
        >
          {label}
        </span>
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  }

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
  const messagesEndRef                = useRef<HTMLDivElement>(null);

  // --- Voice Read Aloud (TTS) States ---
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [playingAudio, setPlayingAudio]   = useState(false);
  const activeAudioRef                    = useRef<HTMLAudioElement | null>(null);

  // --- Voice Input (STT) States ---
  const [micState, setMicState]     = useState<MicState>('idle');
  const [voiceMode, setVoiceMode]   = useState(false); // true = user is using mic; auto-play TTS on reply
  const voiceModeRef                = useRef(false);   // Ref mirrors state — safe to read inside async closures
  const mediaRecorderRef            = useRef<MediaRecorder | null>(null);
  const audioChunksRef              = useRef<Blob[]>([]);

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

  // Keep voiceModeRef in sync with voiceMode state so async closures always read the latest value
  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

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
      stopRecording();
    };
  }, []);

  // ─── TTS: Read Aloud ──────────────────────────────────────────────────────

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

    // Pick speaker and pace from developer config based on current language
    const speaker = lang === 'ta' ? VOICE_CONFIG.tamil.speaker : VOICE_CONFIG.english.speaker;
    const pace    = lang === 'ta' ? VOICE_CONFIG.tamil.pace    : VOICE_CONFIG.english.pace;

    // Strip markdown links like [Label](/path) into "Label" so TTS doesn't read out the raw URLs
    const cleanText = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');

    try {
      const res = await chatbotApi.textToSpeech(cleanText, lang, speaker, pace);
      if (res?.audio) {
        const audioUrl = `data:audio/wav;base64,${res.audio}`;
        const audio = new Audio(audioUrl);
        activeAudioRef.current = audio;

        audio.onended = () => {
          setSpeakingIndex(null);
          setPlayingAudio(false);
        };

        audio.onerror = () => {
          setSpeakingIndex(null);
          setPlayingAudio(false);
        };

        await audio.play();
      } else {
        setSpeakingIndex(null);
        setPlayingAudio(false);
      }
    } catch (err) {
      console.error('[TTS] synthesis failed:', err);
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

  // ─── STT: Microphone Recording ────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      // Prefer webm/opus — widely supported; fall back to whatever the browser offers
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all mic tracks to release the browser mic indicator
        stream.getTracks().forEach(t => t.stop());

        const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        const ext  = mimeType.includes('webm') ? 'webm' : 'wav';
        const file = new File([blob], `voice-input.${ext}`, { type: blob.type });

        setMicState('processing');
        try {
          const res = await chatbotApi.speechToText(file, lang);
          const transcript = res?.transcription?.trim() ?? '';
          if (transcript) {
            // Option B: auto-send immediately — no input box fill
            await sendMessage(transcript);
          }
        } catch (err) {
          console.error('[STT] Transcription failed:', err);
        } finally {
          setMicState('idle');
        }
      };

      recorder.start();
      setMicState('recording');
      setVoiceMode(true);
    } catch (err) {
      console.error('[Mic] Could not access microphone:', err);
      setMicState('idle');
      alert(lang === 'ta'
        ? 'மைக்ரோஃபோனை அணுக முடியவில்லை. உலாவி அனுமதியை சரிபார்க்கவும்.'
        : 'Could not access microphone. Please check browser permissions.');
    }
  }, [lang]);

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }

  function handleMicClick() {
    // Stop any playing TTS audio immediately when the user interacts with the microphone
    stopAudio();

    if (micState === 'idle') {
      startRecording();
    } else if (micState === 'recording') {
      stopRecording();
    }
    // 'processing' — do nothing, wait for async to finish
  }

  // ─── Send Message ─────────────────────────────────────────────────────────

  async function sendMessage(text?: string) {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;

    // Get the current active ChessBoard FEN and player color if it exists globally on the page
    const activeFen   = (window as any).currentChessBoardFen;
    const playerColor = (window as any).currentPlayerColor;

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
      const greetText = lang === 'ta'
        ? `வணக்கம், ${nameStr}! 👋 நான் மந்திரி, உங்கள் சதுரங்க பயிற்சியாளர். நான் உங்களுக்கு இன்று எவ்வாறு உதவ முடியும்?`
        : `Hello, ${nameStr}! 👋 I am Mantri, your AI chess coach. How can I help you today?`;
      setTimeout(() => {
        const greetIdx = messages.length + 1;
        setMessages(m => [...m, { role: 'bot', text: greetText }]);
        setLoading(false);
        // Auto-play TTS — use ref (not state) to avoid stale closure
        if (voiceModeRef.current) readAloud(greetText, greetIdx);
      }, 300);
      return;
    }

    // --- 1.2 Client-Side Navigation Questions Interception ---
    const lowerText = userText.toLowerCase().trim();
    
    // English Checks
    const isPlayGameEn    = lowerText.includes('where can i play') || lowerText.includes('play game') || lowerText.includes('how to play game') || lowerText === 'where can i play a game?';
    const isProfileEn     = lowerText.includes('where is my profile') || lowerText.includes('profile page') || lowerText.includes('profile option') || lowerText === 'where is my profile page?';
    const isHistoryEn     = lowerText.includes('where can i see my game history') || lowerText.includes('see my history') || lowerText.includes('game history') || lowerText.includes('my history') || lowerText === 'where can i see my game history?';
    const isFamousEn      = lowerText.includes('where can i study famous') || lowerText.includes('famous games') || lowerText.includes('study famous chess games') || lowerText === 'where can i study famous chess games?';
    const isLanguageEn    = lowerText.includes('how do i change the chatbot language') || lowerText.includes('change language') || lowerText.includes('chatbot language') || lowerText === 'how do i change the chatbot language?';
    const isRatingEn      = lowerText.includes('where can i see my chess elo') || lowerText.includes('see my elo') || lowerText.includes('my rating') || lowerText.includes('elo rating') || lowerText === 'where can i see my chess elo rating?';
    const isLessonsEn     = lowerText.includes('where can i watch chess video lessons') || lowerText.includes('watch lessons') || lowerText.includes('video lessons') || lowerText === 'where can i watch chess video lessons?';
    const isAssessmentEn  = lowerText.includes('where can i take my chess assessment') || lowerText.includes('take my assessment') || lowerText.includes('chess assessment') || lowerText === 'where can i take my chess assessment?';

    // Tamil Checks
    const isPlayGameTa    = lowerText.includes('நான் எங்கு கேம் விளையாடலாம்') || lowerText.includes('விளையாடலாம்') || lowerText.includes('கேம் விளையாட') || lowerText === 'நான் எங்கு கேம் விளையாடலாம்?';
    const isProfileTa     = lowerText.includes('எனது சுயவிவரப் பக்கம் எங்கே உள்ளது') || lowerText.includes('சுயவிவரப் பக்கம்') || lowerText.includes('பயனர் சுயவிவரம்') || lowerText === 'எனது சுயவிவரப் பக்கம் எங்கே உள்ளது?';
    const isHistoryTa     = lowerText.includes('எனது விளையாட்டு வரலாற்றை எங்கே பார்க்கலாம்') || lowerText.includes('விளையாட்டு வரலாறு') || lowerText.includes('வரலாறு எங்கே') || lowerText === 'எனது விளையாட்டு வரலாற்றை எங்கே பார்க்கலாம்?';
    const isFamousTa      = lowerText.includes('பிரபலமான சதுரங்க ஆட்டங்களை') || lowerText.includes('famous games') || lowerText.includes('ஆட்டங்களை எங்கு படிக்கலாம்') || lowerText === 'பிரபலமான சதுரங்க ஆட்டங்களை நான் எங்கு படிக்கலாம்?';
    const isLanguageTa    = lowerText.includes('எனது சாட்பாட் மொழியை எவ்வாறு மாற்றுவது') || lowerText.includes('சாட்பாட் மொழி') || lowerText.includes('மொழியை மாற்ற') || lowerText === 'எனது சாட்பாட் மொழியை எவ்வாறு மாற்றுவது?';
    const isRatingTa      = lowerText.includes('எனது சதுரங்க elo மதிப்பீட்டை எங்கே பார்க்கலாம்') || lowerText.includes('elo மதிப்பீடு') || lowerText.includes('மதிப்பீட்டை எங்கே') || lowerText === 'எனது சதுரங்க elo மதிப்பீட்டை எங்கே பார்க்கலாம்?';
    const isLessonsTa     = lowerText.includes('நான் எங்கு வீடியோ பாடங்களை பார்க்கலாம்') || lowerText.includes('வீடியோ பாடங்கள்') || lowerText.includes('பாடங்களை பார்க்க') || lowerText === 'நான் எங்கு வீடியோ பாடங்களை பார்க்கலாம்?';
    const isAssessmentTa  = lowerText.includes('நான் எங்கு மதிப்பீட்டு தேர்வை எழுதலாம்') || lowerText.includes('மதிப்பீட்டுத் தேர்வு') || lowerText.includes('தேர்வு எழுத') || lowerText === 'நான் எங்கு மதிப்பீட்டு தேர்வை எழுதலாம்?';

    const isMobile = window.innerWidth < 1024;
    let interceptReply = '';

    if (isPlayGameEn) {
      if (isMobile) {
        interceptReply = "You can play games by clicking [Play Hub](/play) or [Play with AI](/play/ai) in the bottom navigation bar.";
      } else {
        interceptReply = "You can play games by clicking [Play Hub](/play) or [Play with AI](/play/ai) in the sidebar menu.";
      }
    } else if (isPlayGameTa) {
      if (isMobile) {
        interceptReply = "கீழே உள்ள நேவிகேஷன் பாரில் (Bottom Nav) [Play Hub](/play) அல்லது [Play with AI](/play/ai) என்பதை க்ளிக் செய்வதன் மூலம் நீங்கள் விளையாடலாம்.";
      } else {
        interceptReply = "பக்கவாட்டு மெனுவில் உள்ள [Play Hub](/play) அல்லது [Play with AI](/play/ai) ஐ க்ளிக் செய்வதன் மூலம் நீங்கள் விளையாடலாம்.";
      }
    } else if (isProfileEn) {
      interceptReply = "You can view your profile by clicking your name or the [Profile](/profile) option in the sidebar/navigation menu.";
    } else if (isProfileTa) {
      interceptReply = "பக்கவாட்டு மெனுவில் உள்ள [Profile](/profile) என்பதை க்ளிக் செய்வதன் மூலம் உங்கள் சுயவிவரத்தைக் காணலாம்.";
    } else if (isHistoryEn) {
      interceptReply = "You can see your game history and rating progression on your [Profile](/profile) page.";
    } else if (isHistoryTa) {
      interceptReply = "உங்கள் விளையாட்டு வரலாறு மற்றும் மதிப்பீட்டை உங்கள் [Profile](/profile) பக்கத்தில் பார்க்கலாம்.";
    } else if (isFamousEn) {
      interceptReply = "Click on [Famous Games](/games-library) in the sidebar/navigation menu to study historical games played by Chess Grandmasters.";
    } else if (isFamousTa) {
      interceptReply = "கிராண்ட்மாஸ்டர்கள் விளையாடிய ஆட்டங்களைப் படிக்க பக்கவாட்டு மெனுவில் உள்ள [Famous Games](/games-library) என்பதை க்ளிக் செய்யவும்.";
    } else if (isLanguageEn) {
      interceptReply = "You can change the chatbot language by clicking the 'தமிழ்' / 'ENGLISH' button at the top of the Mantri panel.";
    } else if (isLanguageTa) {
      interceptReply = "மந்திரி அரட்டை சாளரத்தின் மேலே உள்ள 'தமிழ்' / 'ENGLISH' பொத்தானை க்ளிக் செய்வதன் மூலம் நீங்கள் மொழியை மாற்றி அமைக்கலாம்.";
    } else if (isRatingEn) {
      interceptReply = "Your current ELO rating and progression graph are displayed on your [Dashboard](/dashboard) or [Profile](/profile) page.";
    } else if (isRatingTa) {
      interceptReply = "உங்கள் தற்போதைய ELO மதிப்பீடு மற்றும் வரைபடம் உங்கள் [Dashboard](/dashboard) அல்லது [Profile](/profile) பக்கத்தில் காட்டப்படும்.";
    } else if (isLessonsEn) {
      interceptReply = "Click on [Lessons](/lessons) in the sidebar/navigation menu to browse and watch our video lessons.";
    } else if (isLessonsTa) {
      interceptReply = "வீடியோ பாடங்களைக் காண பக்கவாட்டு மெனுவில் உள்ள [Lessons](/lessons) என்பதை க்ளிக் செய்யவும்.";
    } else if (isAssessmentEn) {
      interceptReply = "Go to [Assessment](/assessment) in the sidebar/navigation menu to take your CAT Chess Assessment.";
    } else if (isAssessmentTa) {
      interceptReply = "உங்கள் CAT சதுரங்க மதிப்பீட்டுத் தேர்வை எழுத பக்கவாட்டு மெனுவில் உள்ள [Assessment](/assessment) பகுதிக்குச் செல்லவும்.";
    }

    if (interceptReply) {
      setTimeout(() => {
        const replyIdx = messages.length + 1;
        setMessages(m => [...m, { role: 'bot', text: interceptReply }]);
        setLoading(false);
        if (voiceModeRef.current) readAloud(interceptReply, replyIdx);
      }, 300);
      return;
    }

    // --- 2. Standard Query Proxy Pipeline ---
    try {
      const res = await chatbotApi.ask(userText, activeFen, lang, playerColor);
      const botText = res.reply;
      const botMsgIdx = messages.length + 1;
      setMessages(m => [...m, { role: 'bot', text: botText }]);

      const nextSuggestions = getFollowUpSuggestions(botText, lang);
      setSuggestions(nextSuggestions);

      // Auto-play TTS — use ref (not state) to avoid stale closure bug
      if (voiceModeRef.current) {
        setTimeout(() => readAloud(botText, botMsgIdx), 300);
      }
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

  // ─── Mic button styles ────────────────────────────────────────────────────
  const micBtnClass = (() => {
    if (micState === 'recording') {
      return 'w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/40 active:scale-90 transition-all';
    }
    if (micState === 'processing') {
      return 'w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 bg-[#1E2E52] text-gray-400 cursor-not-allowed opacity-70';
    }
    return 'w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 bg-[#1E2E52] text-gray-300 hover:bg-[#2A3F6B] hover:text-white active:scale-90 transition-all border border-[#2A3F6B]';
  })();

  const micIcon = micState === 'recording' ? '⏹' : micState === 'processing' ? '⏳' : '🎙️';
  const micTitle = micState === 'recording'
    ? (lang === 'ta' ? 'நிறுத்து' : 'Stop recording')
    : micState === 'processing'
    ? (lang === 'ta' ? 'மாற்றுகிறது...' : 'Transcribing...')
    : (lang === 'ta' ? 'குரலில் கேள் (Tamil & English)' : 'Voice input (Tamil & English)');

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

        {/* Voice mode indicator */}
        {voiceMode && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/10 border border-gold/30 text-gold font-bold uppercase tracking-wider">
            🎙 Voice
          </span>
        )}

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
                  {renderMessageText(m.text)}
                </div>

                {/* Read Aloud button — available for BOTH Tamil and English */}
                {isBot && (
                  <button
                    onClick={() => readAloud(m.text, i)}
                    disabled={loading}
                    className={`p-1 rounded-md text-[11px] opacity-60 hover:opacity-100 transition-opacity active:scale-90 flex-shrink-0 ${
                      isSpeaking ? 'text-gold animate-bounce' : 'text-gray-400'
                    }`}
                    title={
                      isSpeaking
                        ? (lang === 'ta' ? 'நிறுத்து' : 'Stop Reading')
                        : (lang === 'ta' ? 'குரலில் கேள்' : 'Read Aloud (Voice)')
                    }
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
        {/* Mic button */}
        <button
          onClick={handleMicClick}
          disabled={micState === 'processing' || loading}
          className={micBtnClass}
          title={micTitle}
        >
          {micIcon}
        </button>

        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') sendMessage();
          }}
          placeholder={
            micState === 'recording'
              ? (lang === 'ta' ? '🔴 பதிவு செய்கிறது...' : '🔴 Recording...')
              : micState === 'processing'
              ? (lang === 'ta' ? '⏳ மாற்றுகிறது...' : '⏳ Transcribing...')
              : (lang === 'ta' ? 'சதுரங்கக் கேள்வி கேளுங்கள்...' : 'Ask a chess question…')
          }
          disabled={loading || micState === 'recording'}
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
