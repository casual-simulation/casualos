import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Watch, Prop } from 'vue-property-decorator';
import { Object, AuxFile, tagsOnFile, isTagWellKnown, fileTags } from '@casual-simulation/aux-common';
import { FileRenderer } from '../../shared/scene/FileRenderer';
import { appManager } from '../../shared/AppManager';
import TagColor from '../TagColor/TagColor';
import { sort } from '@casual-simulation/aux-common/Formulas/formula-lib';

@Component({
    components: {
        'tag-color': TagColor
    },
})
export default class MiniFile extends Vue {

    @Prop() file: AuxFile;
    @Prop({ default: false }) large: boolean;
    @Prop({ default: false }) selected: boolean;
    @Prop({ default: false }) diffball: boolean;

    image: string = '';
    label: string = '';
    labelColor: string = '#000';

    @Inject() fileRenderer: FileRenderer;

    get tags() {
        let tags = fileTags([this.file], [], []);
        tags = sort(tags);
        return ['id', ...tags];
    }

    @Watch('file')
    private async _fileChanged(file: AuxFile) {
        this.image = await this.fileRenderer.render(file, this.diffball);
        let label = file.tags['aux.label'];
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