import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide, Watch, Prop } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';
import {
    ADMIN_ROLE_NAME,
    ActionKinds,
    DataActionKinds,
    FileActionKinds,
    MarkerPermission,
    PUBLIC_READ_MARKER,
    PUBLIC_WRITE_MARKER,
    ResourceKinds,
} from '@casual-simulation/aux-common';
import {
    MarkerPermissionAssignment,
    ResourcePermissionAssignment,
} from '@casual-simulation/aux-records';

@Component({
    components: {},
})
export default class AuthPermissions extends Vue {
    @Prop({ required: true })
    recordName: string;

    @Prop({ required: false })
    marker: string;

    @Prop({ required: false })
    resourceKind: ResourceKinds;

    @Prop({ required: false })
    resourceId: string;

    // markerPermissions: MarkerPermissionAssignment[] = [];
    // resourcePermissions: ResourcePermissionAssignment[] = [];

    markerItems: {
        mdCount: number;
        mdPage: number;
        startIndex: number;
        endIndex: number;
        mdData: MarkerPermissionAssignment[];
    } = {
        mdCount: 0,
        mdPage: 0,
        mdData: [],
        startIndex: 0,
        endIndex: 0,
    };

    resourceItems: {
        mdCount: number;
        mdPage: number;
        startIndex: number;
        endIndex: number;
        mdData: ResourcePermissionAssignment[];
    } = {
        mdCount: 0,
        mdPage: 0,
        mdData: [],
        startIndex: 0,
        endIndex: 0,
    };

    @Watch('marker')
    @Watch('recordName')
    @Watch('resourceKind')
    @Watch('resourceId')
    onMarkerChanged() {
        this._loadData();
    }

    created() {
        this._loadData();
    }

    private async _loadData() {
        if (this.marker) {
            await this._loadMarkerData();
        }

        if (this.resourceKind && this.resourceId) {
            await this._loadResourceData();
        }
    }

    private async _loadMarkerData() {
        const permissions = await authManager.listPermissions(this.recordName, {
            marker: this.marker,
        });

        if (permissions.success === true) {
            if (this.marker === PUBLIC_READ_MARKER) {
                const publicPermissions: [ResourceKinds, ActionKinds[]][] = [
                    ['data', ['read', 'list']],
                    ['file', ['read']],
                    ['event', ['count']],
                    ['inst', ['read']],
                ];

                for (let [resourceKind, actions] of publicPermissions) {
                    for (let action of actions) {
                        const permission: MarkerPermissionAssignment = {
                            id: `(auto)-${resourceKind}-${action}`,
                            recordName: this.recordName,
                            resourceKind: resourceKind as any,
                            action: action as any,
                            subjectType: 'role',
                            subjectId: 'everyone',
                            options: {},
                            marker: this.marker,
                            userId: null,
                            expireTimeMs: null,
                        };

                        permissions.markerPermissions.push(permission);
                    }
                }
            } else if (this.marker === PUBLIC_WRITE_MARKER) {
                const publicPermissions: [ResourceKinds, ActionKinds[]][] = [
                    ['data', ['read', 'create', 'update', 'delete', 'list']],
                    ['file', ['read', 'delete', 'create']],
                    ['event', ['count', 'increment', 'create']],
                    [
                        'inst',
                        [
                            'read',
                            'updateData',
                            'sendAction',
                            'delete',
                            'create',
                        ],
                    ],
                ];

                for (let [resourceKind, actions] of publicPermissions) {
                    for (let action of actions) {
                        const permission: MarkerPermissionAssignment = {
                            id: `(auto)-${resourceKind}-${action}`,
                            recordName: this.recordName,
                            resourceKind: resourceKind as any,
                            action: action as any,
                            subjectType: 'role',
                            subjectId: 'everyone',
                            options: {},
                            marker: this.marker,
                            userId: null,
                            expireTimeMs: null,
                        };

                        permissions.markerPermissions.push(permission);
                    }
                }
            }

            permissions.markerPermissions.push({
                id: `(auto)-admin`,
                recordName: this.recordName,
                resourceKind: null,
                action: null,
                subjectType: 'role',
                subjectId: ADMIN_ROLE_NAME,
                marker: this.marker,
                options: {},
                userId: null,
                expireTimeMs: null,
            });

            this.markerItems = {
                mdCount: permissions.markerPermissions.length,
                mdPage: 0,
                mdData: permissions.markerPermissions,
                startIndex: 0,
                endIndex: 0,
            };
            // this.markerPermissions = permissions.markerPermissions;
            // this.resourcePermissions = permissions.resourcePermissions;
        }
    }

    private async _loadResourceData() {
        const permissions = await authManager.listPermissions(this.recordName, {
            resourceKind: this.resourceKind,
            resourceId: this.resourceId,
        });

        if (permissions.success === true) {
            this.resourceItems = {
                mdCount: permissions.resourcePermissions.length,
                mdPage: 0,
                mdData: permissions.resourcePermissions,
                startIndex: 0,
                endIndex: 0,
            };
        }
    }
}
