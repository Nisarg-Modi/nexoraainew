// Notification sound using Web Audio API
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

export const playNotificationSound = () => {
  try {
    const ctx = getAudioContext();
    
    // Resume audio context if suspended (required for autoplay policies)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Pleasant notification tone - two quick ascending notes
    oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
    oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1); // C#6
    
    oscillator.type = 'sine';

    // Quick fade in and out for a soft notification sound
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.12);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.25);
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
};

// Play a softer sound for sent messages
export const playSentSound = () => {
  try {
    const ctx = getAudioContext();
    
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Soft "whoosh" sound for sent messages
    oscillator.frequency.setValueAtTime(600, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
    
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  } catch (error) {
    console.error('Error playing sent sound:', error);
  }
};
