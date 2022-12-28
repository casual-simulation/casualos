import {
    RecordedFile,
    Recording,
    RecordingOptions,
} from '@casual-simulation/aux-common';
import { MultiStreamsMixer } from '@casual-simulation/multi-streams-mixer';

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
            const videoAudio = isRecordingAudioSource(
                options.audio,
                'microphone'
            );
            const videoMedia = await navigator.mediaDevices.getUserMedia({
                audio: videoAudio,
                video: options.video,
            });
            const screenAudio = isRecordingAudioSource(options.audio, 'screen');
            const screenMedia = await navigator.mediaDevices.getDisplayMedia({
                audio: screenAudio,
                video: options.screen,
            });

            return this._recordMedia([
                {
                    stream: videoMedia,
                    options: {
                        audio: videoAudio,
                        video: true,
                        screen: false,
                    },
                },
                {
                    stream: screenMedia,
                    options: {
                        audio: screenAudio,
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
            const audio = isRecordingAudioSource(options.audio, 'microphone');
            const videoMedia = await navigator.mediaDevices.getUserMedia({
                audio: audio,
                video: true,
            });

            return this._recordMedia([
                {
                    stream: videoMedia,
                    options: {
                        audio: audio,
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

            const screenAudio = isRecordingAudioSource(options.audio, 'screen');
            const screenMedia = await navigator.mediaDevices.getDisplayMedia({
                audio: screenAudio,
                video: true,
            });

            const recordMicrophone = isRecordingAudioSource(
                options.audio,
                'microphone'
            );
            if (recordMicrophone) {
                const microphoneMedia =
                    await navigator.mediaDevices.getUserMedia({
                        audio: true,
                    });

                const mixer = new MultiStreamsMixer([
                    screenMedia,
                    microphoneMedia,
                ]);

                return this._recordMedia([
                    {
                        stream: mixer.getMixedStream(),
                        mixer,
                        options: {
                            audio: options.audio,
                            video: false,
                            screen: true,
                        },
                    },
                ]);
            } else {
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
            }
        } else if (options.audio) {
            console.log('[Recorder] Recording audio.');

            if (options.audio === true) {
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
            } else {
                const microphoneAudio = isRecordingAudioSource(
                    options.audio,
                    'microphone'
                );
                const screenAudio = isRecordingAudioSource(
                    options.audio,
                    'screen'
                );

                if (microphoneAudio && screenAudio) {
                    const microphoneMedia =
                        await navigator.mediaDevices.getUserMedia({
                            audio: true,
                        });
                    const screenMedia =
                        await navigator.mediaDevices.getDisplayMedia({
                            audio: true,
                            screen: false,
                        });

                    for (let video of screenMedia.getVideoTracks()) {
                        screenMedia.removeTrack(video);
                        video.stop();
                    }
                    console.log('screen tracks', screenMedia.getTracks());

                    const mixer = new MultiStreamsMixer([
                        microphoneMedia,
                        screenMedia,
                    ]);

                    const mixed = mixer.getMixedStream();

                    return this._recordMedia([
                        {
                            stream: mixed,
                            mixer,
                            // mediaStreamsToStart: [microphoneMedia, screenMedia],
                            mimeType: 'audio/ogg; codecs=opus',
                            options: {
                                audio: options.audio,
                                video: false,
                                screen: false,
                            },
                        },
                    ]);
                } else if (microphoneAudio) {
                    const microphoneMedia =
                        await navigator.mediaDevices.getUserMedia({
                            audio: true,
                        });

                    return this._recordMedia([
                        {
                            stream: microphoneMedia,
                            options: {
                                audio: options.audio,
                                video: false,
                                screen: false,
                            },
                        },
                    ]);
                } else if (screenAudio) {
                    const screenMedia =
                        await navigator.mediaDevices.getDisplayMedia({
                            audio: true,
                        });

                    return this._recordMedia([
                        {
                            stream: screenMedia,
                            options: {
                                audio: options.audio,
                                video: false,
                                screen: false,
                            },
                        },
                    ]);
                }
            }
        }

        throw new Error(
            'Cannot produce a recording when all the options are set to false.'
        );
    }

    private async _recordMedia(
        media: {
            stream: MediaStream;
            options: RecordingOptions;
            mixer?: MultiStreamsMixer;
            mimeType?: string;
            mediaStreamsToStart?: MediaStream[];
        }[]
    ) {
        const promises = media.map((media) => {
            const recorder = new MediaRecorder(media.stream);

            if (media.mixer && (media.options.video || media.options.screen)) {
                media.mixer.frameInterval = 1;
                media.mixer.startDrawingFrames();
            }

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
                                    type: media.mimeType ?? recorder.mimeType,
                                });

                                if (media.mixer) {
                                    media.mixer.dispose();
                                }

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

function isRecordingAudioSource(
    audio: RecordingOptions['audio'],
    source: string
): boolean {
    return (
        audio === true ||
        (Array.isArray(audio) && audio.includes(source as any))
    );
}
