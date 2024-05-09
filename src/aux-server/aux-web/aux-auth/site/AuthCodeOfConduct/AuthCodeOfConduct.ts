import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import codeOfConductHtml from 'virtual:policies/code-of-conduct.md';

@Component({
    components: {},
})
export default class AuthCodeOfConduct extends Vue {
    get origin() {
        return location.origin;
    }

    get hostname() {
        return location.hostname;
    }

    get codeOfConductHtml() {
        return codeOfConductHtml;
    }
}
