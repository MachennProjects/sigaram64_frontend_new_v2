/**
 * ─── Sarvam AI Voice Configuration ──────────────────────────────────────────
 * Developer-only settings for the Mantri chatbot voice.
 * Change speakers and pace here — no UI involved.
 *
 * Available Sarvam Speakers (bulbul:v3):
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Language    │ Male Speakers          │ Female Speakers                  │
 * │─────────────│────────────────────────│──────────────────────────────────│
 * │ Tamil (ta)  │ ratan, rohan           │ ishita, ritu                     │
 * │ English (en)│ ratan                  │ ishita                           │
 * │ Hindi (hi)  │ shubh, ashutosh        │ priya, suhani                    │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Pace: 0.5 (slow) → 1.0 (natural) → 2.0 (fast)
 * Temperature: 0.01 (flat/consistent) → 0.6 (natural) → 1.0 (expressive)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const VOICE_CONFIG = {
  /** Speaker for Tamil TTS (ta-IN) */
  tamil: {
    speaker: 'ishita',    // Change to: 'ratan' | 'rohan' | 'ritu'
    pace: 1.0,
    temperature: 0.6,
  },

  /** Speaker for English TTS (en-IN) */
  english: {
    speaker: 'ishita',    // Change to: 'ratan'
    pace: 1.0,           // Slowed down — range: 0.5 (slowest) → 1.0 (natural) → 2.0 (fastest)
    temperature: 0.6,
  },
} as const;

export type SarvamSpeaker = 'ishita' | 'ratan' | 'rohan' | 'ritu' | 'priya' | 'shubh' | 'suhani' | 'ashutosh';
