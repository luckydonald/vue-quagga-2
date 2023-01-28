// import 'webrtc-adapter';
import Scanner from "./BarcodeScanner.vue";

export default {
  install: function (Vue /*, options */) {
    Vue.component("v-quagga", Scanner);
  },
};
