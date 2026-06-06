// src/lib/audio-to-wav.ts
// Converts any recorded audio Blob (e.g. webm/opus from Android Chrome) into a
// 16-bit PCM WAV data URI. Gemini supports WAV/MP3/OGG/AAC/FLAC but NOT webm,
// so this conversion is what makes mobile voice input work reliably.

/**
 * Decode an audio Blob and re-encode it as a 16 kHz mono WAV data URI.
 * 16 kHz mono is ideal for speech recognition and keeps the payload small.
 */
export async function blobToWavDataUri(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();

  // Decode the compressed audio (webm/opus, ogg, mp4…) into raw PCM samples.
  const AudioCtx =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  const decodeCtx: AudioContext = new AudioCtx();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    decodeCtx.close().catch(() => {});
  }

  const targetSampleRate = 16000;
  const monoData = downmixToMono(audioBuffer);
  const resampled = resampleLinear(
    monoData,
    audioBuffer.sampleRate,
    targetSampleRate
  );
  const wavBuffer = encodeWav(resampled, targetSampleRate);

  // Convert to base64 without blowing the call stack on large buffers.
  const base64 = arrayBufferToBase64(wavBuffer);
  return `data:audio/wav;base64,${base64}`;
}

function downmixToMono(buffer: AudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels;
  if (channels === 1) return buffer.getChannelData(0);
  const length = buffer.length;
  const out = new Float32Array(length);
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) out[i] += data[i] / channels;
  }
  return out;
}

function resampleLinear(
  data: Float32Array,
  fromRate: number,
  toRate: number
): Float32Array {
  if (fromRate === toRate) return data;
  const ratio = fromRate / toRate;
  const newLength = Math.round(data.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, data.length - 1);
    const frac = idx - i0;
    result[i] = data[i0] * (1 - frac) + data[i1] * frac;
  }
  return result;
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, s, true);
  }

  return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunkSize) as unknown as number[]
    );
  }
  return btoa(binary);
}
