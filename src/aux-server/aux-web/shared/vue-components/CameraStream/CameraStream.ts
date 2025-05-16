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
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop } from 'vue-property-decorator';
import { Subscription } from 'rxjs';
import type { CameraType } from '@casual-simulation/aux-common';

@Component({
    components: {},
})
export default class CameraStream extends Vue {
    private _sub: Subscription;
    private _streamingVideo: boolean = false;
    private _currentMedia: MediaStream;

    @Prop({ default: null as CameraType })
    cameraType: CameraType;

    @Prop({ default: null })
    constraints: MediaTrackConstraints;

    @Prop({ default: false })
    mirror: boolean;

    loading: boolean = false;

    constructor() {
        super();
    }

    created() {
        this._sub = new Subscription();
        this._streamingVideo = false;
        this.loading = false;
    }

    mounted() {
        const listener = () => {
            const video = this.getVideoElement();
            video.height = video.videoHeight;
            video.width = video.videoWidth;
            video.setAttribute('playsinline', 'true');
            video.muted = true;
        };
        const video = this.getVideoElement();
        video.addEventListener('resize', listener);
        this._sub.add(() => {
            const video = this.getVideoElement();
            video.removeEventListener('resize', listener);
        });

        this.startVideo();
    }

    beforeDestroy() {
        if (this._sub) {
            this._sub.unsubscribe();
        }
    }

    getMediaStream() {
        return this._currentMedia;
    }

    getVideoStream() {
        return this._currentMedia.getVideoTracks()[0];
    }

    getVideoElement() {
        return this.$refs.video as HTMLVideoElement;
    }

    async startVideo(): Promise<boolean> {
        try {
            if (await this._startVideoStream()) {
                this.$emit('streaming');
                return true;
            }

            this.$emit(
                'streamingError',
                new Error('Could not start camera stream.')
            );
            return false;
        } catch (err) {
            this.$emit('streamingError', err);
            return false;
        }
    }

    stopVideo(): void {
        this._stopVideoStream();
    }

    private async _startVideoStream(): Promise<boolean> {
        if (this._streamingVideo) {
            return true;
        }
        if (this._sub.closed) {
            return false;
        }

        const media = await navigator.mediaDevices.getUserMedia({
            video: {
                ...(this.constraints ?? {}),
                facingMode: {
                    ideal: this.cameraType === 'front' ? 'user' : 'environment',
                },
            },
        });

        if (this._sub.closed) {
            return false;
        }

        this._currentMedia = media;
        const video = this.getVideoElement();
        video.srcObject = media;
        video.setAttribute('playsinline', 'true');
        video.muted = true;

        try {
            await video.play();
        } catch (err) {
            if (!this._sub.closed) {
                throw err;
            }
            console.error(err);
        }
        this._streamingVideo = true;
        this._sub.add(() => this._stopVideoStream());
        return true;
    }

    private _stopVideoStream() {
        if (this._streamingVideo) {
            this._streamingVideo = false;
            const tracks = this._currentMedia.getTracks();
            for (let track of tracks) {
                track.stop();
            }

            this._currentMedia = null;
            const video = this.getVideoElement();
            video.srcObject = null;

            this.$emit('stopped');
        }
    }
}
