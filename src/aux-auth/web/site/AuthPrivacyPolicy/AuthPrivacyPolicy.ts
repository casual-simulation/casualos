import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';

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
}
