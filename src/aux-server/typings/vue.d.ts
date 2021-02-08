declare module '*.vue' {
    import { VueClass } from 'vue-class-component/lib/declarations';
    const component: VueClass<any>;
    export default component;
}
