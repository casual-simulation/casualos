export class AudioRecorder {
    async start(): Promise<AudioRecording> {
        const media = await this._getMedia();

        const recorder = new MediaRecorder(media);

        let chunks = [] as Blob[];
        recorder.ondataavailable = (event) => {
            chunks.push(event.data);
        };

        const finalBlobPromise = new Promise<Blob>((resolve, reject) => {
            try {
                recorder.onstop = () => {
                    try {
                        const blob = new Blob(chunks, {
                            type: recorder.mimeType,
                        });

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
                    recorder.stop();
                    return await finalBlobPromise;
                } finally {
                    for (let track of media.getTracks()) {
                        track.stop();
                    }
                }
            },
        };

        recorder.start();

        return recording;
    }

    private async _getMedia() {
        return await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
    }
}

export interface AudioRecording {
    stop(): Promise<Blob>;
}
