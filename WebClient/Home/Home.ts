import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {File} from 'common';
import GameView from '../GameView/GameView';
import { EventBus } from '../EventBus/EventBus';
import { appManager } from '../AppManager';
import { fileManager } from '../FileManager';
import CubeIcon from './Cube.svg';

const numLoadingSteps: number = 4;

@Component({
    components: {
        'game-view': GameView,
        'cube-icon': CubeIcon
    }
})
export default class Home extends Vue {

    isOpen: boolean = false;
    status: string = '';
    files: File[] = [];
    tags: string[] = [];
    isMakingNewTag: boolean = false;
    newTag: string = 'myNewTag';

    isLoading: boolean = false;
    progress: number = 0;
    progressMode: "indeterminate" | "determinate" = "determinate";

    get user() {
        return appManager.user;
    }

    get hasFiles() {
        return this.files.length > 0;
    }

    open() {
        this.isOpen = true;
    }

    close() {
        this.isOpen = false;
    }

    addNewFile() {
        fileManager.createFile();
    }

    addNewWorkspace() {
        fileManager.createWorkspace();
    }

    addTag() {
        if (this.isMakingNewTag) {
            this.tags.push(this.newTag);
        }
        this.isMakingNewTag = !this.isMakingNewTag;
    }

    valueChanged(file: File, tag: string, value: string) {
        if (file.type === 'object') {
            fileManager.updateFile(file, {
                tags: {
                    [tag]: value
                }
            });
        }
    }

    async created() {
        EventBus.$on('openInfoCard', this.open);
        this.open();
        
        this.isLoading = true;

        this.files = [];
        this.tags = [];

        fileManager.fileUpdated.subscribe(file => {
            this.files = fileManager.selectedObjects;
            this.tags = fileManager.fileTags(this.files);
        });
        fileManager.fileSelected.subscribe(file => {
            this.files = fileManager.selectedObjects;
            this.tags = fileManager.fileTags(this.files);
        });

        this.isLoading = false;
        
        this._setStatus('Waiting for input...');
    }

    private _setStatus(status: string) {
        this.status = status;
        console.log('[Home] Status:', status);
    }
};