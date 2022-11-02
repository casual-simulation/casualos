import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject } from 'vue-property-decorator';
import {} from '@casual-simulation/aux-common';

@Component({
    components: {},
})
export default class HighlightedText extends Vue {
    @Prop() text: string;
    @Prop() startIndex: number;
    @Prop() endIndex: number;

    constructor() {
        super();
    }
}
