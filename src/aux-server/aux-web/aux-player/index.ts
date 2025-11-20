/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import './importmap';
import Vue from 'vue';
import type { RouteConfig } from 'vue-router';
import VueRouter from 'vue-router';
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
    MdDatepicker,
    MdTabs,
    MdCheckbox,
    MdTooltip,
    MdSnackbar,
    MdSwitch,
    MdBadge,
    MdDialogPrompt,
    MdRadio,
} from 'vue-material/dist/components';
import 'vue-material/dist/vue-material.min.css';
import './themes/default.scss';
import './themes/dark.scss';
import 'virtual:svg-icons-register';
import MdImmediateInput from '../shared/public/MdImmediateInput';
import VueShortkey from '@casual-simulation/vue-shortkey';

import '@casual-simulation/aux-components/fonts/MaterialIcons/MaterialIcons.css';
import '@casual-simulation/aux-components/fonts/Roboto/Roboto.css';
import '@casual-simulation/aux-components/fonts/NotoSansKR/NotoSansKR.css';

import '@casual-simulation/aux-components/SVGPolyfill';

import { appManager, AppType } from '../shared/AppManager';
import PlayerApp from './PlayerApp/PlayerApp';
import PlayerHome from './PlayerHome/PlayerHome';
import { setTheme } from '../shared/StyleHelpers';

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
Vue.use(MdDatepicker);
Vue.use(MdRadio);
Vue.use(VueShortkey, {
    ignore: ['input.no-shortcuts', 'textarea.no-shortcuts'],
});
Vue.use(MdImmediateInput);

const url = new URL(document.location.href);

if (url.searchParams.has('theme')) {
    if (url.searchParams.get('theme') === 'dark') {
        setTheme('dark');
    } else {
        setTheme('light');
    }
} else if (
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
) {
    setTheme('dark');
} else {
    setTheme('auto');
}

const routes: RouteConfig[] = [
    {
        path: '*',
        name: 'home',
        component: PlayerHome,
        props: (route) => ({
            query: route.query,
            url: route.fullPath,
        }),
    },
];

const router = new VueRouter({
    mode: 'history',
    routes,
});

async function start() {
    // const loading = new Vue({
    //     render: (createEle) => createEle(Loading),
    // }).$mount('#loading');

    // await appManager.initPromise;

    const app = new Vue({
        router,
        render: (createEle) => createEle(PlayerApp),
    }).$mount('#app');
}

start();
