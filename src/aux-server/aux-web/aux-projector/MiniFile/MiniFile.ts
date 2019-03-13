import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Watch, Prop } from 'vue-property-decorator';
import { Object, AuxFile } from '@yeti-cgi/aux-common';
import { FileRenderer } from '../../shared/scene/FileRenderer';
import { appManager } from '../../shared/AppManager';

@Component({
    components: {
    },
})
export default class MiniFile extends Vue {

    @Prop() file: AuxFile;
    @Prop({ default: false }) large: boolean;
    @Prop({ default: false }) selected: boolean;

    image: string = '';
    label: string = '';
    labelColor: string = '#000';

    @Inject() fileRenderer: FileRenderer;

    @Watch('file')
    private async _fileChanged(file: AuxFile) {
        this.image = await this.fileRenderer.render(file);
        let label = file.tags.label;
        if (label) {
            this.label = appManager.fileManager.calculateFormattedFileValue(file, 'aux.label');

            const labelColor = file.tags['aux.label.color'];
            if (labelColor) {
                this.labelColor = appManager.fileManager.calculateFormattedFileValue(file, 'aux.label.color');

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