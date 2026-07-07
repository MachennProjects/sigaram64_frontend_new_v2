// SIGARAM64 — Chatbot "Mantri" API
import { apiPost, apiPostFormData } from './client';

export const chatbotApi = {
  /** Send a text message to the Mantri chatbot */
  async ask(message: string, fen?: string, language?: 'en' | 'ta', playerColor?: 'white' | 'black'): Promise<{
    reply: string;
    detectedLanguage: 'en' | 'ta';
  }> {
    return apiPost('/api/chatbot/ask', { message, fen, language, playerColor });
  },

  /** Convert speech audio to text (Sarvam Saaras v3 — Tamil & English) */
  async speechToText(audioFile: File, language: 'ta' | 'en' = 'ta'): Promise<{ transcription: string }> {
    const formData = new FormData();
    formData.append('audio', audioFile);
    formData.append('language', language);
    return apiPostFormData('/api/chatbot/stt', formData);
  },

  /**
   * Convert text to speech audio (Sarvam Bulbul v3)
   * @param speaker Sarvam speaker name — e.g. 'ishita', 'ratan'
   * @param pace    Speaking speed 0.5 (slow) → 1.0 (natural) → 2.0 (fast)
   */
  async textToSpeech(
    text: string,
    language: 'ta' | 'en' = 'ta',
    speaker = 'ishita',
    pace = 1.0
  ): Promise<{ audio: string }> {
    return apiPost('/api/chatbot/tts', { text, language, speaker, pace, provider: 'sarvam' });
  },

  /** Full voice loop: audio in → transcribe → chatbot → synthesize → audio out */
  async voice(
    audioFile: File,
    fen?: string,
    language: 'ta' | 'en' = 'ta',
    speaker = 'ishita',
    playerColor?: 'white' | 'black'
  ): Promise<{
    userText: string;
    botText: string;
    audio: string;
  }> {
    const formData = new FormData();
    formData.append('audio', audioFile);
    if (fen) formData.append('fen', fen);
    formData.append('language', language);
    formData.append('speaker', speaker);
    formData.append('provider', 'sarvam');
    if (playerColor) formData.append('playerColor', playerColor);
    return apiPostFormData('/api/chatbot/voice', formData);
  },
};
