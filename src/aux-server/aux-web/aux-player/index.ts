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
    MdDialogPrompt,
} from 'vue-material/dist/components';
import 'vue-material/dist/vue-material.min.css';
import 'vue-material/dist/theme/default.css';
import VueClipboard from 'vue-clipboard2';
import VueShortkey from 'vue-shortkey';

import '../shared/public/fonts/MaterialIcons/MaterialIcons.css';
import '../shared/public/fonts/Roboto/Roboto.css';

import { polyfill } from 'es6-promise';
import 'offline-plugin/runtime';

import { appManager, AppType } from '../shared/AppManager';
import PlayerApp from './PlayerApp/PlayerApp';
import PlayerHome from './PlayerHome/PlayerHome';
import Loading from '../shared/vue-components/Loading/Loading';

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
Vue.use(MdDialogAlert);
Vue.use(MdTabs);
Vue.use(MdTooltip);
Vue.use(MdSnackbar);
Vue.use(MdSwitch);
Vue.use(MdBadge);
Vue.use(MdDialogPrompt);
Vue.use(VueShortkey, {
    prevent: ['input', 'textarea'],
});
Vue.use(VueClipboard);

function redirectToBuilder(id: string) {
    console.log('[Router] Redirecting to builder');
    const url = new URL(`/*/${id}`, window.location.href);
    window.location.href = url.href;
}

const routes: RouteConfig[] = [
    {
        path: '*',
        name: 'home',
        component: PlayerHome,
        props: route => ({
            query: route.query,
        }),
    },
];

const router = new VueRouter({
    mode: 'history',
    routes,
});

async function start() {
    const loading = new Vue({
        render: createEle => createEle(Loading),
    }).$mount('#loading');

    // await appManager.initPromise;

    const app = new Vue({
        router,
        render: createEle => createEle(PlayerApp),
    }).$mount('#app');
}

start();
