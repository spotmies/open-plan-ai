import { logger } from '@/services/monitoring/logger';

let completeAudio: HTMLAudioElement | null = null;
let messageAudio: HTMLAudioElement | null = null;

/** Plays the short "ding" effect used when a task or issue is marked complete. */
export function playCompleteSound() {
  if (!completeAudio) {
    completeAudio = new Audio('/sounds/task-complete.mp3');
    completeAudio.volume = 0.5;
  }
  // Restart from the beginning in case the previous play is still finishing.
  completeAudio.currentTime = 0;
  completeAudio.play().catch((err) => {
    // Autoplay can be blocked before the user has interacted with the page; not worth surfacing.
    logger.debug('Unable to play completion sound', { error: err });
  });
}

/** Plays the short notification chime used when a new chat message arrives. */
export function playMessageSound() {
  if (!messageAudio) {
    messageAudio = new Audio('/sounds/task-complete.mp3');
    messageAudio.volume = 0.5;
  }
  // Restart from the beginning in case the previous play is still finishing.
  messageAudio.currentTime = 0;
  messageAudio.play().catch((err) => {
    // Autoplay can be blocked before the user has interacted with the page; not worth surfacing.
    logger.debug('Unable to play message sound', { error: err });
  });
}
