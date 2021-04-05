import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Prop, Inject, Watch } from 'vue-property-decorator';
import {
    Bot,
    hasValue,
    BotTags,
    PrecalculatedBot,
    calculateBotValue,
    calculateStringTagValue,
    IMU_PORTAL,
    registerBuiltinPortal,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { SubscriptionLike, Subscription, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
    BotManager,
    watchPortalConfigBot,
    BrowserSimulation,
    userBotChanged,
    getPortalConfigBot,
} from '@casual-simulation/aux-vm-browser';
import {
    Euler,
    MathUtils,
    Quaternion,
    Vector3,
} from '@casual-simulation/three';
import { Simulation } from '@casual-simulation/aux-vm';
import { RemoteSimulation } from '@casual-simulation/aux-vm-client';

@Component({})
export default class ImuPortal extends Vue {
    private _sub: Subscription;
    private _simulations: Map<BrowserSimulation, Subscription> = new Map();
    private _portals: Map<BrowserSimulation, Subscription> = new Map();
    private _currentSim: BrowserSimulation;
    private _resolveDevicePermissions: Function;
    private _rejectDevicePermissions: Function;

    showRequestDeviceMotionPermission: boolean = false;

    constructor() {
        super();
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
            const permission = await DeviceMotionEvent.requestPermission();
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
        if (portal) {
            let sub = this._portals.get(sim);
            if (!sub) {
                sub = new Subscription();
                this._portals.set(sim, sub);

                if (!(await this._startOrientationSensor(sim, sub, portal))) {
                    if (!(await this._startDeviceMotion(sim, sub, portal))) {
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
        sub: Subscription,
        portal: string
    ): Promise<boolean> {
        if (typeof AbsoluteOrientationSensor === 'undefined') {
            return false;
        }

        try {
            const sensor = new AbsoluteOrientationSensor();

            const readingListener = (event: any) => {
                const portalBot = getPortalConfigBot(sim, IMU_PORTAL);
                if (portalBot) {
                    const [x, y, z, w] = sensor.quaternion;

                    const q = new Quaternion(x, y, z, w).invert();
                    const rotation = new Euler().setFromQuaternion(q);

                    sim.helper.updateBot(portalBot, {
                        tags: {
                            imuSupported: true,
                            deviceRotationX: rotation.x,
                            deviceRotationY: -rotation.z,
                            deviceRotationZ: rotation.y,
                        },
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
                            name: 'accelerometer',
                        }),
                        navigator.permissions.query({
                            name: 'magnetometer',
                        }),
                        navigator.permissions.query({
                            name: 'gyroscope',
                        }),
                    ]);

                    if (sub.closed) {
                        return;
                    }

                    if (results.every((r) => r.state === 'granted')) {
                        await sim.helper.transaction(
                            registerBuiltinPortal(portal)
                        );
                        console.log('[ImuPortal] Starting sensor...');
                        sensor.start();
                        return true;
                    } else {
                        console.error(
                            '[ImuPortal] Unable to start the AbsoluteOrientationSensor. The correct permissions have not been granted.'
                        );
                    }
                } catch (ex) {
                    console.error(
                        '[ImuPortal] Unable to start the AbsoluteOrientationSensor',
                        ex
                    );
                }
                return false;
            }
        } catch (ex) {
            console.error(
                '[ImuPortal] Unable to start the AbsoluteOrientationSensor',
                ex
            );
            return false;
        }
    }

    private async _startDeviceMotion(
        sim: RemoteSimulation,
        sub: Subscription,
        portal: string
    ) {
        if (typeof DeviceMotionEvent === 'undefined') {
            return false;
        }

        if (!DeviceMotionEvent.requestPermission) {
            return false;
        }

        // if()

        try {
            let hasPermission = false;

            try {
                const permission = await DeviceMotionEvent.requestPermission();
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
                const orientationListener = (event: DeviceOrientationEvent) => {
                    const portalBot = getPortalConfigBot(sim, IMU_PORTAL);
                    if (portalBot) {
                        // Taken from https://github.com/mrdoob/three.js/blob/dev/examples/jsm/controls/DeviceOrientationControls.js
                        const beta = MathUtils.degToRad(event.beta);
                        const alpha = MathUtils.degToRad(event.alpha);
                        const gamma = MathUtils.degToRad(event.gamma);

                        let euler = new Euler();

                        let quaternion = new Quaternion();

                        let q1 = new Quaternion(
                            -Math.sqrt(0.5),
                            0,
                            0,
                            Math.sqrt(0.5)
                        ); // - PI/2 around the x-axis

                        euler.set(beta, alpha, -gamma, 'YXZ'); // 'ZXY' for the device, but 'YXZ' for us

                        quaternion.setFromEuler(euler); // orient the device

                        quaternion.multiply(q1); // camera looks out the back of the device, not the top

                        euler.setFromQuaternion(quaternion);

                        //var zee = new Vector3( 0, 0, 1 );
                        // quaternion.multiply( q0.setFromAxisAngle( zee, - orient ) ); // adjust for screen orientation

                        sim.helper.updateBot(portalBot, {
                            tags: {
                                imuSupported: true,
                                deviceRotationX: -euler.x,
                                deviceRotationY: -euler.z,
                                deviceRotationZ: euler.y,
                            },
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

                await sim.helper.transaction(registerBuiltinPortal(portal));
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
