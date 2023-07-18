import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';

@Component({
    components: {
        'svg-icon': SvgIcon,
    },
})
export default class AuthRecordsFiles extends Vue {
    get recordName() {
        return this.$route.params.recordName;
    }

    created() {}
}
