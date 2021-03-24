import {
    RecordedFile,
    Recording,
    RecordingOptions,
} from '@casual-simulation/aux-common';

/**
 * Defines a class that is a helper for making audio and video recordings.
 */
export class Recorder {
    async start(options: RecordingOptions): Promise<MediaRecording> {
        if (options.video && options.screen) {
            if (options.audio) {
                console.log(
                    '[Recorder] Recording video and screen with audio.'
                );
            } else {
                console.log('[Recorder] Recording video and screen.');
            }
            const videoMedia = await navigator.mediaDevices.getUserMedia({
                audio: options.audio,
                video: options.video,
            });
            const screenMedia = await navigator.mediaDevices.getDisplayMedia({
                audio: false,
                video: options.screen,
            });

            return this._recordMedia([
                {
                    stream: videoMedia,
                    options: {
                        audio: options.audio,
                        video: true,
                        screen: false,
                    },
                },
                {
                    stream: screenMedia,
                    options: {
                        audio: false,
                        video: false,
                        screen: true,
                    },
                },
            ]);
        } else if (options.video) {
            if (options.audio) {
                console.log('[Recorder] Recording video with audio.');
            } else {
                console.log('[Recorder] Recording video.');
            }
            const videoMedia = await navigator.mediaDevices.getUserMedia({
                audio: options.audio,
                video: true,
            });

            return this._recordMedia([
                {
                    stream: videoMedia,
                    options: {
                        audio: options.audio,
                        video: true,
                        screen: false,
                    },
                },
            ]);
        } else if (options.screen) {
            if (options.audio) {
                console.log('[Recorder] Recording screen with audio.');
            } else {
                console.log('[Recorder] Recording screen.');
            }
            const screenMedia = await navigator.mediaDevices.getDisplayMedia({
                audio: options.audio,
                video: true,
            });

            return this._recordMedia([
                {
                    stream: screenMedia,
                    options: {
                        audio: options.audio,
                        video: false,
                        screen: true,
                    },
                },
            ]);
        } else if (options.audio) {
            console.log('[Recorder] Recording audio.');
            const audioMedia = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });

            return this._recordMedia([
                {
                    stream: audioMedia,
                    options: {
                        audio: true,
                        video: false,
                        screen: false,
                    },
                },
            ]);
        }

        throw new Error(
            'Cannot produce a recording when all the options are set to false.'
        );
    }

    private async _recordMedia(
        media: { stream: MediaStream; options: RecordingOptions }[]
    ) {
        const promises = media.map((media) => {
            const recorder = new MediaRecorder(media.stream);

            let chunks = [] as Blob[];
            recorder.ondataavailable = (event) => {
                chunks.push(event.data);
            };

            const finalBlobPromise = new Promise<RecordedFile>(
                (resolve, reject) => {
                    try {
                        recorder.onstop = () => {
                            try {
                                const data = new Blob(chunks, {
                                    type: recorder.mimeType,
                                });

                                resolve({
                                    containsAudio:
                                        media.options.audio &&
                                        media.stream.getAudioTracks().length >
                                            0,
                                    containsVideo:
                                        media.options.video &&
                                        media.stream.getVideoTracks().length >
                                            0,
                                    containsScreen:
                                        media.options.screen &&
                                        media.stream.getVideoTracks().length >
                                            0,
                                    data,
                                });
                            } catch (ex) {
                                reject(ex);
                            }
                        };
                    } catch (ex) {
                        reject(ex);
                    }
                }
            );

            recorder.start();

            return {
                stop: async () => {
                    try {
                        recorder.stop();
                        return await finalBlobPromise;
                    } finally {
                        for (let track of media.stream.getTracks()) {
                            track.stop();
                        }
                    }
                },
            };
        });

        return {
            stop: async () => {
                const files = await Promise.all(promises.map((p) => p.stop()));
                return {
                    files,
                } as Recording;
            },
        };
    }
}

export interface MediaRecording {
    stop(): Promise<Recording>;
}
