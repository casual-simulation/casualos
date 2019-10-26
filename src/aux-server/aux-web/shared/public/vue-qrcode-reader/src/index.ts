import QrcodeStream from "./components/QrcodeStream";
// import QrcodeCapture from "./components/QrcodeCapture.vue";
// import QrcodeDropZone from "./components/QrcodeDropZone.vue";

// Install the components
export function install(Vue: any) {
  Vue.component("qrcode-stream", QrcodeStream);
//   Vue.component("qrcode-capture", QrcodeCapture);
//   Vue.component("qrcode-drop-zone", QrcodeDropZone);
}

// Expose the components
export { 
    QrcodeStream,
    // QrcodeCapture,
    // QrcodeDropZone
};

/* -- Plugin definition & Auto-install -- */
/* You shouldn't have to modify the code below */

// Plugin
const plugin = { install };

export default plugin;

// Auto-install
let GlobalVue = null;
if (typeof window !== "undefined") {
  GlobalVue = (<any>window).Vue;
} else if (typeof global !== "undefined") {
  GlobalVue = (<any>global).Vue;
}
if (GlobalVue) {
  GlobalVue.use(plugin);
}
