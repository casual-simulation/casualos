import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject } from 'vue-property-decorator';
import { SubscriptionLike } from 'rxjs';
import {
    Object,
    Bot,
    getShortId,
    AuxObject,
} from '@casual-simulation/aux-common';
import FileValue from '../FileValue/FileValue';
import { appManager } from '../../shared/AppManager';

@Component({
    components: {
        'file-value': FileValue,
    },
})
export default class FileRow extends Vue {
    @Prop() file: AuxObject;
    @Prop() tags: string[];
    @Prop({ default: false })
    readOnly: boolean;
    @Prop({})
    updateTime: number;
    @Prop({ default: true })
    showFormulasWhenFocused: boolean;

    get fileManager() {
        return appManager.simulationManager.primary;
    }

    private _sub: SubscriptionLike;

    constructor() {
        super();
    }

    async toggleFile(file: AuxObject) {
        await this.fileManager.selection.selectFile(
            file,
            false,
            this.fileManager.filePanel
        );
    }

    onTagChanged(tag: string, value: string) {
        this.$emit('tagChanged', this.file, tag, value);
    }

    getShortId(file: Object) {
        return getShortId(file);
    }

    tagFocusChanged(file: Object, tag: string, focused: boolean) {
        this.$emit('tagFocusChanged', {
            file,
            tag,
            focused,
        });
    }
}
