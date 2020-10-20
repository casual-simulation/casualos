import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';

@Component({})
export default class PieProgress extends Vue {
    @Prop({ required: true }) progress: number;
    @Prop({ required: true }) color: string;
    @Prop({ required: true }) backgroundColor: string;

    constructor() {
        super();
    }
}
