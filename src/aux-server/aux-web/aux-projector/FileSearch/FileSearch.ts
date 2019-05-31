import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject, Watch } from 'vue-property-decorator';
import { EventBus } from '../../shared/EventBus';
import {
    AuxObject,
    getShortId,
    formatValue,
} from '@casual-simulation/aux-common';
import { appManager } from '../../shared/AppManager';
import { SubscriptionLike } from 'rxjs';

@Component({
    components: {},
})
export default class FileSearch extends Vue {
    isOpen: boolean = false;
    files: AuxObject[] = [];
    search: string = '';

    toggleOpen() {
        appManager.simulationManager.primary.filePanel.toggleOpen();
    }

    async executeSearch() {
        const events = appManager.simulationManager.primary.helper.formulaEvents(
            this.search
        );
        await appManager.simulationManager.primary.helper.transaction(
            ...events
        );
    }

    @Watch('search')
    onSearchChanged() {
        appManager.simulationManager.primary.filePanel.search = this.search;
        appManager.simulationManager.primary.filePanel.isOpen = true;
    }

    get placeholder() {
        if (this.files.length > 0) {
            let val = formatValue(this.files);

            if (val != '[empty]' && val != '[diff-]') {
                return formatValue(this.files);
            } else {
                return 'Search / Run';
            }
        } else {
            return 'Search / Run';
        }
    }

    constructor() {
        super();
    }

    get filesLength() {
        let num = 0;
        let temp = this.files.length;

        if (temp != 1) {
            num = this.files.length;
        } else {
            let id = this.files[0].id;
            if (
                id == 'empty' ||
                (id.includes('-') && id.split('-')[0] == 'diff')
            ) {
                num = 0;
            } else {
                num = 1;
            }
        }

        return num;
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
                }),
                fileManager.filePanel.searchUpdated.subscribe(search => {
                    this.search = search;
                })
            );
            return subs;
        });
    }
}
