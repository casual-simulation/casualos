import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';

const emptyStyle = document.createElement('div').style;

@Component({})
export default class PieProgress extends Vue {
    @Prop({ required: true }) progress: number;
    @Prop({ required: true }) color: string;
    @Prop({ required: true }) backgroundColor: string;

    get supportsSVG() {
        return !!SVGElement && 'fill' in emptyStyle;
    }

    constructor() {
        super();
    }
}
