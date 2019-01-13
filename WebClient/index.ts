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
    MdSnackbar,
} from 'vue-material/dist/components';
import 'vue-material/dist/vue-material.min.css';
import 'vue-material/dist/theme/default.css';
import 'pepjs'; // Polyfill for pointer events
import { polyfill } from 'es6-promise';

import { appManager } from './AppManager';
import App from './App/App';
import Welcome from './Welcome/Welcome';
import Home from './Home/Home';
import Editor from './Editor/Editor';
import MergeConflicts from './MergeConflicts/MergeConflicts';

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
Vue.use(MdSnackbar);

const routes: RouteConfig[] = [
    {
        path: '/',
        component: Welcome,
        beforeEnter: (to, from, next) => {
            appManager.initPromise.then(() => {
                if (appManager.user) {
                    next({ path: '/home' });
                } else {
                    next();
                }
            }, ex => {
                next({ path: '/' });
            });
        }
    },
    {
        path: '/home',
        component: Home
    },
    {
        path: '/editor',
        component: Editor
    },
    {
        path: '/merge-conflicts',
        component: MergeConflicts,
        beforeEnter: (to, from, next) => {
            if (appManager.fileManager && appManager.fileManager.mergeStatus) {
                next();
            } else {
                next({ path: '/' });
            }
        }
    }
]

const router = new VueRouter({
    routes
});

router.beforeEach((to, from, next) => {
    if (to.path !== '/') {
        if (!appManager.user) {
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
