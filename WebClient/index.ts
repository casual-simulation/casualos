
import Vue from 'vue';
import VueRouter from 'vue-router';
import VueMaterial from 'vue-material';
import 'vue-material/dist/vue-material.min.css'
import 'vue-material/dist/theme/default.css'

import App from './App/App';
import Welcome from './Welcome/Welcome';
// import * as git from 'isomorphic-git';
// import * as BrowserFS from 'browserfs';
// import * as pify from 'pify';
// import { FSModule } from 'browserfs/dist/node/core/FS';
import { polyfill } from 'es6-promise';

// Setup the Promise shim for browsers that don't support promises.
polyfill();

Vue.use(VueRouter);
Vue.use(VueMaterial);

const routes = [
    { path: '/', component: Welcome },
]

const router = new VueRouter({
    routes
});

const app = new Vue({
    router,
    render: createEle => createEle(App)
}).$mount('#app');

// let fs: FSModule;
// let pfs: any;

// start();

// async function exists(path: string) {
//     try {
//         return await pfs.exists(path);
//     } catch(ex) {
//         return ex;
//     }
// }

// async function start() {

//     console.log("Start!");

//     const app = new Vue({
//         el: '#app',
//         data: {
//             message: 'Helo, World'
//         }
//     });
// }

// async function dummyClone() {


//     let fsOptions = {
//         fs: 'IndexedDB',
//         options: {}
//     };

//     let configureAsync = pify(BrowserFS.configure);

//     await configureAsync(fsOptions);
//     fs = BrowserFS.BFSRequire('fs');

//     // Initialize isomorphic-git with our new file system
//     git.plugins.set('fs', fs);

//     pfs = pify(fs);
//     let dir = 'test-project';

//     let dirExists = await exists(dir);

//     if (!dirExists) {
//         console.log("Cloning...");

//         try {
//             await git.clone({
//                 dir,
//                 url: 'http://localhost:3000/git/root/test-project.git',
//                 ref: 'master'
//             });
//             console.log("Cloned!");
//         } catch (ex) {
//             console.error(ex);
//         }
//     }

//     let files = await pfs.readdir(dir);

//     console.log(files);
// }