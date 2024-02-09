import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop } from 'vue-property-decorator';
import {
    AuthorizeActionMissingPermission,
    Bot,
    toast,
} from '@casual-simulation/aux-common';
import { Subscription } from 'rxjs';
import { appManager } from '../../../shared/AppManager';
import { LoginStatus } from '@casual-simulation/aux-vm';

@Component({
    components: {},
})
export default class AuthUI extends Vue {
    private _sub: Subscription;

    showNotAuthorized: boolean = false;

    /**
     * Whether the "User Requests Access" dialog should be shown.
     */
    showGrantAccess: boolean = false;
    showAccountInfo: boolean = false;
    loginStatus: LoginStatus = null;

    /**
     * Whether the "Request Access" button should be shown on the "Not Authorized" screen.
     */
    allowRequestAccess: boolean = false;

    requestingAccess: boolean = false;

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
                this._simId = e.simulationId;
                this._origin = e.origin;
            })
        );
        this._sub.add(
            appManager.authCoordinator.onShowAccountInfo.subscribe((e) => {
                this.showAccountInfo = true;
                this.loginStatus = e.loginStatus;
                this._simId = e.simulationId;
            })
        );
        this._sub.add(
            appManager.authCoordinator.onRequestAccess.subscribe((e) => {
                this.showGrantAccess = true;
                this._simId = e.simulationId;
                this._origin = e.origin;
                this._missingPermissionReason = e.reason;
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
        if (this._simId) {
            const simId = this._simId;
            this.closeAccountInfo();
            await appManager.authCoordinator.openAccountDashboard(simId);
        }
    }

    async logout() {
        if (this._simId) {
            const simId = this._simId;
            this.closeAccountInfo();
            await appManager.authCoordinator.logout(simId);
            location.reload();
        }
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
                const result =
                    await appManager.authCoordinator.requestAccessToMissingPermission(
                        simId,
                        origin,
                        this._missingPermissionReason
                    );

                if (result.success === true) {
                    location.reload();
                } else {
                    // TODO: show error
                }
            } finally {
                this.requestingAccess = false;
            }
        }
    }

    async grantAccess() {
        if (this._simId && this._origin && this._missingPermissionReason) {
            const simId = this._simId;
            const origin = this._origin;
            await appManager.authCoordinator.respondToPermissionRequest(
                simId,
                origin,
                {
                    type: 'permission_result',
                    success: true,
                    recordName: this._missingPermissionReason.recordName,
                    resourceKind: this._missingPermissionReason.resourceKind,
                    resourceId: this._missingPermissionReason.resourceId,
                    subjectType: this._missingPermissionReason.subjectType,
                    subjectId: this._missingPermissionReason.subjectId,
                    origin: origin,
                }
            );
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
                    errorMessage: 'User denied access.',
                }
            );
        }
    }
}
