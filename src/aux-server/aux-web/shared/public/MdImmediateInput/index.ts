import Vue from 'vue';
import MdImmediateInput from './MdImmediateInput.vue';

export default (vue: typeof Vue) => {
    vue.component((<any>MdImmediateInput).name, MdImmediateInput);
};