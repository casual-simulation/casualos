import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject, Watch } from 'vue-property-decorator';
import { EventBus } from '../../shared/EventBus';
import { AuxObject } from '@casual-simulation/aux-common';
import { appManager } from '../../shared/AppManager';
import { SubscriptionLike } from 'rxjs';

@Component({
    components: {},
})
export default class FileSearch extends Vue {
    isOpen: boolean = false;
    files: any = null;
    search: string = '';

    toggleOpen() {
        appManager.fileManager.filePanel.toggleOpen();
    }

    @Watch('search')
    onSearchChanged() {
        appManager.fileManager.filePanel.search = this.search;
    }

    constructor() {
        super();
    }

    mounted() {
        appManager.whileLoggedIn((user, fileManager) => {
            let subs: SubscriptionLike[] = [];
            subs.push(
                fileManager.filePanel.filesUpdated.subscribe(e => {
                    this.files = e.files;
                }),
                fileManager.filePanel.isOpenChanged.subscribe(open => {
                    this.isOpen = open;
                })
            );
            return subs;
        });
    }
}
