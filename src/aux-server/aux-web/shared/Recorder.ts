/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type {
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
            if (videoAudio) {
                console.log(
                    '[Recorder] Recording video with microphone audio.'
                );
            }
            const videoMedia = await navigator.mediaDevices.getUserMedia({
                audio: videoAudio,
                video: options.video,
            });
            const screenAudio = isRecordingAudioSource(options.audio, 'screen');
            if (screenAudio) {
                console.log('[Recorder] Recording video with screen audio.');
            }
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
                    mimeType: options.mimeType,
                    bitsPerSecond: options.bitsPerSecond,
                },
                {
                    stream: screenMedia,
                    options: {
                        audio: screenAudio,
                        video: false,
                        screen: true,
                    },
                    mimeType: options.mimeType,
                    bitsPerSecond: options.bitsPerSecond,
                    videoBitsPerSecond: options.videoBitsPerSecond,
                    audioBitsPerSecond: options.audioBitsPerSecond,
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
                    mimeType: options.mimeType,
                    bitsPerSecond: options.bitsPerSecond,
                    videoBitsPerSecond: options.videoBitsPerSecond,
                    audioBitsPerSecond: options.audioBitsPerSecond,
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
                video: {
                    width: { ideal: window.screen.width },
                    height: { ideal: window.screen.height },
                },
            });

            const recordMicrophone = isRecordingAudioSource(
                options.audio,
                'microphone'
            );
            if (recordMicrophone) {
                console.log(
                    '[Recorder] Recording screen with microphone audio'
                );
                const microphoneMedia =
                    await navigator.mediaDevices.getUserMedia({
                        audio: true,
                    });

                let tracks: MediaStreamTrack[] = [];
                let mixer: MultiStreamsMixer;
                if (screenAudio) {
                    // The MultiStreamsMixer is really bad at mixing video, so we only mix audio using it.
                    mixer = new MultiStreamsMixer([
                        new MediaStream([...screenMedia.getAudioTracks()]),
                        new MediaStream([...microphoneMedia.getAudioTracks()]),
                    ]);

                    tracks = [
                        ...screenMedia.getVideoTracks(),
                        ...mixer.getMixedStream().getAudioTracks(),
                    ];
                } else {
                    tracks = [
                        ...screenMedia.getTracks(),
                        ...microphoneMedia.getTracks(),
                    ];
                }

                const recorder = new MediaStream(tracks);

                return this._recordMedia([
                    {
                        stream: recorder,
                        options: {
                            audio: options.audio,
                            video: false,
                            screen: true,
                        },
                        mixer,
                        mimeType: options.mimeType,
                        bitsPerSecond: options.bitsPerSecond,
                        videoBitsPerSecond: options.videoBitsPerSecond,
                        audioBitsPerSecond: options.audioBitsPerSecond,
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
                        mimeType: options.mimeType,
                        bitsPerSecond: options.bitsPerSecond,
                        videoBitsPerSecond: options.videoBitsPerSecond,
                        audioBitsPerSecond: options.audioBitsPerSecond,
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
                        mimeType: options.mimeType,
                        bitsPerSecond: options.bitsPerSecond,
                        videoBitsPerSecond: options.videoBitsPerSecond,
                        audioBitsPerSecond: options.audioBitsPerSecond,
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
                            mimeType:
                                options.mimeType ?? 'audio/ogg; codecs=opus',
                            bitsPerSecond: options.bitsPerSecond,
                            options: {
                                audio: options.audio,
                                video: false,
                                screen: false,
                            },
                            videoBitsPerSecond: options.videoBitsPerSecond,
                            audioBitsPerSecond: options.audioBitsPerSecond,
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
                            mimeType: options.mimeType,
                            bitsPerSecond: options.bitsPerSecond,
                            videoBitsPerSecond: options.videoBitsPerSecond,
                            audioBitsPerSecond: options.audioBitsPerSecond,
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
                            mimeType: options.mimeType,
                            bitsPerSecond: options.bitsPerSecond,
                            videoBitsPerSecond: options.videoBitsPerSecond,
                            audioBitsPerSecond: options.audioBitsPerSecond,
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
            bitsPerSecond?: number;
            videoBitsPerSecond?: number;
            audioBitsPerSecond?: number;
            mediaStreamsToStart?: MediaStream[];
        }[]
    ) {
        const promises = media.map((media) => {
            const mimeType =
                media.mimeType ??
                getIdealMimeType(media.options.video || media.options.screen);
            const bitsPerSecond = media.bitsPerSecond;
            const videoBitsPerSecond =
                media.videoBitsPerSecond ?? bitsPerSecond
                    ? undefined
                    : 10 * 1024 * 1024;
            const audioBitsPerSecond =
                media.audioBitsPerSecond ?? bitsPerSecond
                    ? undefined
                    : 48 * 1024;
            console.log('[Recorder] Using settings', {
                mimeType,
                videoBitsPerSecond,
                audioBitsPerSecond,
                bitsPerSecond,
            });
            const recorder = new MediaRecorder(media.stream, {
                mimeType,
                bitsPerSecond,
                videoBitsPerSecond,
                audioBitsPerSecond,
            });

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
                                    type: mimeType,
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

function getIdealMimeType(containsVideo: boolean): string {
    if (containsVideo) {
        return getIdealVideoMimeType();
    } else {
        return getIdealAudioMimeType();
    }
}

function getIdealVideoMimeType(): string {
    const videoCodecs = ['vp9', 'av1', 'vp8', 'h264'];

    const containers = ['video/mp4', 'video/webm', 'video/x-matroska'];

    for (let container of containers) {
        for (let codec of videoCodecs) {
            const type = `${container};codecs="${codec}"`;
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
    }

    return undefined;
}

function getIdealAudioMimeType(): string {
    const containers = ['audio/mp3', 'audio/wav', 'audio/webm'];

    const codecs = ['opus', 'aac'];

    for (let container of containers) {
        for (let codec of codecs) {
            const type = `${container};codecs="${codec}"`;
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
    }

    return undefined;
}
