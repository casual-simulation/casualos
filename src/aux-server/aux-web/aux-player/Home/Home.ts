import Vue from 'vue';
import { Chrome } from 'vue-color';
import Component from 'vue-class-component';
import { Inject, Watch } from 'vue-property-decorator';
import { 
    Object,
    File,
    getUserMode,
    UserMode,
    DEFAULT_USER_MODE,
    Workspace
} from '@yeti-cgi/aux-common';
import GameView from '../GameView/GameView';
import { appManager } from '../../shared/AppManager';
import { SubscriptionLike } from 'rxjs';
import { tap } from 'rxjs/operators';

@Component({
    components: {
        'game-view': GameView,
    },
})
export default class Home extends Vue {

    debug: boolean = false;

    get user() {
        return appManager.user;
    }

    get fileManager() {
        return appManager.fileManager;
    }

    constructor() {
        super();
    }

    async created() {
    }
};