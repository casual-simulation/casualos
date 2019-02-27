import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Watch, Prop } from 'vue-property-decorator';
import { Object } from '@yeti-cgi/aux-common';
import { FileRenderer } from '../../shared/scene/FileRenderer';
import { appManager } from '../../shared/AppManager';

@Component({
    components: {
    },
})
export default class MiniFile extends Vue {

    @Prop() file: Object;
    @Prop({ default: false }) large: boolean;
    @Prop({ default: false }) selected: boolean;

    image: string = '';
    label: string = '';
    labelColor: string = '#000';

    @Inject() fileRenderer: FileRenderer;

    @Watch('file')
    private async _fileChanged(file: Object) {
        this.image = await this.fileRenderer.render(file);
        let label = file.tags.label;
        if (label) {
            this.label = appManager.fileManager.calculateFormattedFileValue(file, 'label');

            const labelColor = file.tags['label.color'];
            if (labelColor) {
                this.labelColor = appManager.fileManager.calculateFormattedFileValue(file, 'label.color');

            } else {
                this.labelColor = '#000';
            }
        } else {
            this.label = '';
        }
    }

    constructor() {
        super();
        this.image = '';
    }

    mounted() {
        this._fileChanged(this.file);
    }

    click() {
        this.$emit('click');
    }
};