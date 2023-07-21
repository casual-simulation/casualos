import Vue from 'vue';
import Component from 'vue-class-component';
import {
    hasValue,
    CameraType,
    action,
    asyncResult,
    asyncError,
    ON_PHOTO_CAMERA_CLOSED_ACTION_NAME,
    OpenPhotoCameraAction,
    ON_PHOTO_CAMERA_OPENED_ACTION_NAME,
    ON_PHOTO_CAPTURED_ACTION_NAME,
    Photo,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
    BrowserSimulation,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
import CameraStream from '../CameraStream/CameraStream';
import { max } from 'lodash';

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
    imageFormat: string = null;
    imageQuality: number = null;
    skipConfirm: boolean = false;
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
        this.imageFormat = null;
        this.imageQuality = null;
        this.skipConfirm = false;
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
                ctx.drawImage(video, 0, 0, width, height);

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
                            this.imageFormat ?? 'image/png',
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

            if (this._openEvent.singlePhoto) {
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

            if (this._openEvent.singlePhoto) {
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
            console.log('starting timer', this.startingTimer);
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
                        this.startingTimer =
                            e.options.takePhotoAfterSeconds ?? null;
                        console.log('timer', this.startingTimer);
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
