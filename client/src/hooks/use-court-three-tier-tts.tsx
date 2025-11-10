import { useState, useCallback } from "react";

interface TTSOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  voice?: string;
  speed?: number;
}

interface UseCourtThreeTierTTSReturn {
  speak: (text: string, options?: TTSOptions) => Promise<void>;
  stop: () => void;
  isSpeaking: boolean;
  isLoading: boolean;
}

export function useCourtThreeTierTTS(): UseCourtThreeTierTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  const speak = useCallback(async (text: string, options: TTSOptions = {}) => {
    console.log('Court TTS: Starting three-tier speech (ElevenLabs → OpenAI "ash" → Browser)');

    let callbacksFired = false;

    try {
      setIsLoading(true);

      // Stop any current audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      // TIER 1: Try ElevenLabs TTS first (multilingual for Hinglish)
      try {
        console.log('Court TTS: Trying ElevenLabs TTS (Tier 1)...');
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/court/tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: text,
            voice: options.voice || "3AMU7jXQuQa3oRvRqUmb",
            speed: options.speed || 1.0
          })
        });

        if (response.ok) {
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);

          audio.onloadeddata = () => {
            console.log('Court TTS: ElevenLabs audio loaded successfully');
            setIsLoading(false);
            setIsSpeaking(true);
            if (!callbacksFired && options.onStart) {
              callbacksFired = true;
              options.onStart();
            }
          };

          audio.onended = () => {
            console.log('Court TTS: ElevenLabs playback ended');
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            if (options.onEnd) options.onEnd();
          };

          audio.onerror = (e) => {
            console.error('Court TTS: ElevenLabs audio playback error', e);
            setIsSpeaking(false);
            setIsLoading(false);
            URL.revokeObjectURL(audioUrl);
            if (!callbacksFired && options.onError) {
              callbacksFired = true;
              options.onError('ElevenLabs audio playback failed');
            }
          };

          setCurrentAudio(audio);
          await audio.play();
          return; // Success with ElevenLabs
        } else {
          throw new Error(`ElevenLabs TTS failed: ${response.status}`);
        }
      } catch (elevenlabsError) {
        console.warn('Court TTS: ElevenLabs failed, trying OpenAI TTS with "ash" voice (Tier 2)...', elevenlabsError);
        
        // TIER 2: Fallback to OpenAI TTS with "ash" voice
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/court/tts-openai`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: text
            })
          });

          if (response.ok) {
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            audio.onloadeddata = () => {
              console.log('Court TTS: OpenAI (ash) audio loaded successfully');
              setIsLoading(false);
              setIsSpeaking(true);
              if (!callbacksFired && options.onStart) {
                callbacksFired = true;
                options.onStart();
              }
            };

            audio.onended = () => {
              console.log('Court TTS: OpenAI (ash) playback ended');
              setIsSpeaking(false);
              URL.revokeObjectURL(audioUrl);
              if (options.onEnd) options.onEnd();
            };

            audio.onerror = () => {
              console.error('Court TTS: OpenAI (ash) audio playback failed');
              setIsSpeaking(false);
              setIsLoading(false);
              URL.revokeObjectURL(audioUrl);
              if (!callbacksFired && options.onError) {
                callbacksFired = true;
                options.onError('OpenAI TTS audio playback failed');
              }
            };

            setCurrentAudio(audio);
            await audio.play();
            return; // Success with OpenAI TTS
          } else {
            throw new Error(`OpenAI TTS failed: ${response.status}`);
          }
        } catch (openaiError) {
          console.warn('Court TTS: OpenAI TTS failed, using Browser speech (Tier 3)...', openaiError);
        }
      }

      // TIER 3: Final fallback to Browser Speech API
      setIsLoading(false);
      
      if (!callbacksFired && options.onError) {
        callbacksFired = true;
        options.onError('API providers unavailable, using browser fallback');
      }

      console.log('Court TTS: Using browser Speech Synthesis');
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-IN';
      utterance.rate = options.speed || 1.0;

      utterance.onstart = () => {
        setIsSpeaking(true);
        // Don't fire onStart again if already fired
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        if (options.onEnd) options.onEnd();
      };

      utterance.onerror = (error) => {
        console.error('Court TTS: Browser speech also failed:', error);
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);

    } catch (error) {
      console.error('Court TTS: Complete failure:', error);
      setIsLoading(false);
      setIsSpeaking(false);
      
      if (!callbacksFired && options.onError) {
        callbacksFired = true;
        options.onError(error instanceof Error ? error.message : 'Speech generation failed');
      }
    }
  }, [currentAudio]);

  const stop = useCallback(() => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [currentAudio]);

  return { speak, stop, isSpeaking, isLoading };
}
