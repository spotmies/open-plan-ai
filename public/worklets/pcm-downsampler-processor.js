// AudioWorkletProcessor that downmixes to mono, resamples from the audio
// context's native sample rate (typically 44.1/48 kHz) to a target rate
// (16 kHz, to match SARVAM_STT_SAMPLE_RATE on the backend), converts
// Float32 -> Int16 little-endian, and posts fixed-size chunks back to the
// main thread as transferable ArrayBuffers.
//
// Runs in the AudioWorkletGlobalScope: no imports, no access to window/DOM,
// only what's passed via `options.processorOptions` and messages over
// `this.port`. See open-plan-ai-backend/assistant/SARVAM_STT.md §5 for why
// this exists instead of MediaRecorder (which defaults to WebM/Opus —
// unsupported by Sarvam's streaming WebSocket).
//
// Resampling uses continuous linear interpolation: `pendingInput` retains
// any input samples not yet fully consumed, and `nextSrcPos` (a fractional
// index into pendingInput) carries the interpolation phase across `process()`
// call boundaries (128-sample render quanta) so there's no phase discontinuity
// — i.e. it behaves as one continuous resample of the whole stream, not an
// independent resample per 128-sample block.
class PCMDownsamplerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options && options.processorOptions ? options.processorOptions : {};
    this.targetSampleRate = opts.targetSampleRate || 16000;
    // `sampleRate` is a global in AudioWorkletGlobalScope — the context's native rate.
    this.ratio = sampleRate / this.targetSampleRate;
    this.chunkTargetSamples = opts.chunkSamples || 1600; // 100ms @ 16kHz

    this.pendingInput = new Float32Array(0);
    this.nextSrcPos = 0;
    this.outChunks = [];
    this.outLength = 0;
    this.stopped = false;

    this.port.onmessage = (event) => {
      if (event.data === 'stop') {
        // Flush whatever's left (< one full chunk) rather than dropping the
        // last ~100ms of speech on every stop.
        this._flushOutput(true);
        this.stopped = true;
      }
    };
  }

  process(inputs) {
    if (this.stopped) return false;

    const input = inputs[0];
    if (input && input.length > 0 && input[0] && input[0].length > 0) {
      const mono = this._toMono(input);
      this._appendInput(mono);
      this._resample();
    }

    return true;
  }

  _toMono(input) {
    if (input.length === 1) return input[0];
    const length = input[0].length;
    const mono = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (let ch = 0; ch < input.length; ch++) sum += input[ch][i];
      mono[i] = sum / input.length;
    }
    return mono;
  }

  _appendInput(chunk) {
    const merged = new Float32Array(this.pendingInput.length + chunk.length);
    merged.set(this.pendingInput, 0);
    merged.set(chunk, this.pendingInput.length);
    this.pendingInput = merged;
  }

  _resample() {
    const out = [];
    // Need idx0=floor(nextSrcPos) and idx0+1 both within pendingInput.
    while (this.nextSrcPos + 1 < this.pendingInput.length) {
      const idx0 = Math.floor(this.nextSrcPos);
      const frac = this.nextSrcPos - idx0;
      const s0 = this.pendingInput[idx0];
      const s1 = this.pendingInput[idx0 + 1];
      const sample = s0 + (s1 - s0) * frac;
      const clamped = Math.max(-1, Math.min(1, sample));
      out.push(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
      this.nextSrcPos += this.ratio;
    }

    // Drop the fully-consumed prefix, keeping the fractional phase intact.
    const dropCount = Math.floor(this.nextSrcPos);
    if (dropCount > 0) {
      this.pendingInput = this.pendingInput.slice(dropCount);
      this.nextSrcPos -= dropCount;
    }

    if (out.length === 0) return;
    this._enqueueOutput(out);
  }

  _enqueueOutput(samples) {
    this.outChunks.push(samples);
    this.outLength += samples.length;
    while (this.outLength >= this.chunkTargetSamples) {
      this._flushOutput();
    }
  }

  _flushOutput(forceAll) {
    if (this.outLength === 0) return;
    const takeLength = forceAll ? this.outLength : Math.min(this.outLength, this.chunkTargetSamples);
    if (takeLength === 0) return;
    const int16 = new Int16Array(takeLength);
    let written = 0;
    while (written < takeLength && this.outChunks.length > 0) {
      const chunk = this.outChunks[0];
      const remaining = takeLength - written;
      if (chunk.length <= remaining) {
        int16.set(chunk, written);
        written += chunk.length;
        this.outChunks.shift();
      } else {
        int16.set(chunk.slice(0, remaining), written);
        this.outChunks[0] = chunk.slice(remaining);
        written += remaining;
      }
    }
    this.outLength -= written;
    this.port.postMessage(int16.buffer, [int16.buffer]);
  }
}

registerProcessor('pcm-downsampler-processor', PCMDownsamplerProcessor);
