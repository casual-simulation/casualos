/**
 * MIT License
 *
 * Copyright (c) 2019 YETi CGI
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * @license MIT
 */

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
    MdSwitch,
    MdBadge,
} from 'vue-material/dist/components';
import 'vue-material/dist/vue-material.min.css';
import 'vue-material/dist/theme/default.css';
import 'pepjs'; // Polyfill for pointer events
import { polyfill } from 'es6-promise';
import 'offline-plugin/runtime';

import { appManager, AppType } from '../shared/AppManager';
import App from './App/App';
import Welcome from './Welcome/Welcome';
import Home from './Home/Home';

// Import the WebXR Polyfill
import 'webxr-polyfill';

// Setup the Promise shim for browsers that don't support promises.
polyfill();

appManager.appType = AppType.Player;

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
Vue.use(MdSwitch);
Vue.use(MdBadge);

const routes: RouteConfig[] = [
    {
        path: '/login',
        name: 'login',
        component: Welcome,
    },
    {
        path: '/:id?/:context?',
        name: 'home',
        component: Home,
    }
]

const router = new VueRouter({
    mode: 'history',
    routes
});

router.beforeEach((to, from, next) => {
    appManager.initPromise.then(() => {
        const channelId = to.params.id || null;
        const contextId = to.params.context || null;
        if (to.path !== '/login') {
            if (!appManager.user) {
                next({ name: 'login', query: { id: channelId, context: contextId } });
                return;
            } else {
                if (appManager.user.channelId != channelId) {
                    return appManager.loginOrCreateUser(appManager.user.email, channelId).then(() => {
                        location.reload();
                        next();
                    }, ex => {
                        console.error(ex);
                        next({ name: 'login', query: { id: channelId, context: contextId } });
                    });
                }
            }
        } else {
            if (appManager.user) {
                next({ name: 'home', params: { id: appManager.user.channelId, context: contextId }});
                return;
            }
        }

        if (appManager.user) {
            const userFile = appManager.fileManager.userFile;
            if (userFile.tags._userContext != contextId) {
                // Set the context for the user.
                console.log('[Router] Setting user\'s context to: ' + contextId);
                appManager.fileManager.updateFile(userFile, { tags: { _userContext: contextId }}).then(() => {
                    next();
                    return;
                });
            }
        }

        next();
    }, ex => {
        console.error(ex);
        next({ name: 'login' });
    });
});

const app = new Vue({
    router,
    render: createEle => createEle(App)
}).$mount('#app');