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
import type { Observable, SubscriptionLike } from 'rxjs';
import {
    BehaviorSubject,
    NEVER,
    Subject,
    Subscription,
    filter,
    firstValueFrom,
    switchMap,
} from 'rxjs';
import type { BrowserSimulation } from './BrowserSimulation';
import type {
    AuthHelperInterface,
    SimulationManager,
} from '@casual-simulation/aux-vm/managers';
import type { AuthHelper } from './AuthHelper';
import type {
    ActionKinds,
    AuthorizeActionMissingPermission,
    PartitionAuthExternalPermissionResult,
    PartitionAuthPermissionResult,
    PartitionAuthRequest,
    PublicUserInfo,
} from '@casual-simulation/aux-common';
import {
    asyncResult,
    hasValue,
    reportInst,
    generateV1ConnectionToken,
} from '@casual-simulation/aux-common';
import type { LoginStatus } from '@casual-simulation/aux-vm/auth';
import type {
    GrantMarkerPermissionResult,
    GrantResourcePermissionResult,
    ValidateSessionKeyFailure,
} from '@casual-simulation/aux-records';
import type { GrantEntitlementsAction } from '@casual-simulation/aux-runtime';

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
    private _onGrantEntitlements: Subject<GrantEntitlementsEvent> =
        new Subject();
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

    get onGrantEntitlements(): Observable<GrantEntitlementsEvent> {
        return this._onGrantEntitlements;
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
                                user: msg.user,
                            });
                        }
                    })
                );

                sub.add(
                    sim.localEvents.subscribe((event) => {
                        if (event.type === 'show_account_info') {
                            this.showAccountInfo(sim.id);
                            if (hasValue(event.taskId)) {
                                sim.helper.transaction(
                                    asyncResult(event.taskId, null)
                                );
                            }
                        } else if (event.type === 'grant_record_entitlements') {
                            this._onGrantEntitlements.next({
                                simulationId: sim.id,
                                action: event,
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
        } else {
            await this.authHelper?.primary.openAccountPage();
        }
    }

    async logout(simId: string) {
        const sim = this._simulationManager.simulations.get(simId);
        if (sim) {
            await sim.auth.primary.logout();
        } else {
            await this.authHelper?.primary.logout();
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
                    endpoint: endpoint.origin,
                });
            }
        } else if (this.authHelper) {
            const endpoint = this.authHelper.primary;
            const status = endpoint.currentLoginStatus;
            if (status) {
                this._onShowAccountInfo.next({
                    simulationId: null,
                    loginStatus: status,
                    endpoint: endpoint.origin,
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

            const response = await Promise.race([
                promise,
                new Promise<PartitionAuthExternalPermissionResult>(
                    (resolve) => {
                        setTimeout(() => {
                            resolve({
                                type: 'external_permission_result',
                                origin,
                                success: false,
                                recordName: reason.recordName,
                                resourceKind: reason.resourceKind,
                                resourceId: reason.resourceKind,
                                subjectType: reason.subjectType,
                                subjectId: reason.subjectId,
                                errorCode: 'not_authorized',
                                errorMessage: 'The request expired.',
                            });
                        }, 45 * 1000);
                    }
                ),
            ]);

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
        expireTimeMs: number = null,
        actions: ActionKinds[] = null
    ): Promise<
        | GrantMarkerPermissionResult
        | GrantResourcePermissionResult
        | ValidateSessionKeyFailure
    > {
        const sim = this._simulationManager.simulations.get(simId);
        if (sim) {
            const recordName = reason.recordName;
            const resourceKind = reason.resourceKind;
            const resourceId = reason.resourceId;
            const subjectType = reason.subjectType;
            const subjectId = reason.subjectId;

            if (!actions) {
                const result = await sim.auth.primary.grantPermission(
                    recordName,
                    {
                        resourceKind,
                        resourceId,
                        subjectType,
                        subjectId,
                        action: null,
                        options: {},
                        expireTimeMs,
                    }
                );

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
            } else {
                for (let action of actions) {
                    const result = await sim.auth.primary.grantPermission(
                        recordName,
                        {
                            resourceKind,
                            resourceId,
                            subjectType,
                            subjectId,
                            action: action as any,
                            options: {},
                            expireTimeMs,
                        }
                    );

                    if (result.success === false) {
                        return result;
                    }
                }

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

                return {
                    success: true,
                };
            }
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

    async grantEntitlements(entitlementGrantEvent: GrantEntitlementsEvent) {
        const sim = this._simulationManager.simulations.get(
            entitlementGrantEvent.simulationId
        );
        if (sim) {
            await sim.records.grantEntitlements(entitlementGrantEvent.action);
        }
    }

    async denyEntitlements(entitlementGrantEvent: GrantEntitlementsEvent) {
        const sim = this._simulationManager.simulations.get(
            entitlementGrantEvent.simulationId
        );
        if (sim) {
            sim.helper.transaction(
                asyncResult(entitlementGrantEvent.action.taskId, {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: 'The request for access was denied.',
                })
            );
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
                await endpoint.relogin();
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
        } else if (request.reason?.type === 'invalid_token') {
            // Trying to watch a branch that the current connection token doesn't support
            await this._handleInvalidToken(sim, request);
        } else {
            await this._handleNotAuthorizedError(sim, request);
        }
    }

    private async _handleInvalidToken(
        sim: TSim,
        request: PartitionAuthRequest
    ) {
        const recordName = request.resource?.recordName;
        const inst = request.resource?.inst;
        const branch = request.resource?.branch;

        if (!recordName || !inst || !branch) {
            console.log(
                `[AuthCoordinator] [${sim.id}] Invalid token request missing recordName, inst, or branch`
            );
            return;
        }

        // Only allow automatically loading branches that start with 'doc/'
        // This is a temporary solution to prevent loading actual existing inst data and instead only allow loading
        // shared documents from other records
        if (!branch.startsWith('doc/')) {
            console.error(
                `[AuthCoordinator] [${sim.id}] Invalid token request branch does not start with 'doc/'`
            );
            return;
        }

        console.log(`[AuthCoordinator] [${sim.id}] Needs new indicator`);
        const endpoint = sim.auth.primary;
        const key = await endpoint.getConnectionKey();

        if (!key) {
            console.log(
                `[AuthCoordinator] [${sim.id}] Sending connectionId for ${recordName}/${inst}.`
            );
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
            const token = generateV1ConnectionToken(
                key,
                connectionId,
                recordName,
                inst
            );
            console.log(
                `[AuthCoordinator] [${sim.id}] Sending connectionToken for ${recordName}/${inst}.`
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
            if (request.resource) {
                // Only allow automatically loading branches that start with 'doc/'
                // This is a temporary solution to prevent loading actual existing inst data and instead only allow loading
                // shared documents from other records
                if (
                    !request.resource.branch.startsWith('doc/') &&
                    (request.resource.inst !== sim.inst ||
                        request.resource.recordName !== sim.origin.recordName)
                ) {
                    console.error(
                        `[AuthCoordinator] [${sim.id}] Invalid login request branch does not start with 'doc/' and is not for the current inst.`
                    );
                    return;
                }
            }

            const recordName =
                request.resource?.recordName ?? sim.origin.recordName;
            const inst = request.resource?.inst ?? sim.inst;
            const connectionId = sim.configBotId;

            const token = generateV1ConnectionToken(
                key,
                connectionId,
                recordName,
                inst
            );

            console.log(
                `[AuthCoordinator] [${sim.id}] Sending connectionToken for ${recordName}/${inst}.`
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
    /**
     * The ID of the simulation that the account info should be shown for.
     * If null, then the account info should be shown for the default auth endpoint.
     */
    simulationId: string;
    loginStatus: LoginStatus;

    /**
     * The endpoint that the login status comes from.
     */
    endpoint: string;
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

    /**
     * The info about the user that is requesting the permission.
     */
    user: PublicUserInfo | null;
}

export interface GrantEntitlementsEvent {
    simulationId: string;
    action: GrantEntitlementsAction;
}
