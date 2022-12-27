// @maalouf

export class MultiStreamsMixer {
    videos: TrackedVideo[];
    isStopDrawingFrames: boolean;
    canvas: TrackedCanvas;
    context: CanvasRenderingContext2D;
    disableLogs: boolean;
    frameInterval: number;
    width: number;
    height: number;
    useGainNode: boolean;
    arrayOfMediaStreams: Array<MediaStream>;
    elementClass: string;
    /********************************************/
    audioContext: AudioContext;
    audioDestination: any;
    audioSources: Array<any>;
    gainNode: GainNode;

    constructor(
        arrayOfMediaStreams: MediaStream[],
        elementClass = 'multi-streams-mixer'
    ) {
        // requires: chrome://flags/#enable-experimental-web-platform-features
        this.arrayOfMediaStreams = arrayOfMediaStreams;
        this.elementClass = elementClass;
        this.videos = new Array<any>();
        this.isStopDrawingFrames = false;
        this.canvas = {
            el: document.createElement('canvas'),
            stream: null,
        };
        this.context = this.canvas.el.getContext('2d');
        this.canvas.el.setAttribute(
            'style',
            'opacity:0;position:absolute;z-index:-1;top: -100000000;left:-1000000000; margin-top:-1000000000;margin-left:-1000000000;'
        );
        this.canvas.el.className = this.elementClass;
        document.body.appendChild(this.canvas.el);
        this.disableLogs = false;
        this.frameInterval = 10;
        this.width = 360;
        this.height = 240;
        this.useGainNode = true;
        this.audioContext = undefined;
    }

    dispose() {
        document.body.removeChild(this.canvas.el);

        this.releaseStreams();
    }

    private isPureAudio() {
        for (let i = 0; i < this.arrayOfMediaStreams.length; i++) {
            if (
                this.arrayOfMediaStreams[i].getTracks().filter(function (t) {
                    return t.kind === 'video';
                }).length > 0
            )
                return false;
        }
        return true;
    }

    getAudioContext(): AudioContext {
        if (typeof AudioContext !== 'undefined') {
            return new AudioContext();
        } else if (typeof (<any>window).webkitAudioContext !== 'undefined') {
            return new (<any>window).webkitAudioContext();
        } else if (typeof (<any>window).mozAudioContext !== 'undefined') {
            return new (<any>window).mozAudioContext();
        }
    }

    /**************************************************/

    public startDrawingFrames() {
        this.drawVideosToCanvas();
    }

    private drawVideosToCanvas() {
        if (this.isStopDrawingFrames) {
            return;
        }
        let videosLength = this.videos.length;
        let remaining = [...this.videos] as TrackedVideo[];

        if (remaining.length) {
            this.canvas.el.width =
                videosLength > 1 ? remaining[0].width * 2 : remaining[0].width;
            var height = 1;
            if (videosLength === 3 || videosLength === 4) {
                height = 2;
            }
            if (videosLength === 5 || videosLength === 6) {
                height = 3;
            }
            if (videosLength === 7 || videosLength === 8) {
                height = 4;
            }
            if (videosLength === 9 || videosLength === 10) {
                height = 5;
            }
            this.canvas.el.height = remaining[0].height * height;
        } else {
            this.canvas.el.width = this.width || 360;
            this.canvas.el.height = this.height || 240;
        }

        remaining.forEach((video, idx) => {
            this.drawImage(video, idx);
        });

        setTimeout(this.drawVideosToCanvas.bind(this), this.frameInterval);
    }

    private drawImage(video: TrackedVideo, idx: number) {
        if (this.isStopDrawingFrames) {
            return;
        }

        var x = 0;
        var y = 0;
        var width = video.width;
        var height = video.height;

        if (idx === 1) {
            x = video.width;
        }

        if (idx === 2) {
            y = video.height;
        }

        if (idx === 3) {
            x = video.width;
            y = video.height;
        }

        if (idx === 4) {
            y = video.height * 2;
        }

        if (idx === 5) {
            x = video.width;
            y = video.height * 2;
        }

        if (idx === 6) {
            y = video.height * 3;
        }

        if (idx === 7) {
            x = video.width;
            y = video.height * 3;
        }

        // if (typeof video.stream.left !== 'undefined') {
        //     x = video.stream.left;
        // }

        // if (typeof video.stream.top !== 'undefined') {
        //     y = video.stream.top;
        // }

        // if (typeof video.stream.width !== 'undefined') {
        //     width = video.stream.width;
        // }

        // if (typeof video.stream.height !== 'undefined') {
        //     height = video.stream.height;
        // }

        this.context.drawImage(video.el, x, y, width, height);
        // if (typeof video.stream.onRender === 'function') {
        //     video.stream.onRender(this.context, x, y, width, height, idx);
        // }
    }

    getMixedStream(): MediaStream {
        this.isStopDrawingFrames = false;
        let mixedAudioStream = this.getMixedAudioStream();
        let mixedVideoStream = this.isPureAudio()
            ? undefined
            : this.getMixedVideoStream();
        if (mixedVideoStream == undefined) {
            return mixedAudioStream;
        } else {
            if (mixedAudioStream) {
                mixedAudioStream
                    .getTracks()
                    .filter(function (t) {
                        return t.kind === 'audio';
                    })
                    .forEach((track) => {
                        mixedVideoStream.addTrack(track);
                    });
            }
            return mixedVideoStream;
        }
    }

