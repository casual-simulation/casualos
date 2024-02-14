import {
    BehaviorSubject,
    NEVER,
    Observable,
    Subject,
    Subscription,
    SubscriptionLike,
    filter,
    firstValueFrom,
    startWith,
    switchMap,
} from 'rxjs';
import { BrowserSimulation } from './BrowserSimulation';
import {
    AuthHelperInterface,
    Simulation,
    SimulationManager,
} from '@casual-simulation/aux-vm/managers';
import { AuthHelper } from './AuthHelper';
import { generateV1ConnectionToken } from '@casual-simulation/aux-records/AuthUtils';
import {
    AuthorizeActionMissingPermission,
    PartitionAuthPermissionResult,
    PartitionAuthRequest,
    reportInst,
} from '@casual-simulation/aux-common';
import { LoginStatus, LoginUIStatus } from '@casual-simulation/aux-vm/auth';
import {
    GrantMarkerPermissionResult,
    GrantResourcePermissionResult,
} from '@casual-simulation/aux-records';

/**
 * Defines a class that is able to coordinate authentication across multiple simulations.
 */
export class AuthCoordinator<TSim extends BrowserSimulation>
    implements SubscriptionLike
{
    private _simulationManager: SimulationManager<TSim>;
    private _onMissingPermission: Subject<MissingPermissionEvent> =
        new Subject();
    private _onRequestAccess: Subject<RequestAccessEvent> = new Subject();
    private _onNotAuthorized: Subject<NotAuthorizedEvent> = new Subject();
    private _onShowAccountInfo: Subject<ShowAccountInfoEvent> = new Subject();
    private _onAuthHelper: BehaviorSubject<AuthHelper> = new BehaviorSubject(
        null
    );
    private _sub: Subscription;

    get onMissingPermission(): Observable<MissingPermissionEvent> {
        return this._onMissingPermission;
    }

    get onNotAuthorized(): Observable<NotAuthorizedEvent> {
        return this._onNotAuthorized;
    }

    get onShowAccountInfo(): Observable<ShowAccountInfoEvent> {
        return this._onShowAccountInfo;
    }

    get onRequestAccess(): Observable<RequestAccessEvent> {
        return this._onRequestAccess;
    }

    get authEndpoints(): Map<string, AuthHelperInterface> {
        const helper = this.authHelper;
        if (helper) {
            return helper.endpoints;
        }
        return new Map();
    }

    get onAuthEndpointDiscovered(): Observable<{
        endpoint: string;
        helper: AuthHelperInterface;
    }> {
        return this._onAuthHelper.pipe(
            switchMap((helper) =>
                helper ? helper.onEndpointDiscovered : NEVER
            )
        );
    }

    get authHelper() {
        return this._onAuthHelper.value;
    }

    set authHelper(value: AuthHelper) {
        this._onAuthHelper.next(value);
    }

    constructor(manager: SimulationManager<TSim>) {
        this._simulationManager = manager;
        this._sub = new Subscription();

        this._sub.add(
            this._simulationManager.watchSimulations((sim) => {
                let sub = new Subscription();

                sub.add(
                    sim.onAuthMessage.subscribe(async (msg) => {
                        if (msg.type === 'request') {
                            this._handleAuthRequest(sim, msg);
                        } else if (msg.type === 'external_permission_request') {
                            this._onRequestAccess.next({
                                simulationId: sim.id,
                                origin: msg.origin,
                                reason: msg.reason,
                            });
                        }
                    })
                );

                return sub;
            })
        );
    }

    async openAccountDashboard(simId: string) {
        const sim = this._simulationManager.simulations.get(simId);
        if (sim) {
            await sim.auth.primary.openAccountPage();
        }
    }

    async logout(simId: string) {
        const sim = this._simulationManager.simulations.get(simId);
        if (sim) {
            await sim.auth.primary.logout();
        }
    }

    async showReportInst(simId: string) {
        const sim = this._simulationManager.simulations.get(simId);
        if (sim) {
            await sim.helper.transaction(reportInst());
        }
    }

    async showAccountInfo(simId: string) {
        console.log(`[AuthCoordinator] [${simId}] Show account info`);
        const sim = this._simulationManager.simulations.get(simId);
        if (sim) {
            const endpoint = sim.auth.primary;
            const status = endpoint.currentLoginStatus;
            if (status) {
                this._onShowAccountInfo.next({
                    simulationId: sim.id,
                    loginStatus: status,
                });
            }
        }
    }

    async changeLogin(simId: string, origin: string) {
        console.log(`[AuthCoordinator] [${simId}] Changing login...`);
        const sim = this._simulationManager.simulations.get(simId);
        if (sim) {
            const endpoint = sim.auth.primary;
            await endpoint.logout();
            await endpoint.authenticate();

            const key: string = await endpoint.getConnectionKey();

            if (key) {
                const connectionId = sim.configBotId;
                const recordName = sim.origin.recordName;
                const inst = sim.inst;
                const token = generateV1ConnectionToken(
                    key,
                    connectionId,
                    recordName,
                    inst
                );

                console.log(
                    `[AuthCoordinator] [${sim.id}] Sending connectionToken.`
                );

                sim.sendAuthMessage({
                    type: 'response',
                    success: true,
                    origin: origin,
                    indicator: {
                        connectionToken: token,
                    },
                });
            }
        }
    }

    async requestAccessToMissingPermission(
        simId: string,
        origin: string,
        reason: AuthorizeActionMissingPermission
    ): Promise<PartitionAuthPermissionResult> {
        const sim = this._simulationManager.simulations.get(simId);
        if (sim) {
            const promise = firstValueFrom(
                sim.onAuthMessage.pipe(
                    filter(
                        (m) =>
                            m.origin === origin &&
                            m.type === 'external_permission_result'
                    )
                )
            );

            console.log(
                `[AuthCoordinator] [${sim.id}] Requesting permission`,
                reason
            );
            sim.sendAuthMessage({
                type: 'permission_request',
                origin: origin,
                reason,
            });

            const response = await promise;

            console.log(
                `[AuthCoordinator] [${sim.id}] Got permission result`,
                response
            );

            if (response.type === 'external_permission_result') {
                console.log(
                    `[AuthCoordinator] [${sim.id}] Got permission result`,
                    response
                );
                return {
                    ...response,
                    type: 'permission_result',
                };
            }
        }
        return {
            type: 'permission_result',
            origin,
            success: false,
            recordName: reason.recordName,
            resourceKind: reason.resourceKind,
            resourceId: reason.resourceKind,
            subjectType: reason.subjectType,
            subjectId: reason.subjectId,
            errorCode: 'server_error',
            errorMessage: 'A server error occurred.',
        };
    }

    async grantAccessToMissingPermission(
        simId: string,
        origin: string,
        reason: AuthorizeActionMissingPermission,
        expireTimeMs: number = null
    ): Promise<GrantMarkerPermissionResult | GrantResourcePermissionResult> {
        const sim = this._simulationManager.simulations.get(simId);
        if (sim) {
            const recordName = reason.recordName;
            const resourceKind = reason.resourceKind;
            const resourceId = reason.resourceId;
            const subjectType = reason.subjectType;
            const subjectId = reason.subjectId;
            const result = await sim.auth.primary.grantPermission(recordName, {
                resourceKind,
                resourceId,
                subjectType,
                subjectId,
                action: null,
                options: {},
                expireTimeMs,
            });

            if (result.success === true) {
                sim.sendAuthMessage({
                    type: 'permission_result',
                    success: true,
                    origin,
                    recordName,
                    resourceKind,
                    resourceId,
                    subjectType,
                    subjectId,
                });
            }

            return result;
        }

        console.error(
            '[AuthCoordinator] Could not find simulation to grant access to.',
            simId,
            origin,
            reason
        );
        return {
            success: false,
            errorCode: 'server_error',
            errorMessage: 'A server error occurred.',
        };
    }

    async respondToPermissionRequest(
        simId: string,
        origin: string,
        result: PartitionAuthPermissionResult
    ) {
        const sim = this._simulationManager.simulations.get(simId);
        if (sim) {
            sim.sendAuthMessage(result);
        }
    }

    private async _handleAuthRequest(
        sim: TSim,
        request: PartitionAuthRequest
    ): Promise<void> {
        if (request.kind === 'need_indicator') {
            await this._handleNeedIndicator(sim, request);
        } else if (request.kind === 'invalid_indicator') {
            await this._handleInvalidIndicator(sim, request);
        } else if (request.kind === 'not_authorized') {
            await this._handleNotAuthorized(sim, request);
        }
    }

    private async _handleNeedIndicator(
        sim: TSim,
        request: PartitionAuthRequest
    ) {
        console.log(`[AuthCoordinator] [${sim.id}] Needs indicator`);
        const endpoint = sim.auth.primary;
        const key = await endpoint.getConnectionKey();

        if (!key) {
            console.log(`[AuthCoordinator] [${sim.id}] Sending connectionId.`);
            sim.sendAuthMessage({
                type: 'response',
                success: true,
                origin: request.origin,
                indicator: {
                    connectionId: sim.configBotId,
                },
            });
        } else {
            const connectionId = sim.configBotId;
            const recordName = sim.origin.recordName;
            const inst = sim.inst;
            const token = generateV1ConnectionToken(
                key,
                connectionId,
                recordName,
                inst
            );
            console.log(
                `[AuthCoordinator] [${sim.id}] Sending connectionToken.`
            );
            sim.sendAuthMessage({
                type: 'response',
                success: true,
                origin: request.origin,
                indicator: {
                    connectionToken: token,
                },
            });
        }
    }

    private async _handleInvalidIndicator(
        sim: TSim,
        request: PartitionAuthRequest
    ) {
        console.log(
            `[AuthCoordinator] [${sim.id}] [${request.errorCode}] Invalid indicator.`
        );
        const endpoint = sim.auth.primary;
        let key: string;
        if (request.errorCode === 'invalid_token') {
            if (await endpoint.isAuthenticated()) {
                console.log(
                    `[AuthCoordinator] [${sim.id}] Logging out and back in...`
                );
                await endpoint.logout();
                await endpoint.authenticate();
            }
        } else {
            key = await endpoint.getConnectionKey();
            if (!key) {
                console.log(`[AuthCoordinator] [${sim.id}] Logging in...`);
                await endpoint.authenticate();
            }
        }

        if (!key) {
            key = await endpoint.getConnectionKey();
        }

        if (key) {
            const connectionId = sim.configBotId;
            const recordName = sim.origin.recordName;
            const inst = sim.inst;
            const token = generateV1ConnectionToken(
                key,
                connectionId,
                recordName,
                inst
            );

            console.log(
                `[AuthCoordinator] [${sim.id}] Sending connectionToken.`
            );

            sim.sendAuthMessage({
                type: 'response',
                success: true,
                origin: request.origin,
                indicator: {
                    connectionToken: token,
                },
            });
        }
    }

    private async _handleNotAuthorized(
        sim: TSim,
        request: PartitionAuthRequest
    ) {
        if (request.errorCode === 'not_logged_in') {
            await this._handleNotLoggedIn(sim, request);
        } else if (request.reason?.type === 'missing_permission') {
            await this._handleMissingPermission(sim, request, request.reason);
        } else {
            await this._handleNotAuthorizedError(sim, request);
        }
    }

    private async _handleNotLoggedIn(sim: TSim, request: PartitionAuthRequest) {
        console.log(`[AuthCoordinator] [${sim.id}] Not logged in`);
        const endpoint = sim.auth.primary;
        let key: string = await endpoint.getConnectionKey();

        if (!key) {
            if (!(await endpoint.isAuthenticated())) {
                console.log(`[AuthCoordinator] [${sim.id}] Logging in...`);
                await endpoint.authenticate();
                key = await endpoint.getConnectionKey();
            }
        }

        if (key) {
            const connectionId = sim.configBotId;
            const recordName = sim.origin.recordName;
            const inst = sim.inst;
            const token = generateV1ConnectionToken(
                key,
                connectionId,
                recordName,
                inst
            );

            console.log(
                `[AuthCoordinator] [${sim.id}] Sending connectionToken.`
            );

            sim.sendAuthMessage({
                type: 'response',
                success: true,
                origin: request.origin,
                indicator: {
                    connectionToken: token,
                },
            });
        }
    }

    private async _handleMissingPermission<TSim extends BrowserSimulation>(
        sim: TSim,
        request: PartitionAuthRequest,
        reason: AuthorizeActionMissingPermission
    ) {
        console.log(
            `[AuthCoordinator] [${sim.id}] Missing permission ${reason.resourceKind}.${reason.action}.`
        );
        this._onMissingPermission.next({
            simulationId: sim.id,
            errorCode: request.errorCode,
            errorMessage: request.errorMessage,
            origin: request.origin,
            reason,
        });
    }

    private async _handleNotAuthorizedError<TSim extends BrowserSimulation>(
        sim: TSim,
        request: PartitionAuthRequest
    ) {
        console.log(
            `[AuthCoordinator] [${sim.id}] Not authorized: ${request.errorMessage}.`
        );
        this._onNotAuthorized.next({
            simulationId: sim.id,
            errorCode: request.errorCode,
            errorMessage: request.errorMessage,
            origin: request.origin,
        });
    }

    unsubscribe(): void {
        return this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }
}

export interface MissingPermissionEvent {
    simulationId: string;
    errorCode: string;
    errorMessage: string;
    reason: AuthorizeActionMissingPermission;
    origin: string;
}

export interface ShowAccountInfoEvent {
    simulationId: string;
    loginStatus: LoginStatus;
}

export interface NotAuthorizedEvent {
    simulationId: string;
    errorCode: string;
    errorMessage: string;
    origin: string;
}

export interface RequestAccessEvent {
    simulationId: string;
    origin: string;
    reason: AuthorizeActionMissingPermission;
}
