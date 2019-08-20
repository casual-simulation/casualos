import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';
import MonacoEditor from '../MonacoEditor/MonacoEditor';
import {
    File,
    isFormula,
    isDiff,
    merge,
    isFilterTag,
} from '@casual-simulation/aux-common';
import FileTag from '../FileTag/FileTag';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import { SubscriptionLike } from 'rxjs';

@Component({
    components: {
        'monaco-editor': MonacoEditor,
        'file-tag': FileTag,
    },
})
export default class TagValueEditor extends Vue {
    @Prop({ required: true }) tag: string;
    @Prop({ required: true }) file: File;
    @Prop() setLargeSheet: boolean;
    @Prop({ default: false }) showDesktopEditor: boolean;

    tagValue: any = '';

    private _simulation: BrowserSimulation;
    private _sub: SubscriptionLike;

    get isTagFormula(): boolean {
        return isFormula(this.tagValue);
    }

    get isTagScript(): boolean {
        return isFilterTag(this.tag);
    }

    get language(): string {
        return this.isTagScript ? 'javascript' : 'plaintext';
    }

    constructor() {
        super();
    }

    @Watch('tagValue')
    valueChanged() {
        let file = this.file;
        let tag = this.tag;
        let value = this.tagValue;
        if (!isDiff(null, file) && file.id !== 'empty') {
            this._simulation.recent.addTagDiff(
                `mod-${file.id}_${tag}`,
                tag,
                value
            );
            this._simulation.helper.updateFile(file, {
                tags: {
                    [tag]: value,
                },
            });
        } else {
            const updated = merge(file, {
                tags: {
                    [tag]: value,
                },
                values: {
                    [tag]: value,
                },
            });
            this._simulation.recent.addFileDiff(updated, true);
        }
    }

    @Watch('tag')
    tagChanged() {
        this._updateValue();
    }

    @Watch('file')
    fileChanged() {
        this._updateValue();
    }

    created() {
        this._sub = appManager.whileLoggedIn((user, sim) => {
            this._simulation = sim;
            return [];
        });
        this._updateValue();
    }

    destroyed() {
        if (this._sub) {
            this._sub.unsubscribe();
        }
    }

    resize() {
        if (this.$refs.editor) {
            (<MonacoEditor>this.$refs.editor).resize();
        }
    }

    getLargeSheetStyle() {
        if (this.setLargeSheet) {
            let editor = this.$refs.multiLineEditor;

            if (editor) {
                let pos;
                pos = (<Element>editor).getBoundingClientRect();

                if (pos) {
                    return {
                        height:
                            window.innerHeight - pos.top - 10 + 'px !important',
                        'max-height': '600px',
                    };
                } else {
                    return { height: '', 'max-height': '' };
                }
            }
        } else {
            return { height: '', 'max-height': '' };
        }
        return { height: '', 'max-height': '' };
    }

    private _updateValue() {
        if (this.isFocused()) {
            return;
        }

        if (this.tag && this.file) {
            let val = this.file.tags[this.tag];
            if (typeof val !== 'undefined' && val !== null) {
                this.tagValue = val.toString();
            } else {
                this.tagValue = val;
            }
        } else {
            this.tagValue = '';
        }
    }

    isFocused() {
        if (this.$el && document.activeElement) {
            return this.$el.contains(document.activeElement);
        }
        return false;
    }
}
