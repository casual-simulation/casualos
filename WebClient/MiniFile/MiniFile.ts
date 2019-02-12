import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Watch, Prop } from 'vue-property-decorator';
import { Object } from 'common/Files';
import { FileRenderer } from '../game-engine/FileRenderer';

@Component({
    components: {
    },
})
export default class MiniFile extends Vue {

    @Prop() file: Object;
    @Prop({ default: false }) large: boolean;
    @Prop({ default: false }) selected: boolean;

    image: string = '';

    @Inject() fileRenderer: FileRenderer;

    @Watch('file')
    private async _fileChanged(file: Object) {
        this.image = await this.fileRenderer.render(file);
    }

    constructor() {
        super();
        this.image = '';
    }

    click() {
        this.$emit('click');
    }
};