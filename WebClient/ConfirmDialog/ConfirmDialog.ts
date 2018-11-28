import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { EventBus } from '../EventBus/EventBus';
import App from '../App/App';
import ConfirmDialogOptions  from './ConfirmDialogOptions';

@Component
export default class ConfirmDialog extends Vue {
    active: boolean = false;
    app: App = null;
    options: ConfirmDialogOptions = null;

    okClicked() {
        if (this.options.okCallback != null) {
            this.options.okCallback();
        }
        this.app.showConfirmDialog = false;
    }

    cancelClicked() {
        if (this.options.cancelCallback != null) {
            this.options.cancelCallback();
        }
        this.app.showConfirmDialog = false;
    }
}