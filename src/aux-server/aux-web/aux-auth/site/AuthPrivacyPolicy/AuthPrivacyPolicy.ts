import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import privacyPolicyHtml from 'virtual:policies/privacy-policy.md';

@Component({
    components: {},
})
export default class AuthTerms extends Vue {
    get origin() {
        return location.origin;
    }

    get hostname() {
        return location.hostname;
    }

    get privacyPolicyHtml() {
        return privacyPolicyHtml;
    }
}
