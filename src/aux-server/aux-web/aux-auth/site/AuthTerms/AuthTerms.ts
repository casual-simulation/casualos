import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import termsOfServiceHtml from 'virtual:policies/terms-of-service.md';
// const termsOfServiceHtml = '';

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

    get termsHtml() {
        return termsOfServiceHtml;
    }
}
