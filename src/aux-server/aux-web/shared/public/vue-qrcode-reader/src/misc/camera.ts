// Kallyn Gowdy <kal@casualsimulation.com>
// Modified to not import the WebRTC shim

import { StreamApiNotSupportedError, InsecureContextError } from "./errors";
import { imageDataFromVideo } from "./image-data";
import { eventOn } from "callforth";

class Camera {
    videoEl: any;
    stream: any;
  constructor(videoEl: any, stream: any) {
    this.videoEl = videoEl;
    this.stream = stream;
  }

  stop() {
    this.stream.getTracks().forEach((track: any) => track.stop());
  }

  captureFrame() {
    return imageDataFromVideo(this.videoEl);
  }
}

const INSECURE_CONTEXT = window.isSecureContext !== true;

const STREAM_API_NOT_SUPPORTED = !(
  navigator &&
  (navigator.getUserMedia ||
    (navigator.mediaDevices && navigator.mediaDevices.getUserMedia))
);

export default async function(constraints: any, videoEl: any) {
  // At least in Chrome `navigator.mediaDevices` is undefined when the page is
  // loaded using HTTP rather than HTTPS. Thus `STREAM_API_NOT_SUPPORTED` is
  // initialized with `false` although the API might actually be supported.
  // So although `getUserMedia` already should have a build-in mechanism to
  // detect insecure context (by throwing `NotAllowedError`), we have to do a
  // manual check before even calling `getUserMedia`.
  if (INSECURE_CONTEXT) {
    throw new InsecureContextError();
  }

  if (STREAM_API_NOT_SUPPORTED) {
    throw new StreamApiNotSupportedError();
  }

  const stream = await navigator.mediaDevices.getUserMedia(constraints);

  if (videoEl.srcObject !== undefined) {
    videoEl.srcObject = stream;
  } else if (videoEl.mozSrcObject !== undefined) {
    videoEl.mozSrcObject = stream;
  } else if (window.URL.createObjectURL) {
    videoEl.src = window.URL.createObjectURL(stream);
  } else if ((<any>window).webkitURL) {
    videoEl.src = (<any>window).webkitURL.createObjectURL(stream);
  } else {
    videoEl.src = stream;
  }

  await eventOn(videoEl, "loadeddata");

  return new Camera(videoEl, stream);
}
