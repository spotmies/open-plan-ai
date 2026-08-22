import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@/services/monitoring/logger';
import { aiAssistantTransport } from '../transport';

// Must match SARVAM_STT_SAMPLE_RATE's default on the backend
// (open-plan-ai-backend/src/config/index.ts) — both sides hardcode 16000
// rather than negotiating it, same as the rest of the Sarvam config.
const TARGET_SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = 1600; // 100ms @ 16kHz — matches the brief's 20-100ms guidance

export type DictationState = 'idle' | 'connecting' | 'listening' | 'error';

interface UseSarvamDictationOptions {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function isDictationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    navigator.mediaDevices?.getUserMedia &&
    window.AudioContext &&
    typeof AudioWorkletNode !== 'undefined'
  );
}

/** Joins committed text with a new segment, normalizing the boundary whitespace. */
function joinText(base: string, addition: string): string {
  if (!addition) return base;
  if (!base) return addition;
  return /\s$/.test(base) ? base + addition : `${base} ${addition}`;
}

/**
 * Owns the mic → AudioWorklet → socket pipeline for live dictation into the
 * Assistant composer. One "dictation segment" = one Sarvam session: starting
 * always snapshots the composer's current text as the base to append to, and
 * stopping (user click, error, or send) fully tears the segment down —
 * resuming afterward starts a fresh segment on top of whatever text is now
 * in the box. See assistant/SARVAM_STT.md (backend repo) for the full design.
 */
export function useSarvamDictation({ value, onChange, disabled }: UseSarvamDictationOptions) {
  const [dictationState, setDictationState] = useState<DictationState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const unsubsRef = useRef<Array<() => void>>([]);

  // "Latest value" ref — partial/final handlers fire from socket callbacks
  // registered once per dictation segment and must always append onto the
  // most recent onChange, not a stale closure's.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  const baseTextRef = useRef('');
  // What we last wrote via onChange — lets a partial/final handler tell "nothing
  // changed" apart from "the user edited the textarea since our last update" (e.g.
  // deleted a sentence). On divergence we rebase onto their edit instead of
  // reappending text they just deleted.
  const lastEmittedRef = useRef('');
  const lastCommittedIdxRef = useRef(-1);
  // Guards against a partial/final arriving after we've already torn the
  // segment down (stop/send/unmount) but before the socket handler unsub runs.
  const activeRef = useRef(false);

  const teardownAudioPipeline = useCallback(() => {
    try {
      workletNodeRef.current?.port.postMessage('stop');
    } catch {
      // worklet already gone — nothing to signal
    }
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
  }, []);

  const teardownSocketSubs = useCallback(() => {
    unsubsRef.current.forEach((unsub) => unsub());
    unsubsRef.current = [];
  }, []);

  /** Fully ends the current dictation segment. `silent` skips the idle-state UI flip (used on send/unmount, where a different state follows immediately or the component is gone). */
  const endSegment = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!activeRef.current && dictationState === 'idle') return;
      activeRef.current = false;
      teardownAudioPipeline();
      teardownSocketSubs();
      aiAssistantTransport.stopDictation();
      if (!opts?.silent) setDictationState('idle');
    },
    [dictationState, teardownAudioPipeline, teardownSocketSubs],
  );

  const startDictation = useCallback(async () => {
    if (disabled || dictationState === 'connecting' || dictationState === 'listening') return;

    if (!isDictationSupported()) {
      setDictationState('error');
      setErrorMessage('Voice dictation is not supported in this browser.');
      toast.error('Voice dictation is not supported in this browser.');
      return;
    }

    setErrorMessage(null);
    setDictationState('connecting');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      logger.warn('[dictation] getUserMedia denied/failed', { err });
      setDictationState('error');
      setErrorMessage('Microphone access was denied.');
      return;
    }
    streamRef.current = stream;
    stream.getAudioTracks()[0]?.addEventListener('ended', () => endSegment());

    try {
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      await audioCtx.audioWorklet.addModule('/worklets/pcm-downsampler-processor.js');

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const workletNode = new AudioWorkletNode(audioCtx, 'pcm-downsampler-processor', {
        processorOptions: { targetSampleRate: TARGET_SAMPLE_RATE, chunkSamples: CHUNK_SAMPLES },
      });
      workletNodeRef.current = workletNode;
      workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (!activeRef.current) return;
        aiAssistantTransport.sendAudioChunk(event.data);
      };

      // Deliberately not connected to audioCtx.destination — we must never
      // play the mic back through the speakers.
      source.connect(workletNode);
    } catch (err) {
      logger.error('[dictation] failed to initialize audio pipeline', { err });
      teardownAudioPipeline();
      setDictationState('error');
      setErrorMessage('Could not access your microphone.');
      return;
    }

    baseTextRef.current = valueRef.current;
    lastEmittedRef.current = valueRef.current;
    lastCommittedIdxRef.current = -1;
    activeRef.current = true;

    aiAssistantTransport.connect();

    unsubsRef.current = [
      aiAssistantTransport.onSttPartial((text, idx) => {
        if (!activeRef.current || idx <= lastCommittedIdxRef.current) return;
        if (valueRef.current !== lastEmittedRef.current) baseTextRef.current = valueRef.current;
        const next = joinText(baseTextRef.current, text);
        lastEmittedRef.current = next;
        onChangeRef.current(next);
      }),
      aiAssistantTransport.onSttFinal((text, idx) => {
        if (!activeRef.current || idx <= lastCommittedIdxRef.current) return;
        lastCommittedIdxRef.current = idx;
        if (valueRef.current !== lastEmittedRef.current) baseTextRef.current = valueRef.current;
        baseTextRef.current = joinText(baseTextRef.current, text);
        lastEmittedRef.current = baseTextRef.current;
        onChangeRef.current(baseTextRef.current);
      }),
      aiAssistantTransport.onSttError((code, message, fatal) => {
        toast.error(message || 'Dictation hit an error.');
        logger.warn('[dictation] stt:error', { code, message, fatal });
        if (fatal) {
          activeRef.current = false;
          teardownAudioPipeline();
          teardownSocketSubs();
          setDictationState('error');
          setErrorMessage(message);
        }
      }),
    ];

    // Server buffers audio that arrives before its own Sarvam session is
    // fully open, so we don't gate streaming on stt:ready — starting the
    // worklet immediately keeps perceived latency lowest.
    aiAssistantTransport.startDictation({});
    setDictationState('listening');
  }, [disabled, dictationState, endSegment, teardownAudioPipeline, teardownSocketSubs]);

  const toggleDictation = useCallback(() => {
    if (dictationState === 'listening' || dictationState === 'connecting') {
      endSegment();
    } else {
      void startDictation();
    }
  }, [dictationState, endSegment, startDictation]);

  /** Used by the composer's Send button: stop capturing and flip the mic icon back to idle — it's a separate button from send/stop, so it needs its own reset. */
  const stopForSend = useCallback(() => {
    if (dictationState === 'listening' || dictationState === 'connecting') {
      endSegment();
    }
  }, [dictationState, endSegment]);

  // Auto-stop if the composer becomes disabled mid-dictation (e.g. the
  // assistant starts responding to a different in-flight action).
  useEffect(() => {
    if (disabled && (dictationState === 'listening' || dictationState === 'connecting')) {
      endSegment({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  useEffect(() => {
    return () => {
      if (activeRef.current) {
        activeRef.current = false;
        teardownAudioPipeline();
        teardownSocketSubs();
        aiAssistantTransport.stopDictation();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    dictationState,
    errorMessage,
    toggleDictation,
    stopForSend,
    isSupported: isDictationSupported(),
  };
}
