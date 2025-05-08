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
import type {
    CameraType,
    OpenPhotoCameraAction,
    Photo,
} from '@casual-simulation/aux-common';
import {
    hasValue,
    asyncResult,
    asyncError,
    ON_PHOTO_CAMERA_CLOSED_ACTION_NAME,
    ON_PHOTO_CAMERA_OPENED_ACTION_NAME,
    ON_PHOTO_CAPTURED_ACTION_NAME,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import CameraStream from '../CameraStream/CameraStream';

@Component({
    components: {
        'camera-stream': CameraStream,
    },
})
export default class PhotoCamera extends Vue {
    private _sub: Subscription;
    private _simulations: Map<BrowserSimulation, Subscription> = new Map();
    private _portals: Map<BrowserSimulation, string> = new Map();
    private _currentSimulation: BrowserSimulation;
    private _streaming: boolean = false;
    private _photoUrl: string;
    private _photoData: Blob;
    private _photoInfo: {
        width: number;
        height: number;
    };

    processing: boolean = false;
    hasPhoto: boolean = false;
    showPhotoCamera: boolean = false;
    cameraType: CameraType = null;
    cameraConstraints: MediaTrackConstraints = null;
    imageFormat: string = null;
    imageQuality: number = null;
    skipConfirm: boolean = false;
    mirrorPhoto: boolean = false;
    startingTimer: number = null;
    currentTimer: number = null;

    private _currentInterval: any;

    private _openEvent: OpenPhotoCameraAction;

    constructor() {
        super();
    }

    created() {
        this._sub = new Subscription();
        this._simulations = new Map();
        this._portals = new Map();
        this.hasPhoto = false;
        this.showPhotoCamera = false;
        this.cameraType = null;
        this.cameraConstraints = null;
        this.imageFormat = null;
        this.imageQuality = null;
        this.skipConfirm = false;
        this.mirrorPhoto = false;
        this.startingTimer = null;
        this.currentTimer = null;
        this.processing = false;

        this._sub.add(
            appManager.simulationManager.simulationAdded
                .pipe(tap((sim) => this._onSimulationAdded(sim)))
                .subscribe()
        );
        this._sub.add(
            appManager.simulationManager.simulationRemoved
                .pipe(tap((sim) => this._onSimulationRemoved(sim)))
                .subscribe()
        );
        this._sub.add(() => {
            this.clearPhoto();
        });
    }

    beforeDestroy() {
        this.processing = false;
        this.hasPhoto = false;
        this._currentSimulation = null;
        this._openEvent = null;
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
    }

    onPhotoCameraClosed() {
        this._superAction(ON_PHOTO_CAMERA_CLOSED_ACTION_NAME);
    }

    hidePhotoCamera() {
        this.showPhotoCamera = false;
        if (this._currentInterval) {
            clearInterval(this._currentInterval);
        }
    }

    private _getCamera() {
        return this.$refs.camera as CameraStream;
    }

    private _getCanvas() {
        return this.$refs.canvas as HTMLCanvasElement;
    }

    private _getPreview() {
        return this.$refs.preview as HTMLImageElement;
    }

    async takePhoto() {
        const camera = this._getCamera();
        if (camera) {
            try {
                this.processing = true;

                const video = camera.getVideoElement();
                const canvas = this._getCanvas();
                const width = (canvas.width = video.videoWidth);
                const height = (canvas.height = video.videoHeight);

                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;

                if (this.mirrorPhoto) {
                    ctx.translate(width, 0);
                    ctx.scale(-1, 1);
                }

                ctx.drawImage(video, 0, 0, width, height);
                ctx.resetTransform();

                const data = await new Promise<Blob>((resolve, reject) => {
                    try {
                        canvas.toBlob(
                            (blob) => {
                                if (!blob) {
                                    reject(
                                        new Error(
                                            'Could not get blob from canvas.'
                                        )
                                    );
                                    return;
                                }
                                resolve(blob);
                            },
                            this.imageFormat === 'png'
                                ? 'image/png'
                                : this.imageFormat === 'jpeg'
                                ? 'image/jpeg'
                                : 'image/png',
                            this.imageQuality ?? undefined
                        );
                    } catch (err) {
                        reject(err);
                    }
                });
                this._photoUrl = URL.createObjectURL(data);
                this._photoData = data;
                this._photoInfo = {
                    width,
                    height,
                };
                if (this.skipConfirm) {
                    await this.savePhoto();
                } else {
                    this.hasPhoto = true;
                    const preview = this._getPreview();
                    preview.src = this._photoUrl;
                }
            } finally {
                this.processing = false;
            }
        }
    }

    async savePhoto() {
        if (this._photoData && this._currentSimulation) {
            const data = this._photoData;
            const photo: Photo = {
                data: data,
                ...this._photoInfo,
            };

            const singlePhoto = this._openEvent?.singlePhoto;
            if (singlePhoto) {
                this._currentSimulation.helper.transaction(
                    asyncResult(this._openEvent.taskId, photo)
                );
            }

            await this._currentSimulation.helper.action(
                ON_PHOTO_CAPTURED_ACTION_NAME,
                null,
                {
                    photo,
                }
            );

            this.clearPhoto();

            if (singlePhoto) {
                this.hidePhotoCamera();
            }
        }
    }

    clearPhoto() {
        this.hasPhoto = false;
        const preview = this._getPreview();
        if (preview) {
            preview.src = null;
        }
        if (this._photoUrl) {
            URL.revokeObjectURL(this._photoUrl);
            this._photoUrl = null;
        }
        this._photoData = null;

        if (
            this._openEvent &&
            this._currentSimulation &&
            this._openEvent.singlePhoto
        ) {
            this._currentSimulation.helper.transaction(
                asyncError(
                    this._openEvent.taskId,
                    new Error('Photo cancelled.')
                )
            );
            this.hidePhotoCamera();
        }
    }

    onCameraStreamLoaded() {
        if (this._openEvent && this._currentSimulation) {
            if (!this._openEvent.singlePhoto) {
                this._currentSimulation.helper.transaction(
                    asyncResult(this._openEvent.taskId, null)
                );
            }
            this._superAction(ON_PHOTO_CAMERA_OPENED_ACTION_NAME);
            this._streaming = true;

            this.startTimerIfConfigured();
        }
    }

    startTimerIfConfigured(minimumTime: number = 1, maximumTime: number = 100) {
        if (typeof this.startingTimer === 'number' && this.startingTimer >= 0) {
            this.currentTimer = Math.max(
                Math.min(this.startingTimer, maximumTime),
                minimumTime
            );

            if (this.currentTimer <= 0) {
                this.takePhoto();
            } else {
                if (this._currentInterval) {
                    clearInterval(this._currentInterval);
                }
                this._currentInterval = setInterval(() => {
                    this.currentTimer -= 1;
                    if (this.currentTimer <= 0) {
                        this.takePhoto();
                        clearInterval(this._currentInterval);
                    }
                }, 1000);
                this._sub.add(() => {
                    if (this._currentInterval) {
                        clearInterval(this._currentInterval);
                    }
                });
            }
        }
    }

    onCameraStreamError(err: Error) {
        if (this._openEvent && this._currentSimulation) {
            this._currentSimulation.helper.transaction(
                asyncError(this._openEvent.taskId, err.toString())
            );
            this._openEvent = null;
            this._streaming = false;
        }
    }

    onCameraStreamStopped() {
        this._streaming = false;
    }

    private _onSimulationAdded(sim: BrowserSimulation) {
        let sub = new Subscription();
        this._simulations.set(sim, sub);

        sub.add(
            sim.localEvents.subscribe(async (e) => {
                if (e.type === 'open_photo_camera') {
                    this.showPhotoCamera = !!e.open;
                    if (this.showPhotoCamera) {
                        console.log('[PhotoCamera] Loading video stream...');
                        this.cameraType = e.options.cameraType;
                        this.imageFormat = e.options.imageFormat;
                        this.imageQuality = e.options.imageQuality;
                        this.skipConfirm = e.options.skipConfirm;
                        this.mirrorPhoto = e.options.mirrorPhoto;
                        this.startingTimer =
                            e.options.takePhotoAfterSeconds ?? null;

                        if (e.options.idealResolution) {
                            this.cameraConstraints = {
                                width: {
                                    ideal: e.options.idealResolution.width,
                                },
                                height: {
                                    ideal: e.options.idealResolution.height,
                                },
                            };
                        } else {
                            this.cameraConstraints = null;
                        }

                        this.currentTimer = null;
                        this._openEvent = e;
                        this._currentSimulation = sim;
                    } else {
                        this._openEvent = null;
                        this._currentSimulation = null;

                        if (hasValue(e.taskId)) {
                            sim.helper.transaction(asyncResult(e.taskId, null));
                        }
                        this._superAction(ON_PHOTO_CAMERA_CLOSED_ACTION_NAME);
                    }
                }
            })
        );
    }

    private _onSimulationRemoved(sim: BrowserSimulation) {
        const sub = this._simulations.get(sim);
        if (sub) {
            sub.unsubscribe();
        }
        this._simulations.delete(sim);
        this._portals.delete(sim);
    }

    /**
     * Sends the given event and argument to every loaded simulation.
     * @param eventName The event to send.
     * @param arg The argument to send.
     */
    private async _superAction(eventName: string, arg?: any) {
        for (let [, sim] of appManager.simulationManager.simulations) {
            await sim.helper.action(eventName, null, arg);
        }
    }
}
