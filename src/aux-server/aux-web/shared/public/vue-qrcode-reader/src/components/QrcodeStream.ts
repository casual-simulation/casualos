import { keepScanning } from "../misc/scanner";
import { thinSquare } from "../misc/track-func";
import Camera from "../misc/camera";
import CommonAPI from "../mixins/CommonAPI";
import Worker from "../worker/jsqr?worker";

export default {
  name: "qrcode-stream",

  mixins: [CommonAPI],

  props: {
    camera: {
      type: String,
      default: "auto",

      validator(camera: any) {
        return ["auto", "rear", "front", "off"].indexOf(camera) >= 0;
      }
    },

    track: {
      type: [Function, Boolean],
      default: true
    },

    worker: {
      type: Function,
      default: Worker
    }
  },

  data() {
    return {
      cameraInstance: <any>null,
      destroyed: false,
      stopScanning: () => {}
    };
  },

  computed: {
    shouldStream() {
      return this.destroyed === false && this.camera !== "off";
    },

    shouldScan() {
      return this.shouldStream === true && this.cameraInstance !== null;
    },

    /**
     * Minimum delay in milliseconds between frames to be scanned. Don't scan
     * so often when visual tracking is disabled to improve performance.
     */
    scanInterval() {
      if (this.track === false) {
        return 500;
      } else {
        return 40; // ~ 25fps
      }
    },

    trackRepaintFunction() {
      if (this.track === true) {
        return thinSquare({ color: "#ff0000" });
      } else if (this.track === false) {
        return undefined;
      } else {
        return this.track;
      }
    },

    constraints() {
      const base: any = {
        audio: false,
        video: {
          width: { min: 360, ideal: 640, max: 1920 },
          height: { min: 240, ideal: 480, max: 1080 }
        }
      };

      switch (this.camera) {
        case "auto":
          base.video.facingMode = { ideal: "environment" };

          return base;
        case "rear":
          base.video.facingMode = { exact: "environment" };

          return base;
        case "front":
          base.video.facingMode = { exact: "user" };

          return base;
        case "off":
          return undefined;

        default:
          return undefined;
      }
    }
  },

  watch: {
    shouldStream(shouldStream: boolean) {
      if (!shouldStream) {
        const frame = this.cameraInstance.captureFrame();
        this.paintPauseFrame(frame);
      }
    },

    shouldScan(shouldScan: boolean) {
      if (shouldScan) {
        this.clearPauseFrame();
        this.clearTrackingLayer();
        this.startScanning();
      } else {
        this.stopScanning();
      }
    },

    constraints() {
      this.$emit("init", this.init());
    }
  },

  mounted() {
    this.$emit("init", this.init());
  },

  beforeDestroy() {
    this.beforeResetCamera();
    this.stopScanning();
    this.destroyed = true;
  },

  methods: {
    async init() {
      this.beforeResetCamera();

      if (this.constraints === undefined) {
        this.cameraInstance = null;
      } else {
        this.cameraInstance = await Camera(this.constraints, this.$refs.video);

        // if the component is destroyed before `cameraInstance` resolves a
        // `beforeDestroy` hook has no chance to clear the remaining camera
        // stream.
        if (this.destroyed) {
          this.cameraInstance.stop();
        }
      }
    },

    startScanning() {
      const detectHandler = (result: any) => {
        this.onDetect(Promise.resolve(result));
      };

      // this.stopScanning()
      this.stopScanning = keepScanning(this.worker, this.cameraInstance, {
        detectHandler,
        locateHandler: this.onLocate,
        minDelay: this.scanInterval
      });
    },

    beforeResetCamera() {
      if (this.cameraInstance !== null) {
        this.cameraInstance.stop();
        this.cameraInstance = null;
      }
    },

    onLocate(location: any) {
      if (this.trackRepaintFunction === undefined || location === null) {
        this.clearTrackingLayer();
      } else {
        this.repaintTrackingLayer(location);
      }
    },

    repaintTrackingLayer(location: any) {
      const video = this.$refs.video;
      const canvas = this.$refs.trackingLayer;
      const ctx = canvas.getContext("2d");

      // The visually occupied area of the video element.
      // Because the component is responsive and fills the available space,
      // this can be more or less than the actual resolution of the camera.
      const displayWidth = video.offsetWidth;
      const displayHeight = video.offsetHeight;

      // The actual resolution of the camera.
      // These values are fixed no matter the screen size.
      const resolutionWidth = video.videoWidth;
      const resolutionHeight = video.videoHeight;

      // Dimensions of the video element as if there would be no
      //   object-fit: cover;
      // Thus, the ratio is the same as the cameras resolution but it's
      // scaled down to the size of the visually occupied area.
      const largerRatio = Math.max(
        displayWidth / resolutionWidth,
        displayHeight / resolutionHeight
      );
      const uncutWidth = resolutionWidth * largerRatio;
      const uncutHeight = resolutionHeight * largerRatio;

      const xScalar = uncutWidth / resolutionWidth;
      const yScalar = uncutHeight / resolutionHeight;
      const xOffset = (displayWidth - uncutWidth) / 2;
      const yOffset = (displayHeight - uncutHeight) / 2;

      const coordinatesAdjusted: any = {};
      for (const key in location) {
        coordinatesAdjusted[key] = {
          x: Math.floor(location[key].x * xScalar + xOffset),
          y: Math.floor(location[key].y * yScalar + yOffset)
        };
      }

      window.requestAnimationFrame(() => {
        canvas.width = displayWidth;
        canvas.height = displayHeight;

        this.trackRepaintFunction(coordinatesAdjusted, ctx);
      });
    },

    clearTrackingLayer() {
      const canvas = this.$refs.trackingLayer;
      const ctx = canvas.getContext("2d");

      window.requestAnimationFrame(() => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    },

    paintPauseFrame(imageData: any) {
      const canvas = this.$refs.pauseFrame;
      const ctx = canvas.getContext("2d");

      window.requestAnimationFrame(() => {
        canvas.width = imageData.width;
        canvas.height = imageData.height;

        ctx.putImageData(imageData, 0, 0);
      });
    },

    clearPauseFrame() {
      const canvas = this.$refs.pauseFrame;
      const ctx = canvas.getContext("2d");

      window.requestAnimationFrame(() => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    }
  }
};