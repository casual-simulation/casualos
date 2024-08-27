import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';
import AuthRecordsData from '../AuthRecordsData/AuthRecordsData';
import AuthRecordsFiles from '../AuthRecordsFiles/AuthRecordsFiles';
import AuthRecordsEvents from '../AuthRecordsEvents/AuthRecordsEvents';
import AuthRecordsRoles from '../AuthRecordsRoles/AuthRecordsRoles';
import AuthRecordsInsts from '../AuthRecordsInsts/AuthRecordsInsts';
import AuthRecordsWebhooks from '../AuthRecordsWebhooks/AuthRecordsWebhooks';

@Component({
    components: {
        'svg-icon': SvgIcon,
        'records-data': AuthRecordsData,
        'records-files': AuthRecordsFiles,
        'records-events': AuthRecordsEvents,
        'records-roles': AuthRecordsRoles,
        'records-insts': AuthRecordsInsts,
        'records-webhooks': AuthRecordsWebhooks,
    },
})
export default class AuthRecords extends Vue {
    @Prop({ required: true })
    recordName: string;

    created() {}
}
