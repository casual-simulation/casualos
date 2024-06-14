import { DenialReason, ServerError } from '@casual-simulation/aux-common';
import { AuthorizeSubjectFailure, PolicyController } from './PolicyController';
import { RecordsStore } from './RecordsStore';
import { ConfigurationStore } from './ConfigurationStore';
import {
    getLoomFeatures,
    getSubscriptionFeatures,
} from './SubscriptionConfiguration';
import { MetricsStore } from './MetricsStore';
import * as jose from 'jose';

export interface LoomControllerOptions {
    policies: PolicyController;
    store: RecordsStore;
    config: ConfigurationStore;
    metrics: MetricsStore;
}

/**
 * Defines a class that is able to handle loom-related operations and tasks.
 */
export class LoomController {
    /**
     * The policy controller that is used to check if the user is allowed to perform certain actions.
     */
    private _policies: PolicyController;
    private _store: RecordsStore;
    private _config: ConfigurationStore;
    private _metrics: MetricsStore;

    constructor(options: LoomControllerOptions) {
        this._policies = options.policies;
        this._store = options.store;
        this._config = options.config;
        this._metrics = options.metrics;
    }

    /**
     * Gets a token that can be used to record loom videos.
     *
     * @param request The request.
     */
    async getToken(request: LoomGetTokenRequest): Promise<LoomGetTokenResult> {
        try {
            const context = await this._policies.constructAuthorizationContext({
                userId: request.userId,
                recordKeyOrRecordName: request.recordName,
            });

            if (context.success === false) {
                return context;
            }

            const authorization =
                await this._policies.authorizeSubjectUsingContext(
                    context.context,
                    {
                        resourceKind: 'loom',
                        action: 'create',
                        markers: null,
                        subjectId: request.userId,
                        subjectType: 'user',
                    }
                );

            if (authorization.success === false) {
                return authorization;
            }

            if (!context.context.recordStudioId) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The record does not belong to a studio.',
                };
            }
            const studioId = context.context.recordStudioId;

            const metrics = await this._metrics.getSubscriptionRecordMetrics({
                studioId: studioId,
            });
            const config = await this._config.getSubscriptionConfiguration();
            const features = getLoomFeatures(
                config,
                metrics.subscriptionStatus,
                metrics.subscriptionId
            );

            if (!features.allowed) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'Loom features are not enabled for this subscription.',
                };
            }

            const loomConfig = await this._store.getStudioLoomConfig(studioId);

            if (!loomConfig) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage:
                        'The studio does not have a loom configuration.',
                };
            }

            const privateKey = await jose.importPKCS8(
                loomConfig.privateKey,
                'RS256'
            );
            const jws = await new jose.SignJWT({})
                .setProtectedHeader({ alg: 'RS256' })
                .setIssuedAt((request.nowMs ?? Date.now()) / 1000)
                .setIssuer(loomConfig.appId)
                .setExpirationTime('10m')
                .sign(privateKey);

            return {
                success: true,
                token: jws,
            };
        } catch (err) {
            console.error('[LoomController] Failed to get token', err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }
}

export interface LoomGetTokenRequest {
    /**
     * The ID of the user that is logged in.
     */
    userId: string;

    /**
     * The name of the record that the user wants to access.
     */
    recordName: string;

    /**
     * The current unix time in miliseconds.
     * If omitted, then Date.now() will be used.
     */
    nowMs?: number;
}

export type LoomGetTokenResult = LoomGetTokenSuccess | LoomGetTokenFailure;

export interface LoomGetTokenSuccess {
    success: true;

    /**
     * The token that was retrieved.
     */
    token: string;
}

export interface LoomGetTokenFailure {
    success: false;

    /**
     * The error code that was encountered.
     */
    errorCode:
        | ServerError
        | AuthorizeSubjectFailure['errorCode']
        | 'invalid_request';

    /**
     * The error message.
     */
    errorMessage: string;

    /**
     * The denial reason.
     */
    reason?: DenialReason;
}
