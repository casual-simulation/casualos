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
    Matrix4,
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
            const sensor = new AbsoluteOrientationSensor({
                // referenceFrame: 'screen'
            });

            const readingListener = (event: any) => {
                const portalBot = getPortalConfigBot(sim, IMU_PORTAL);
                if (portalBot) {
                    const [x, y, z, w] = sensor.quaternion;

                    const quaternion = new Quaternion(x, y, z, w).invert();

                    const rotation = new Matrix4().makeRotationFromQuaternion(
                        quaternion
                    );

                    let q1 = new Matrix4().makeRotationAxis(
                        new Vector3(1, 0, 0),
                        Math.PI / 2
                    );

                    rotation.premultiply(q1);

                    const mirror = new Matrix4().makeScale(1, -1, 1);
                    rotation.premultiply(mirror).multiply(mirror);

                    quaternion.setFromRotationMatrix(rotation);

                    sim.helper.updateBot(portalBot, {
                        tags: {
                            imuSupported: true,
                            deviceRotationX: quaternion.x,
                            deviceRotationY: quaternion.y,
                            deviceRotationZ: quaternion.z,
                            deviceRotationW: quaternion.w,
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

                        // we convert this euler rotation to a 4x4 matrix rotation
                        // so that we can manipulate in 4D and not worry too much about gimbal lock.
                        const rotation = new Matrix4().makeRotationFromEuler(
                            euler
                        );

                        const orientation = MathUtils.degToRad(
                            <number>window.orientation ?? 0
                        );

                        let q1 = new Matrix4();
                        // Adjust for orientation
                        q1.makeRotationAxis(new Vector3(0, 0, 1), -orientation);

                        rotation.multiply(q1);

                        // Create a rotation that is -90 degrees around the
                        // X axis.
                        q1.makeRotationAxis(new Vector3(1, 0, 0), -Math.PI / 2);

                        // Apply the -90 degree rotation twice.
                        // The first is to rotate -90 degrees so that
                        // 0 on the X axis means the phone is perpendicular to the ground.
                        // The second is to rotate -90 degrees so that the Y and Z axes are swapped.
                        rotation.premultiply(q1).premultiply(q1);

                        // Here we take out the second X axis rotation
                        // but since it is multiplied on the right
                        // the coordinate conversion stays.
                        // However, the Z axis has been negated as a result of this conversion.
                        // This is because the new Z axis was the old Y axis, and that axis is now pointing
                        // the opposite direction that the old Z axis was pointing. (right hand rule)
                        q1.invert();
                        rotation.multiply(q1);

                        // Because we need to mirror the Z axis,
                        // we need to change handedness. However any scale operation we apply
                        // mirrors the other two axes. So (-1, 1, 1) mirrors the Y and Z axes but not the
                        // X axis. Therefore we need to invert the matrix to mirror all the rotations
                        // and then scale by (1, 1, -1) to mirror the X and Y axes back to how they were.
                        rotation.invert();

                        const mirror = new Matrix4().makeScale(1, 1, -1);
                        rotation.premultiply(mirror).multiply(mirror);

                        let quaternion = new Quaternion();
                        quaternion.setFromRotationMatrix(rotation);

                        sim.helper.updateBot(portalBot, {
                            tags: {
                                imuSupported: true,
                                deviceRotationX: quaternion.x,
                                deviceRotationY: quaternion.y,
                                deviceRotationZ: quaternion.z,
                                deviceRotationW: quaternion.w,
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
