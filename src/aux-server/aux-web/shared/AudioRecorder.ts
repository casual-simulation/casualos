import { hasValue } from '@casual-simulation/aux-common';
import { Observable, Subject } from 'rxjs';
import { bufferTime, map, share } from 'rxjs/operators';

/**
 * Defines an interface for objects that can record and stream audio.
 */
export interface AudioRecorder {
    /**
     * Starts audio recording with the given options.
     */
    start(options?: AudioRecordingOptions): Promise<AudioRecording>;
}

/**
 * Defines an interface for objects that represent the options that can be specified when recording.
 */
export interface AudioRecordingOptions {
    /**
     * The MIME type that is preferred.
     * If not supported, then the default MIME type for the audio recorder will be used.
     */
    preferredMimeType?: string;

    /**
     * The bit rate that should be used for the audio.
     * Only supported for non-raw media types.
     * If not supported, then the default bit rate will be used.
     */
    bitsPerSecond?: number;

    /**
     * The sample rate that should be used for the audio.
     * Only supported for raw media types.
     * If not supported, then the default sample rate will be used.
     */
    sampleRate?: number;

    /**
     * The ideal number of miliseconds between dataAvailable callbacks.
     * If not supported, then the default buffer rate will be used.
     */
    bufferRateMiliseconds?: number;

    /**
     * Whether to compile a single large buffer for the audio recording that should be returned
     * with stop(). Defaults to true.
     */
    compileFullAudioBuffer?: boolean;

    /**
     * Whether to stream blobs via the dataAvailable observable.
     * Defaults to false.
     */
    stream?: boolean;
}

/**
 * Defines an interface that represents the action of recording some audio.
 */
export interface AudioRecording {
    /**
     * Stops the audio recording and resolves with the blob of recorded data.
     * Resolves with null if compiling the data was disabled.
     */
    stop(): Promise<Blob>;

    /**
     * Gets an observable that resolves whenever a new piece of data is available.
     */
    dataAvailable: Observable<Blob>;
}

/**
 * 192kbps
 */
export const DEFAULT_BITS_PER_SECOND = 192_000;

/**
 * 44.1kHz
 */
export const DEFAULT_SAMPLE_RATE = 44_100;

/**
 * 500ms
 */
export const DEFAULT_BUFFER_RATE = 500;

/**
 * Defines a class that implements the AudioRecorder interface for media formats. (mp3, webm, etc.)
 */
export class MediaAudioRecorder implements AudioRecorder {
    async start(options: AudioRecordingOptions = {}): Promise<AudioRecording> {
        const media = await getAudioMedia();

        const mimeType =
            hasValue(options.preferredMimeType) &&
            MediaRecorder.isTypeSupported(options.preferredMimeType)
                ? options.preferredMimeType
                : undefined;
        const recorder = new MediaRecorder(media, {
            mimeType,
            audioBitsPerSecond:
                options.bitsPerSecond ?? DEFAULT_BITS_PER_SECOND,
        });
        const compileBuffer = options.compileFullAudioBuffer ?? true;
        const stream = options.stream ?? false;
        const dataAvailable = new Subject<Blob>();

        let chunks = [] as Blob[];
        recorder.ondataavailable = (event) => {
            if (compileBuffer) {
                chunks.push(event.data);
            }

            if (stream) {
                dataAvailable.next(event.data);
            }
        };

        const finalBlobPromise = new Promise<Blob>((resolve, reject) => {
            try {
                recorder.onstop = () => {
                    try {
                        const blob = compileBuffer
                            ? new Blob(chunks, {
                                  type: recorder.mimeType,
                              })
                            : null;

                        resolve(blob);
                    } catch (ex) {
                        reject(ex);
                    }
                };
            } catch (ex) {
                reject(ex);
            }
        });

        const recording: AudioRecording = {
            stop: async () => {
                try {
                    console.log('[MediaAudioRecorder] Stop Recording.');
                    recorder.stop();
                    dataAvailable.complete();
                    return await finalBlobPromise;
                } finally {
                    for (let track of media.getTracks()) {
                        track.stop();
                    }
                }
            },
            dataAvailable: dataAvailable.pipe(
                bufferTime(options.bufferRateMiliseconds ?? 500),
                map(
                    (chunks) =>
                        new Blob(chunks, {
                            type: recorder.mimeType,
                        })
                ),
                share()
            ),
        };

        console.log('[MediaAudioRecorder] Start Recording.');
        recorder.start();

        return recording;
    }
}