    private getMixedVideoStream(): MediaStream {
        this.resetVideoStreams();
        var capturedStream = this.canvas.el.captureStream();
        var videoStream = new MediaStream();
        capturedStream
            .getTracks()
            .filter(function (t) {
                return t.kind === 'video';
            })
            .forEach((track) => {
                videoStream.addTrack(track);
            });
        this.canvas.stream = videoStream;
        return videoStream;
    }

    private getMixedAudioStream(): MediaStream {
        // via: @pehrsons
        if (this.audioContext == undefined)
            this.audioContext = this.getAudioContext();
        this.audioSources = new Array<any>();
        if (this.useGainNode === true) {
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            this.gainNode.gain.value = 0; // don't hear self
        }

        let audioTracksLength = 0;
        for (let stream of this.arrayOfMediaStreams) {
            if (
                !stream.getTracks().filter(function (t) {
                    return t.kind === 'audio';
                }).length
            ) {
                return;
            }
            audioTracksLength++;
            let _audioSource =
                this.audioContext.createMediaStreamSource(stream);
            if (this.useGainNode === true) {
                _audioSource.connect(this.gainNode);
            }
            this.audioSources.push(_audioSource);
        }

        if (!audioTracksLength) {
            return undefined;
        }
        this.audioDestination =
            this.audioContext.createMediaStreamDestination();
        for (let _audioSource of this.audioSources) {
            _audioSource.connect(this.audioDestination);
        }
        return this.audioDestination.stream;
    }

    private getVideo(stream: MediaStream): TrackedVideo {
        let video = document.createElement('video');
        const dimensions = this._getVideoDimensions(stream);
        video.srcObject = stream;
        video.className = this.elementClass;
        video.muted = true;
        video.volume = 0;
        const width = (video.width = dimensions.width || this.width || 360);
        const height = (video.height = dimensions.height || this.height || 240);
        video.play();

        return {
            el: video,
            stream: stream,
            width,
            height,
        };
    }

    appendStreams(streams: MediaStream[]) {
        if (!streams) {
            throw 'First parameter is required.';
        }

        if (!(streams instanceof Array)) {
            streams = [streams];
        }

        this.arrayOfMediaStreams.concat(streams);
        streams.forEach((stream) => {
            if (
                stream.getTracks().filter(function (t) {
                    return t.kind === 'video';
                }).length
            ) {
                var video = this.getVideo(stream);
                (video as any)['stream'] = stream;
                this.videos.push(video);
            }

            if (
                stream.getTracks().filter(function (t) {
                    return t.kind === 'audio';
                }).length &&
                this.audioContext
            ) {
                var audioSource =
                    this.audioContext.createMediaStreamSource(stream);
                audioSource.connect(this.audioDestination);
                this.audioSources.push(audioSource);
            }
        });
    }

    releaseStreams() {
        for (let video of this.videos) {
            if (!video.stream) {
                continue;
            }
            const tracks = video.stream.getTracks();
            for (let track of tracks) {
                track.stop();
            }
        }

        this.videos = [];
        this.isStopDrawingFrames = true;

        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }

        if (this.audioSources.length) {
            this.audioSources.forEach((source) => {
                source.disconnect();
            });
            this.audioSources = [];
        }

        if (this.audioDestination) {
            this.audioDestination.disconnect();
            this.audioDestination = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
        }

        this.audioContext = null;

        this.context.clearRect(
            0,
            0,
            this.canvas.el.width,
            this.canvas.el.height
        );

        if (this.canvas.stream) {
            for (let track of this.canvas.stream.getTracks()) {
                track.stop();
            }
            this.canvas.stream = null;
        }

        if (this.arrayOfMediaStreams) {
            for (let stream of this.arrayOfMediaStreams) {
                const tracks = stream.getTracks();
                for (let track of tracks) {
                    track.stop();
                }
            }
            this.arrayOfMediaStreams = [];
        }
    }

    private resetVideoStreams(streams?: any) {
        if (streams && !(streams instanceof Array)) {
            streams = [streams];
        }

        this._resetVideoStreams(streams);
    }

    private _resetVideoStreams(streams: MediaStream[]) {
        this.videos = [];
        streams = streams || this.arrayOfMediaStreams;

        for (let stream of streams) {
            if (!this._hasVideo(stream)) {
                return;
            }
            let tempVideo = this.getVideo(stream);
            (tempVideo as any)['stream'] = stream;
            this.videos.push(tempVideo);
        }
        for (let stream of streams) {
            const tracks = stream.getTracks();
            for (let track of tracks) {
                track.stop();
            }
        }
    }

    private _hasVideo(stream: MediaStream) {
        return (
            stream.getTracks().filter(function (t) {
                return t.kind === 'video';
            }).length > 0
        );
    }

    private _getVideoDimensions(stream: MediaStream) {
        const firstVideo = stream.getVideoTracks()[0].getSettings();
        return {
            width: firstVideo.width,
            height: firstVideo.height,
        };
    }
}

interface TrackedVideo {
    el: HTMLVideoElement;
    stream: MediaStream;
    width: number;
    height: number;
}

interface TrackedCanvas {
    el: HTMLCanvasElement;
    stream: MediaStream;
}
