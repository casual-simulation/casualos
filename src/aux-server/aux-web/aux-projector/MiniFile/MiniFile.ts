import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Watch, Prop } from 'vue-property-decorator';
import {
    Object,
    AuxFile,
    tagsOnFile,
    fileTags,
} from '@casual-simulation/aux-common';
import { FileRenderer } from '../../shared/scene/FileRenderer';
import { appManager } from '../../shared/AppManager';
import TagColor from '../../shared/vue-components/TagColor/TagColor';
import { EventBus } from '../../shared/EventBus';
import { debounce } from 'lodash';

@Component({
    components: {
        'tag-color': TagColor,
    },
})
export default class MiniFile extends Vue {
    @Prop() file: AuxFile;
    @Prop({ default: false })
    large: boolean;
    @Prop({ default: false })
    selected: boolean;
    @Prop({ default: false })
    diffball: boolean;

    @Prop({ default: false })
    isSearch: boolean;

    image: string = '';
    label: string = '';
    labelColor: string = '#000';
    isEmpty: boolean = false;

    @Inject() fileRenderer: FileRenderer;

    get tags() {
        let tags = fileTags([this.file], [], []);
        tags.sort();
        return ['id', ...tags];
    }

    @Watch('file')
    private _fileChanged(file: AuxFile) {
        this._updateFile();
    }

    constructor() {
        super();
        this.image = '';
    }

    created() {
        this._updateFile = debounce(this._updateFile.bind(this), 100);
    }

    mounted() {
        this._fileChanged(this.file);
        EventBus.$on('file_render_refresh', this._handleFileRenderRefresh);
    }

    beforeDestroy() {
        EventBus.$off('file_render_refresh', this._handleFileRenderRefresh);
    }

    click() {
        this.$emit('click');
    }

    private async _updateFile() {
        this.image = await this.fileRenderer.render(
            this.file,
            appManager.simulationManager.primary.helper.createContext(),
            false
        );

        this.isEmpty = tagsOnFile(this.file).length === 0;

        let label = this.file.tags['aux.label'];
        if (label) {
            this.label = appManager.simulationManager.primary.helper.calculateFormattedFileValue(
                this.file,
                'aux.label'
            );

            const labelColor = this.file.tags['aux.label.color'];
            if (labelColor) {
                this.labelColor = appManager.simulationManager.primary.helper.calculateFormattedFileValue(
                    this.file,
                    'aux.label.color'
                );
            } else {
                this.labelColor = '#000';
            }
        } else {
            this.label = '';
        }
        this.$forceUpdate();
    }

    private _handleFileRenderRefresh(file: AuxFile): void {
        if (this.file === file) {
            this._fileChanged(file);
        }
    }
}
