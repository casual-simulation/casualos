import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';
import { AvailablePermissions } from '@casual-simulation/aux-records';
import DataSize from '../DataSize/DataSize';

@Component({
    components: {
        'svg-icon': SvgIcon,
        'data-size': DataSize,
    },
})
export default class PermissionScope extends Vue {
    @Prop({ required: true })
    permission: AvailablePermissions;

    get isData() {
        return (
            this.permission.type === 'data.create' ||
            this.permission.type === 'data.delete' ||
            this.permission.type === 'data.list' ||
            this.permission.type === 'data.read' ||
            this.permission.type === 'data.update'
        );
    }

    get isFile() {
        return (
            this.permission.type === 'file.create' ||
            this.permission.type === 'file.delete' ||
            this.permission.type === 'file.list' ||
            this.permission.type === 'file.read' ||
            this.permission.type === 'file.update'
        );
    }

    get isEvent() {
        return (
            this.permission.type === 'event.count' ||
            this.permission.type === 'event.increment' ||
            this.permission.type === 'event.update'
        );
    }

    get isPolicy() {
        return (
            this.permission.type === 'policy.assign' ||
            this.permission.type === 'policy.grantPermission' ||
            this.permission.type === 'policy.revokePermission' ||
            this.permission.type === 'policy.list' ||
            this.permission.type === 'policy.read' ||
            this.permission.type === 'policy.unassign'
        );
    }

    get isRole() {
        return (
            this.permission.type === 'role.grant' ||
            this.permission.type === 'role.read' ||
            this.permission.type === 'role.list' ||
            this.permission.type === 'role.revoke' ||
            this.permission.type === 'role.update'
        );
    }
}
