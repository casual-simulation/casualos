import Component from 'vue-class-component';
import Vue from 'vue';
import { Prop, Watch } from 'vue-property-decorator';
import { appManager } from '../../AppManager';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import uuid from 'uuid/v4';
import { AuxUser } from '@casual-simulation/aux-vm';

@Component({
    components: {},
})
export default class LoginPopup extends Vue {
    @Prop({ required: true }) show: boolean;

    showProgress: boolean = false;
    showList: boolean = true;
    users: AuxUser[];

    private _sim: BrowserSimulation;

    close() {
        this.$emit('close');
    }

    @Watch('show')
    visibleChanged() {
        this._sim = appManager.simulationManager.primary;
        this.showProgress = false;
    }

    async created() {
        this.users = (await appManager.getUsers()).filter(u => !u.isGuest);
    }

    continueAsGuest() {
        this._login(`guest_${uuid()}`);
    }

    signIn(user: AuxUser) {
        this._login(user.username);
    }

    private async _login(username: string, grant?: string) {
        this.showProgress = true;

        const user = await appManager.getUser(username);
        await appManager.setCurrentUser(user);

        if (this._sim) {
            await this._sim.login.setUser(user);
        } else {
            console.error('[LoginPopup] Dont have a simulation!');
        }
        this.close();
    }
}
