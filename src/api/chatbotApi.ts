// SIGARAM64 — Chatbot "Mantri" API
import { apiPost, apiPostFormData } from './client';

export const chatbotApi = {
  /** Send a text message to the Mantri chatbot */
  async ask(message: string, fen?: string, language?: 'en' | 'ta'): Promise<{
    reply: string;
    detectedLanguage: 'en' | 'ta';
  }> {
    return apiPost('/api/chatbot/ask', { message, fen, language });
  },

  /** Convert speech audio to text (Sarvam for Tamil, Whisper for English) */
  async speechToText(audioFile: File, language: 'ta' | 'en' = 'ta'): Promise<{ transcription: string }> {
    const formData = new FormData();
    formData.append('audio', audioFile);
    formData.append('language', language);
    return apiPostFormData('/api/chatbot/stt', formData);
  },

  /** Convert text to speech audio (Sarvam for Tamil, ElevenLabs/Azure for English) */
  async textToSpeech(text: string, language: 'ta' | 'en' = 'ta', provider = 'elevenlabs'): Promise<{ audio: string }> {
    return apiPost('/api/chatbot/tts', { text, language, provider });
  },

  /** Full voice loop: audio in → transcribe → chatbot → synthesize → audio out */
  async voice(audioFile: File, fen?: string, language: 'ta' | 'en' = 'ta', provider = 'elevenlabs'): Promise<{
    userText: string;
    botText: string;
    audio: string;
  }> {
    const formData = new FormData();
    formData.append('audio', audioFile);
    if (fen) formData.append('fen', fen);
    formData.append('language', language);
    formData.append('provider', provider);
    return apiPostFormData('/api/chatbot/voice', formData);
  },
};
