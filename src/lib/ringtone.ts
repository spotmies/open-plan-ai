import { logger } from '@/services/monitoring/logger';

let ringtoneAudio: HTMLAudioElement | null = null;

function getRingtoneAudio() {
  if (!ringtoneAudio) {
    ringtoneAudio = new Audio('/sounds/ringtone_call.mp3');
    ringtoneAudio.loop = true;
    ringtoneAudio.volume = 0.6;
  }
  return ringtoneAudio;
}

/**
 * Starts the call ringtone looping. Used for both sides of a ring — an
 * outgoing call ("trying to connect to") and an incoming call ("trying to
 * connect with you") share the same sound.
 */
export function playRingtone() {
  const audio = getRingtoneAudio();
  audio.currentTime = 0;
  audio.play().catch((err) => {
    // Autoplay can be blocked before the user has interacted with the page; not worth surfacing.
    logger.debug('Unable to play ringtone', { error: err });
  });
}

/** Stops the ringtone — call the instant the ring ends for any reason: answered, declined, cancelled, or timed out with no answer. */
export function stopRingtone() {
  if (!ringtoneAudio) return;
  ringtoneAudio.pause();
  ringtoneAudio.currentTime = 0;
}
