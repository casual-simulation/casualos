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
    private async _fileChanged(file: AuxFile) {
        this.image = await this.fileRenderer.render(
            file,
            appManager.simulationManager.primary.helper.createContext(),
            false
        );

        this.isEmpty = tagsOnFile(file).length === 0;

        let label = file.tags['aux.label'];
        if (label) {
            this.label = appManager.simulationManager.primary.helper.calculateFormattedFileValue(
                file,
                'aux.label'
            );

            const labelColor = file.tags['aux.label.color'];
            if (labelColor) {
                this.labelColor = appManager.simulationManager.primary.helper.calculateFormattedFileValue(
                    file,
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

    constructor() {
        super();
        this.image = '';
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

    private _handleFileRenderRefresh(file: AuxFile): void {
        if (this.file === file) {
            this._fileChanged(file);
        }
    }
}
