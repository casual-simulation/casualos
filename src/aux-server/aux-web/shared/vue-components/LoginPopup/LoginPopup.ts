import Component from 'vue-class-component';
import Vue from 'vue';
import { Prop, Watch } from 'vue-property-decorator';
import { appManager } from '../../AppManager';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { AuxUser } from '@casual-simulation/aux-vm';
import { loginToSim, generateGuestId } from '../../LoginUtils';

@Component({
    components: {},
})
export default class LoginPopup extends Vue {
    @Prop({ required: true }) show: boolean;

    showProgress: boolean = false;
    addingUser: boolean = false;
    users: AuxUser[] = [];
    username: string = '';

    private _sim: BrowserSimulation;

    get hasUsers() {
        return this.users.length > 0;
    }

    get showList() {
        return this.hasUsers && !this.addingUser;
    }

    close() {
        this.$emit('close');
    }

    @Watch('show')
    async visibleChanged() {
        this._reset();
        if (this.show) {
            this.users = await appManager.getUsers();
        }
    }

    addUser() {
        this.addingUser = true;
    }

    async continueAsGuest() {
        await this._login(generateGuestId());
        window.location.reload();
    }

    continueAsUsername() {
        this._login(this.username);
    }

    signIn(user: AuxUser) {
        this._login(user.username);
    }

    private _reset() {
        this._sim = appManager.simulationManager.primary;
        this.showProgress = false;
        this.addingUser = false;
        this.username = '';
    }

    private async _login(username: string, grant?: string) {
        this.showProgress = true;

        if (this._sim) {
            await loginToSim(this._sim, username);
        } else {
            console.error('[LoginPopup] Dont have simulation!');
        }
        this.close();
    }
}
