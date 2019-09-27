import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Watch, Prop } from 'vue-property-decorator';
import {
    Object,
    AuxFile,
    tagsOnBot,
    botTags,
} from '@casual-simulation/aux-common';
import { BotRenderer } from '../../shared/scene/BotRenderer';
import { appManager } from '../../shared/AppManager';
import TagColor from '../../shared/vue-components/TagColor/TagColor';
import { EventBus } from '../../shared/EventBus';
import { debounce } from 'lodash';

@Component({
    components: {
        'tag-color': TagColor,
    },
})
export default class MiniBot extends Vue {
    @Prop() bot: AuxFile;
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

    @Inject() fileRenderer: BotRenderer;

    get tags() {
        let tags = botTags([this.bot], [], []);
        tags.sort();
        return ['id', ...tags];
    }

    @Watch('bot')
    private _fileChanged(bot: AuxFile) {
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
        this._fileChanged(this.bot);
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
            this.bot,
            appManager.simulationManager.primary.helper.createContext(),
            false
        );

        this.isEmpty = tagsOnBot(this.bot).length === 0;

        let label = this.bot.tags['aux.label'];
        if (label) {
            this.label = appManager.simulationManager.primary.helper.calculateFormattedFileValue(
                this.bot,
                'aux.label'
            );

            const labelColor = this.bot.tags['aux.label.color'];
            if (labelColor) {
                this.labelColor = appManager.simulationManager.primary.helper.calculateFormattedFileValue(
                    this.bot,
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

    private _handleFileRenderRefresh(bot: AuxFile): void {
        if (this.bot === bot) {
            this._fileChanged(bot);
        }
    }
}
