import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import acceptableUsePolicyHtml from 'virtual:policies/acceptable-use-policy.md';

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

    get acceptableUsePolicyHtml() {
        return acceptableUsePolicyHtml;
    }
}