/**
 * Defines an AudioRecorder that can record audio in a raw format.
 */
export class RawAudioRecorder implements AudioRecorder {
    /**
     * The MIME types that are supported by this AudioRecorder.
     */
    static readonly supportedMimeTypes = new Set(['audio/x-raw']);

    async start(options: AudioRecordingOptions = {}): Promise<AudioRecording> {
        let mimeType = options.preferredMimeType;
        if (
            !hasValue(options.preferredMimeType) ||
            !RawAudioRecorder.supportedMimeTypes.has(options.preferredMimeType)
        ) {
            mimeType = 'audio/x-raw';
        }

        const compileBuffer = options.compileFullAudioBuffer ?? true;
        const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
        const bufferRate = options.bufferRateMiliseconds ?? DEFAULT_BUFFER_RATE;
        const stream = options.stream ?? false;
        const audioContext = new AudioContext({
            sampleRate,
        });
        const media = await getAudioMedia();
        const dataAvailable = new Subject<Blob>();

        const compiledBuffers = [] as Float32Array[];
        const streamBuffers = [] as Float32Array[];
        const bufferRateSeconds = bufferRate / 1000;
        let bufferDurationSeconds = 0;

        // TODO: look into using AudioWorklets for this.
        // They need to support Safari & iOS.
        const recorder = audioContext.createScriptProcessor(4096, 1, 1);

        recorder.onaudioprocess = (event) => {
            const pcm = new Float32Array(event.inputBuffer.getChannelData(0));
            if (compileBuffer) {
                compiledBuffers.push(pcm);
            }

            if (stream) {
                streamBuffers.push(pcm);
                bufferDurationSeconds += event.inputBuffer.duration;

                if (bufferDurationSeconds >= bufferRateSeconds) {
                    // send data
                    const blob = new Blob(streamBuffers, {
                        type: mimeType,
                    });

                    streamBuffers.length = 0;
                    dataAvailable.next(blob);
                }
            }
        };

        recorder.connect(audioContext.destination);
        const source = audioContext.createMediaStreamSource(media);

        const recording: AudioRecording = {
            stop: async () => {
                try {
                    console.log('[RawAudioRecorder] Stop Recording.');
                    await audioContext.suspend();
                    await audioContext.close();
                    dataAvailable.complete();

                    if (compileBuffer) {
                        return new Blob(compiledBuffers, {
                            type: mimeType,
                        });
                    }

                    return null;
                } finally {
                    for (let track of media.getTracks()) {
                        track.stop();
                    }
                }
            },
            dataAvailable,
        };

        console.log('[RawAudioRecorder] Start Recording.');
        source.connect(recorder);

        return recording;
    }
}

/**
 * Creates the default audio recorder that uses the RawAudioRecorder for audio/x-raw and the MediaAudioRecorder for all other queries.
 */
export function createDefaultAudioRecorder(): AudioRecorder {
    let raw = new RawAudioRecorder();
    let media = new MediaAudioRecorder();
    return {
        start(options) {
            if (
                hasValue(options.preferredMimeType) &&
                RawAudioRecorder.supportedMimeTypes.has(
                    options.preferredMimeType
                )
            ) {
                return raw.start(options);
            } else {
                return media.start(options);
            }
        },
    };
}

async function getAudioMedia() {
    return await navigator.mediaDevices.getUserMedia({
        audio: true,
    });
}
