import Vue, { ComponentOptions } from 'vue';
import { Prop } from 'vue-property-decorator';
import Component from 'vue-class-component';
import { EventBus } from '../EventBus/EventBus';
import App from '../App/App';


@Component({
    components: {
        'confirm-dialog': ConfirmDialog
    }
})
export default class ConfirmDialog extends Vue {
    @Prop({ default: false}) active: boolean;
    @Prop({ default: null}) app: App;
    @Prop({ default: 'Title'}) title: string;
    @Prop({ default: 'Body'}) body: string;
    @Prop({ default: null}) okEvent: string;
    @Prop({ default: null}) cancelEvent: string;

    get dialogActive(): boolean {
        return this.active;
    }

    set dialogActive(isActive: boolean) { 
        // Do nothing.
    }
    
    okClicked() {
        if (this.okEvent != null)
            EventBus.$emit(this.okEvent);

        this.app.showConfirmDialog = false;
    }

    cancelClicked() {
        if (this.cancelEvent != null)
            EventBus.$emit(this.cancelEvent);

        this.app.showConfirmDialog = false;
    }
}