/**
 * Web Audio API Call Sound Synthesizer
 * Provides zero-asset, zero-latency, high-reliability ringing tones for WebRTC calls.
 */

class CallSoundService {
  private ctx: AudioContext | null = null;
  private outgoingInterval: any = null;
  private incomingInterval: any = null;
  private isOutgoingPlaying = false;
  private isIncomingPlaying = false;

  private getAudioContext(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Plays the standard outgoing ringback cadence (Caller hearing "Drrr... Drrr..."):
   * Dual frequencies (440Hz + 480Hz) pulsed for 1.8s tone, followed by 2.2s silence.
   */
  public startOutgoingRing(): void {
    if (typeof window === "undefined") return;
    if (this.isOutgoingPlaying) return;
    this.stopAll();
    this.isOutgoingPlaying = true;

    const playPulse = () => {
      if (!this.isOutgoingPlaying) return;
      try {
        const ctx = this.getAudioContext();
        const now = ctx.currentTime;

        // Dual Tone Multiple Frequency (US/UK standard telephone ringback: 440Hz & 480Hz)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.type = "sine";
        osc1.frequency.setValueAtTime(440, now);

        osc2.type = "sine";
        osc2.frequency.setValueAtTime(480, now);

        // Smooth fade in and fade out envelope
        gainNode.gain.setValueAtTime(0.001, now);
        gainNode.gain.exponentialRampToValueAtTime(0.12, now + 0.1);
        gainNode.gain.setValueAtTime(0.12, now + 1.7);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.85);
        osc2.stop(now + 1.85);
      } catch (err) {
        console.warn("[SoundService] Outgoing ring pulse error:", err);
      }
    };

    // Play initial pulse immediately, then loop every 4 seconds
    playPulse();
    this.outgoingInterval = setInterval(playPulse, 4000);
  }

  /**
   * Plays an incoming call ringtone (Callee hearing a melodious VoIP chime):
   * Harmonic chime sequence (C5, E5, G5, B5) cycling in a pleasant cadence.
   */
  public startIncomingRingtone(): void {
    if (typeof window === "undefined") return;
    if (this.isIncomingPlaying) return;
    this.stopAll();
    this.isIncomingPlaying = true;

    const playChimeSequence = () => {
      if (!this.isIncomingPlaying) return;
      try {
        const ctx = this.getAudioContext();
        const startTime = ctx.currentTime;
        // Melodic notes in Hz: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
        const notes = [523.25, 659.25, 783.99, 1046.5];

        notes.forEach((freq, index) => {
          const noteTime = startTime + index * 0.18;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, noteTime);

          gain.gain.setValueAtTime(0.001, noteTime);
          gain.gain.exponentialRampToValueAtTime(0.2, noteTime + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.5);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(noteTime);
          osc.stop(noteTime + 0.55);
        });
      } catch (err) {
        console.warn("[SoundService] Incoming ringtone error:", err);
      }
    };

    // Play first chime sequence immediately, then loop every 2.4 seconds
    playChimeSequence();
    this.incomingInterval = setInterval(playChimeSequence, 2400);
  }

  /**
   * Stop all active ringtones and sounds immediately.
   */
  public stopAll(): void {
    this.isOutgoingPlaying = false;
    this.isIncomingPlaying = false;

    if (this.outgoingInterval) {
      clearInterval(this.outgoingInterval);
      this.outgoingInterval = null;
    }
    if (this.incomingInterval) {
      clearInterval(this.incomingInterval);
      this.incomingInterval = null;
    }
  }
}

export const soundService = new CallSoundService();
