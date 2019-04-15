/**
 * MIT License
 *
 * Copyright (c) 2019 Casual Simulation, Inc.
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
import VueShortkey from 'vue-shortkey';

import '../shared/public/fonts/MaterialIcons/MaterialIcons.css';
import '../shared/public/fonts/Roboto/Roboto.css';

import 'pepjs'; // Polyfill for pointer events
import { polyfill } from 'es6-promise';

import { appManager, AppType } from '../shared/AppManager';
import App from './App/App';
import Welcome from './Welcome/Welcome';
import Home from './Home/Home';
import AuxDebug from './AuxDebug/AuxDebug';
import Loading from '../shared/vue-components/Loading/Loading';

// Import the WebXR Polyfill
import 'webxr-polyfill';

// Setup the Promise shim for browsers that don't support promises.
polyfill();

appManager.appType = AppType.Builder;
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
Vue.use(VueShortkey);

const routes: RouteConfig[] = [
    {
        path: '/login',
        name: 'login',
        component: Welcome,
    },
    {
        path: '/:id?/aux-debug',
        name: 'aux-debug',
        component: AuxDebug
    },
    {
        path: '/:id/:context',
        name: 'aux-player',
        redirect: to => {
            if (appManager.config) {
                window.location.href = `${appManager.config.playerBaseUrl}/${to.params.id}/${to.params.context}`;
            }
            
            return `/${to.params.id}`;
        }
    },
    {
        path: '/:id?',
        name: 'home',
        component: Home,
    },
]

const router = new VueRouter({
    mode: 'history',
    routes
});

router.beforeEach((to, from, next) => {
    appManager.initPromise.then(() => {
        const channelId = to.params.id || null;
        if (to.path !== '/login') {
            if (!appManager.user) {
                next({ name: 'login', query: { id: channelId } });
                return;
            } else {
                if (appManager.user.channelId != channelId) {
                    console.log(`[Router] Changing channels: ${channelId}`);
                    return appManager.loginOrCreateUser(appManager.user.email, channelId).then(() => {
                        console.log(`[Router] Logged In!`);
                        next();
                    }, ex => {
                        console.error(ex);
                        next();
                        // next({ name: 'login', query: { id: channelId } });
                    });
                }
            }
        } else {
            if (appManager.user) {
                next({ name: 'home', params: { id: appManager.user.channelId }});
                return;
            }
        }
        next();
    }, ex => {
        console.error(ex);
        next();
    });
});

async function start() {
    const loading = new Vue({
        render: createEle => createEle(Loading)
    }).$mount('#loading');

    await appManager.initPromise;
    const app = new Vue({
        router,
        render: createEle => createEle(App)
    }).$mount('#app');

}

start();