import { useCallback, useRef } from "react";

// Gera um beep sintético via Web Audio API — sem ficheiros externos necessários
export function useOrderNotification() {
  const audioCtxRef = useRef(null);

  const playSound = useCallback(() => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;

      const playBeep = (startTime, freq, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.4, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      // Dois beeps ascendentes — som de notificação
      playBeep(ctx.currentTime, 880, 0.15);
      playBeep(ctx.currentTime + 0.18, 1100, 0.2);
    } catch (e) {
      // Browser pode bloquear AudioContext sem interação prévia — ignorar silenciosamente
    }
  }, []);

  return { playSound };
}