import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';
import AuthRecordsData from '../AuthRecordsData/AuthRecordsData';
import AuthRecordsFiles from '../AuthRecordsFiles/AuthRecordsFiles';
import AuthRecordsEvents from '../AuthRecordsEvents/AuthRecordsEvents';
import AuthRecordsPolicies from '../AuthRecordsPolicies/AuthRecordsPolicies';
import AuthRecordsRoles from '../AuthRecordsRoles/AuthRecordsRoles';

@Component({
    components: {
        'svg-icon': SvgIcon,
        'records-data': AuthRecordsData,
        'records-files': AuthRecordsFiles,
        'records-events': AuthRecordsEvents,
        'records-policies': AuthRecordsPolicies,
        'records-roles': AuthRecordsRoles,
    },
})
export default class AuthRecords extends Vue {
    get recordName() {
        return this.$route.params.recordName;
    }

    created() {}
}
