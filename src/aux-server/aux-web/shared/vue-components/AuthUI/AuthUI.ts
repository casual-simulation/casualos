import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop } from 'vue-property-decorator';
import type {
    ActionKinds,
    AuthorizeActionMissingPermission,
} from '@casual-simulation/aux-common';
import { Bot, toast } from '@casual-simulation/aux-common';
import { Subscription } from 'rxjs';
import { appManager } from '../../../shared/AppManager';
import type { LoginStatus } from '@casual-simulation/aux-vm';
import FieldErrors from '../FieldErrors/FieldErrors';
import type { FormError } from '@casual-simulation/aux-records';
import { getFormErrors } from '@casual-simulation/aux-records';

@Component({
    components: {
        'field-errors': FieldErrors,
    },
})
export default class AuthUI extends Vue {
    private _sub: Subscription;

    showNotAuthorized: boolean = false;

    /**
     * Whether the "User Requests Access" dialog should be shown.
     */
    showGrantAccess: boolean = false;
    requestingUserName: string = null;
    requestingUserDisplayName: string = null;
    requestingUserId: string = null;

    showAccountInfo: boolean = false;
    loginStatus: LoginStatus = null;

    get isLoggedIn() {
        return !!this.loginStatus;
    }

    /**
     * Whether the "Request Access" button should be shown on the "Not Authorized" screen.
     */
    allowRequestAccess: boolean = false;

    requestingAccess: boolean = false;
    requestAccessErrors: FormError[] = [];
    grantAccessErrors: FormError[] = [];
    processing: boolean = false;
    expireTimeMs: number = 0;
    grantPermissionLevel: 'full-access' | 'read-only' = 'full-access';

    reportInstVisible: boolean = false;

    private _simId: string = null;
    private _origin: string = null;

    private _missingPermissionReason: AuthorizeActionMissingPermission;

    constructor() {
        super();
    }

    created() {
        this.showNotAuthorized = false;
        this.showAccountInfo = false;
        this.loginStatus = null;
        this._sub = new Subscription();

        this._sub.add(
            appManager.authCoordinator.onMissingPermission.subscribe((e) => {
                this.showNotAuthorized = true;
                this.allowRequestAccess = false;
                this.loginStatus = appManager.auth.primary.currentLoginStatus;
                this._simId = e.simulationId;
                this._origin = e.origin;
                this._missingPermissionReason = e.reason;
                if (
                    e.reason.subjectType === 'user' &&
                    e.reason.resourceKind === 'inst'
                ) {
                    this.allowRequestAccess = true;
                }
            })
        );
        this._sub.add(
            appManager.authCoordinator.onNotAuthorized.subscribe((e) => {
                this.showNotAuthorized = true;
                this.loginStatus = appManager.auth.primary.currentLoginStatus;
                this._simId = e.simulationId;
                this._origin = e.origin;
            })
        );
        this._sub.add(
            appManager.authCoordinator.onShowAccountInfo.subscribe((e) => {
                this.showAccountInfo = true;
                this.loginStatus = e.loginStatus;
                this._simId = e.simulationId;

                this.reportInstVisible = false;
                if (this._simId) {
                    const sim = appManager.simulationManager.simulations.get(
                        this._simId
                    );
                    if (sim) {
                        if (!sim.origin.isStatic) {
                            this.reportInstVisible = true;
                        }
                    }
                }
            })
        );
        this._sub.add(
            appManager.authCoordinator.onRequestAccess.subscribe((e) => {
                if (
                    e.reason.subjectType === 'user' &&
                    e.reason.resourceKind === 'inst'
                ) {
                    this.showGrantAccess = true;
                    this.requestingUserName = e.user?.name ?? e.user.email;
                    this.requestingUserDisplayName =
                        e.user?.displayName ?? e.user.email;
                    this.requestingUserId =
                        e.user?.userId ?? e.reason.subjectId;
                    this.expireTimeMs = 1 * 60 * 60 * 1000; // 1 hour in ms
                    this.grantPermissionLevel = 'full-access';
                    this._simId = e.simulationId;
                    this._origin = e.origin;
                    this._missingPermissionReason = e.reason;
                    this.grantAccessErrors = [];
                }
            })
        );
    }

    beforeDestroy() {
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
    }

    closeNotAuthorized() {
        this.showNotAuthorized = false;
        this._simId = null;
        this._origin = null;
    }

    closeAccountInfo() {
        this.showAccountInfo = false;
        this._simId = null;
        this._origin = null;
    }

    async openAccountDashboard() {
        const simId = this._simId;
        this.closeAccountInfo();
        await appManager.authCoordinator.openAccountDashboard(simId);
    }

    async logout() {
        const simId = this._simId;
        this.closeAccountInfo();
        await appManager.authCoordinator.logout(simId);
        location.reload();
    }

    async changeLogin() {
        if (this._simId && this._origin) {
            const simId = this._simId;
            const origin = this._origin;
            this.closeNotAuthorized();
            await appManager.authCoordinator.changeLogin(simId, origin);
        }
    }

    async newInst() {
        location.href = location.origin;
    }

    async showReportInst() {
        if (this._simId) {
            const simId = this._simId;
            this.closeAccountInfo();
            await appManager.authCoordinator.showReportInst(simId);
        }
    }

    async requestAccess() {
        if (this._simId && this._origin && this._missingPermissionReason) {
            const simId = this._simId;
            const origin = this._origin;
            try {
                this.requestingAccess = true;
                this.requestAccessErrors = [];
                const result =
                    await appManager.authCoordinator.requestAccessToMissingPermission(
                        simId,
                        origin,
                        this._missingPermissionReason
                    );

                if (result.success === true) {
                    location.reload();
                } else {
                    this.requestAccessErrors = getFormErrors(result);
                }
            } finally {
                this.requestingAccess = false;
            }
        }
    }

    async grantAccess() {
        if (this._simId && this._origin && this._missingPermissionReason) {
            try {
                this.processing = true;
                const simId = this._simId;
                const origin = this._origin;
                const expireTimeMs =
                    this.expireTimeMs === 0
                        ? null
                        : Date.now() + this.expireTimeMs;
                const actions: ActionKinds[] =
                    this.grantPermissionLevel === 'full-access'
                        ? null
                        : ['read'];
                const result =
                    await appManager.authCoordinator.grantAccessToMissingPermission(
                        simId,
                        origin,
                        this._missingPermissionReason,
                        expireTimeMs,
                        actions
                    );

                if (result.success === true) {
                    this.grantAccessErrors = [];
                    this.showGrantAccess = false;
                } else {
                    this.grantAccessErrors = getFormErrors(result);
                }
            } finally {
                this.processing = false;
            }
        }
    }

    async denyAccess() {
        if (this._simId && this._origin && this._missingPermissionReason) {
            const simId = this._simId;
            const origin = this._origin;
            await appManager.authCoordinator.respondToPermissionRequest(
                simId,
                origin,
                {
                    type: 'permission_result',
                    success: false,
                    recordName: this._missingPermissionReason.recordName,
                    resourceKind: this._missingPermissionReason.resourceKind,
                    resourceId: this._missingPermissionReason.resourceId,
                    subjectType: this._missingPermissionReason.subjectType,
                    subjectId: this._missingPermissionReason.subjectId,
                    origin: origin,
                    errorCode: 'not_authorized',
                    errorMessage: 'The request for access was denied.',
                }
            );
            this.showGrantAccess = false;
        }
    }
}
