import * as Sentry from '@sentry/browser';
import Vue from 'vue';
import VueRouter, { RouteConfig } from 'vue-router';
import { 
    MdButton, 
    MdContent, 
    MdApp, 
    MdCard, 
    MdToolbar, 
    MdField, 
    MdProgress, 
    MdDrawer, 
    MdList, 
    MdMenu, 
    MdDialog, 
    MdDialogConfirm,
    MdDialogAlert,
    MdTabs,
    MdCheckbox,
    MdTooltip,
} from 'vue-material/dist/components';
import 'vue-material/dist/vue-material.min.css'
import 'vue-material/dist/theme/default.css'

import App from './App/App';
import Welcome from './Welcome/Welcome';
import { polyfill } from 'es6-promise';
import { appManager } from './AppManager';

const sentryEnv = PRODUCTION ? 'prod' : 'dev';

if (SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,
        integrations: [new Sentry.Integrations.Vue({ Vue: Vue })],
        release: GIT_HASH,
        environment: sentryEnv,
        enabled: ENABLE_SENTRY
    });
} else {
    console.log('Skipping Sentry Initialization');
}

const Home = () => import('./Home/Home');
const Editor = () => import('./Editor/Editor');

// Setup the Promise shim for browsers that don't support promises.
polyfill();

Vue.use(VueRouter);
Vue.use(MdButton);
Vue.use(MdCheckbox);
Vue.use(MdContent);
Vue.use(MdApp);
Vue.use(MdCard);
Vue.use(MdToolbar);
Vue.use(MdField);
Vue.use(MdProgress);
Vue.use(MdDrawer);
Vue.use(MdList);
Vue.use(MdMenu);
Vue.use(MdDialog);
Vue.use(MdDialogConfirm);
Vue.use(MdDialogAlert)
Vue.use(MdTabs);
Vue.use(MdTooltip);

const routes: RouteConfig[] = [
    {
        path: '/',
        component: Welcome,
        beforeEnter: (to, from, next) => {
            if (appManager.user !== null) {
                next({ path: '/home' });
            }
            else {
                next();
            }
        }
    },
    {
        path: '/home',
        component: Home
    },
    {
        path: '/editor',
        component: Editor
    }
]

const router = new VueRouter({
    routes
});

router.beforeEach((to, from, next) => {
    if (to.path !== '/') {
        if (appManager.user === null) {
            next({ path: '/' });
            return;
        }
    }
    next();
});

const app = new Vue({
    router,
    render: createEle => createEle(App)
}).$mount('#app');
