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
import { Prop, Watch } from 'vue-property-decorator';
import type { Bot, PrecalculatedBot } from '@casual-simulation/aux-common';
import {
    calculateBotValue,
    IMU_PORTAL,
    registerBuiltinPortal,
    formatBotRotation,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import {
    watchPortalConfigBot,
    userBotChanged,
    getPortalConfigBot,
} from '@casual-simulation/aux-vm-browser';
import {
    Euler,
    MathUtils,
    Quaternion,
    Vector3,
} from '@casual-simulation/three';
import type { RemoteSimulation } from '@casual-simulation/aux-vm-client';
import {
    Rotation,
    Vector3 as CasualOSVector3,
} from '@casual-simulation/aux-common/math';

@Component({})
export default class ImuPortal extends Vue {
    private _sub: Subscription;
    private _simulations: Map<BrowserSimulation, Subscription> = new Map();
    private _portals: Map<BrowserSimulation, Subscription> = new Map();
    private _currentSim: BrowserSimulation;
    private _resolveDevicePermissions: (value?: any) => void;
    private _rejectDevicePermissions: (err?: any) => void;

    showRequestDeviceMotionPermission: boolean = false;

    /**
     * Whether the IMU data should be streamed to the imuPortalBot even if the IMU portal
     * is not open.
     */
    @Prop({}) streamImu: boolean;

    constructor() {
        super();
    }

    @Watch('streamImu')
    streamImuUpdated() {
        this._onUserBotUpdated(
            appManager.simulationManager.primary,
            appManager.simulationManager.primary.helper.userBot
        );
    }

    created() {
        this._sub = new Subscription();
        this._simulations = new Map();
        this._portals = new Map();
        this.showRequestDeviceMotionPermission = false;

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
    }

    beforeDestroy() {
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
    }

    onClose() {
        if (this._currentSim) {
            this._currentSim.helper.updateBot(this._currentSim.helper.userBot, {
                tags: {
                    [IMU_PORTAL]: null,
                },
            });
        }
    }

    async onConfirmDeviceMotion() {
        try {
            const permission = await (<DeviceMotionEventExtras>(
                (<any>DeviceMotionEvent)
            )).requestPermission();
            if (permission === 'granted') {
                this._resolveDevicePermissions();
            } else {
                this._rejectDevicePermissions();
            }
        } catch (ex) {
            console.error(
                '[ImuPortal] Unable to start the DeviceMotionEvent',
                ex
            );
            this._rejectDevicePermissions();
        }
    }

    onCancelDeviceMotion() {
        this._rejectDevicePermissions();
    }

    private _onSimulationAdded(sim: BrowserSimulation) {
        let sub = new Subscription();
        this._simulations.set(sim, sub);

        sub.add(
            userBotChanged(sim)
                .pipe(tap((user) => this._onUserBotUpdated(sim, user)))
                .subscribe()
        );
        sub.add(
            watchPortalConfigBot(sim, IMU_PORTAL)
                .pipe(
                    tap((bot) => {
                        // TODO: Update options
                    })
                )
                .subscribe()
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

    private async _onUserBotUpdated(
        sim: BrowserSimulation,
        user: PrecalculatedBot
    ) {
        const portal = calculateBotValue(null, user, IMU_PORTAL);
        if (
            portal ||
            (sim === appManager.simulationManager.primary && this.streamImu)
        ) {
            let sub = this._portals.get(sim);
            if (!sub) {
                sub = new Subscription();
                this._portals.set(sim, sub);

                if (!(await this._startOrientationSensor(sim, sub))) {
                    if (!(await this._startDeviceMotion(sim, sub))) {
                        console.log(
                            '[ImuPortal] IMU data is not supported on this browser.'
                        );
                        this._updatePortalBot(sim, {
                            tags: {
                                imuSupported: false,
                            },
                        });
                    }
                }
            }
        } else {
            const sub = this._portals.get(sim);
            this._portals.delete(sim);
            if (sub) {
                sub.unsubscribe();
            }
        }
    }

    private async _startOrientationSensor(
        sim: RemoteSimulation,
        sub: Subscription
    ): Promise<boolean> {
        if (typeof RelativeOrientationSensor === 'undefined') {
            return false;
        }

        try {
            const sensor = new RelativeOrientationSensor({
                referenceFrame: 'screen',
            });
            let rotationOffset: Quaternion = null;

            const readingListener = (event: any) => {
                const portalBot = getPortalConfigBot(sim, IMU_PORTAL);
                if (portalBot) {
                    const [x, y, z, w] = sensor.quaternion;

                    const quaternion = new Quaternion(x, y, z, w);
                    if (!rotationOffset) {
                        rotationOffset =
                            this._calculateRotationOffset(quaternion);
                    }
                    quaternion.premultiply(rotationOffset);

                    // console.log('[ImuPortal] Got reading', quaternion)
                    let update = {
                        imuSupported: true,
                        deviceRotationX: quaternion.x,
                        deviceRotationY: quaternion.y,
                        deviceRotationZ: quaternion.z,
                        deviceRotationW: quaternion.w,

                        deviceRotation: formatBotRotation(quaternion),
                    };
                    sim.helper.updateBot(portalBot, {
                        tags: update,
                    });
                }
            };
            const errorListener = (event: any) => {
                if (event.error.name == 'NotReadableError') {
                    console.log('[ImuPortal] Sensor is not available.');
                } else {
                    console.log(
                        '[ImuPortal] Encountered an error.',
                        event.error
                    );
                }

                this._updatePortalBot(sim, {
                    tags: {
                        imuSupported: false,
                    },
                });
                sub.unsubscribe();
            };
            sensor.addEventListener('reading', readingListener);
            sensor.addEventListener('error', errorListener);

            sub.add(() => {
                sensor.stop();
                sensor.removeEventListener('reading', readingListener);
                sensor.removeEventListener('error', errorListener);
            });

            return await updatePortalData();

            async function updatePortalData() {
                try {
                    const results = await Promise.all([
                        navigator.permissions.query({
                            name: 'accelerometer' as PermissionName,
                        }),
                        navigator.permissions.query({
                            name: 'magnetometer' as PermissionName,
                        }),
                        navigator.permissions.query({
                            name: 'gyroscope' as PermissionName,
                        }),
                    ]);

                    if (sub.closed) {
                        return;
                    }

                    if (results.every((r) => r.state === 'granted')) {
                        await sim.helper.transaction(
                            registerBuiltinPortal(IMU_PORTAL)
                        );
                        console.log('[ImuPortal] Starting sensor...');
                        sensor.start();
                        return true;
                    } else {
                        console.error(
                            '[ImuPortal] Unable to start the RelativeOrientationSensor. The correct permissions have not been granted.'
                        );
                    }
                } catch (ex) {
                    console.error(
                        '[ImuPortal] Unable to start the RelativeOrientationSensor',
                        ex
                    );
                }
                return false;
            }
        } catch (ex) {
            console.error(
                '[ImuPortal] Unable to start the RelativeOrientationSensor',
                ex
            );
            return false;
        }
    }

    private async _startDeviceMotion(sim: RemoteSimulation, sub: Subscription) {
        if (typeof DeviceMotionEvent === 'undefined') {
            return false;
        }

        if (
            !(<DeviceMotionEventExtras>(<any>DeviceMotionEvent))
                .requestPermission
        ) {
            return false;
        }

        // if()

        try {
            let hasPermission = false;

            try {
                const permission = await (<DeviceMotionEventExtras>(
                    (<any>DeviceMotionEvent)
                )).requestPermission();
                hasPermission = permission === 'granted';
            } catch (ex) {
                console.log('[ImuPortal] Requesting permissions via dialog.');
                const promise = new Promise<void>((resolve, reject) => {
                    this._resolveDevicePermissions = resolve;
                    this._rejectDevicePermissions = reject;
                });

                try {
                    this.showRequestDeviceMotionPermission = true;
                    await promise;
                    hasPermission = true;
                } catch (ex) {
                    hasPermission = false;
                }
            }

            if (hasPermission) {
                let rotationOffset: Quaternion = null;
                const orientationListener = (event: DeviceOrientationEvent) => {
                    const portalBot = getPortalConfigBot(sim, IMU_PORTAL);
                    if (portalBot) {
                        // This is some madness...
                        // for iOS, deviceorientation events are in the "device coordinate" frame
                        // where the X axis points to the right of the phone,
                        // the Y axis points to the top of the phone (from the center towards the front facing camera),
                        // and the Z axis points towards the user.
                        // alpha the Z axis, beta is the X axis, gamma is the Y axis.
                        // everything is in degrees.
                        // The X axis is absolute.
                        // Therefore, 0 on the X axis indicates the phone is parallel with the ground.
                        // The Y and Z axes are relative and are initialzed to the initial rotation that the phone has when streaming starts.
                        const beta = MathUtils.degToRad(event.beta ?? 0);
                        const alpha = MathUtils.degToRad(event.alpha ?? 0);
                        const gamma = MathUtils.degToRad(event.gamma ?? 0);

                        let euler = new Euler();
                        // because the rotation we get is in Euler angles,
                        // we need to represent the order correctly.
                        // We infer from the names "alpha", "beta", and "gamma" that
                        // they are in the order that the greek alphabet uses (a, b, g)
                        // this means the order is Z, Y, and then X.
                        euler.set(beta, gamma, alpha, 'ZXY');
                        let quaternion = new Quaternion();
                        quaternion.setFromEuler(euler);

                        if (!rotationOffset) {
                            rotationOffset =
                                this._calculateRotationOffset(quaternion);
                        }

                        quaternion.premultiply(rotationOffset);

                        const update = {
                            imuSupported: true,
                            deviceRotationX: quaternion.x,
                            deviceRotationY: quaternion.y,
                            deviceRotationZ: quaternion.z,
                            deviceRotationW: quaternion.w,
                        };
                        sim.helper.updateBot(portalBot, {
                            tags: update,
                        });
                    }
                };

                window.addEventListener(
                    'deviceorientation',
                    orientationListener
                );

                sub.add(() => {
                    window.removeEventListener(
                        'deviceorientation',
                        orientationListener
                    );
                });

                await sim.helper.transaction(registerBuiltinPortal(IMU_PORTAL));
                console.log('[ImuPortal] Starting sensor...');

                return true;
            }

            console.error(
                '[ImuPortal] Unable to start the DeviceMotionEvent. The correct permissions have not been granted.'
            );
            return false;
        } catch (ex) {
            console.error(
                '[ImuPortal] Unable to start the DeviceMotionEvent',
                ex
            );
            return false;
        }
    }

    private _calculateRotationOffset(rotation: Quaternion) {
        const forward = new Vector3(0, 1, 0).applyQuaternion(rotation);
        const forwardRotation = new Rotation({
            direction: new CasualOSVector3(forward.x, forward.y, forward.z),
            upwards: new CasualOSVector3(0, 0, 1),
            errorHandling: 'nudge',
        });
        const initialRotation = forwardRotation.invert();
        return new Quaternion(
            initialRotation.quaternion.x,
            initialRotation.quaternion.y,
            initialRotation.quaternion.z,
            initialRotation.quaternion.w
        );
    }

    private async _updatePortalBot(
        sim: RemoteSimulation,
        newData: Partial<Bot>
    ) {
        const portalBot = getPortalConfigBot(sim, IMU_PORTAL);
        if (portalBot) {
            await sim.helper.updateBot(portalBot, newData);
        }
    }
}
