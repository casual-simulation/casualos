import { AppMetadata, UserMetadata } from '../../../shared/AuthMetadata';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { Subscription } from 'rxjs';
import { debounce } from 'lodash';
import Avatar from '../AuthAvatar/AuthAvatar';
import Security from '../AuthSecurity/AuthSecurity';
import AuthSubscription from '../AuthSubscription/AuthSubscription';

@Component({
    components: {},
})
export default class AuthRecords extends Vue {}
