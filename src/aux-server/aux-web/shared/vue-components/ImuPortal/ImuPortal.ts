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
import { Euler, Quaternion } from '@casual-simulation/three';

@Component({})
export default class ImuPortal extends Vue {
    private _sub: Subscription;
    private _simulations: Map<BrowserSimulation, Subscription> = new Map();
    private _portals: Map<BrowserSimulation, Subscription> = new Map();
    private _currentSim: BrowserSimulation;

    constructor() {
        super();
    }

    created() {
        this._sub = new Subscription();
        this._simulations = new Map();
        this._portals = new Map();

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

    private _onUserBotUpdated(sim: BrowserSimulation, user: PrecalculatedBot) {
        const portal = calculateStringTagValue(null, user, IMU_PORTAL, null);
        if (hasValue(portal)) {
            let sub = this._portals.get(sim);
            if (!sub) {
                sub = new Subscription();
                this._portals.set(sim, sub);

                if (typeof AbsoluteOrientationSensor === 'undefined') {
                    console.log(
                        '[ImuPortal] IMU data is not supported on this browser.'
                    );
                    updatePortalBot({
                        tags: {
                            imuSupported: false,
                        },
                    });
                    return;
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

                        updatePortalBot({
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

                    updatePortalData();

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
                                return;
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
                        updatePortalBot({
                            tags: {
                                imuSupported: false,
                            },
                        });
                    }
                } catch (ex) {
                    console.error(
                        '[ImuPortal] Unable to start the AbsoluteOrientationSensor',
                        ex
                    );
                    updatePortalBot({
                        tags: {
                            imuSupported: false,
                        },
                    });
                }

                async function updatePortalBot(newData: Partial<Bot>) {
                    const portalBot = getPortalConfigBot(sim, IMU_PORTAL);
                    if (portalBot) {
                        await sim.helper.updateBot(portalBot, newData);
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
}
