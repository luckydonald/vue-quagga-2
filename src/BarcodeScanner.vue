<template>
  <div
    id="interactive"
    class="viewport scanner"
    :style="{
      minWidth: `${videoWidth || readerSize.width}px`,
      minHeight: `${videoHeight || readerSize.height}px`,
    }"
  >
    <!-- :style="{ minWidth: `${readerSize.width}px`, minHeight: `${readerSize.height}px` }" -->
    <video />
    <canvas class="drawingBuffer" />
  </div>
</template>

<script lang="ts">
import type {
  QuaggaJSConfigObject,
  QuaggaJSRectSize,
  QuaggaJSResultObject,
  QuaggaJSxy,
} from "@ericblade/quagga2";
import Quagga from "@ericblade/quagga2";
import QrCodeReader from "./qr_plugin";

import type { PropType } from "vue";
import {
  ref,
  watch,
  onMounted,
  onBeforeUnmount,
  computed,
  defineComponent,
} from "vue";
import type { CssColor } from "@/helper/cssColor";
import type { QRCode } from "jsqr";
import { isObjectWithKeys } from "@/helper/isObjectWithKeys";

const isError = function (exception: any): exception is Error {
  return (
    typeof exception == "object" &&
    exception !== null &&
    "name" in exception &&
    typeof exception.name === "string" &&
    "message" in exception &&
    typeof exception.message === "string"
  );
};

type AspectRatio = {
  min: number;
  max: number;
};
type ReaderSize = {
  width: number;
  height: number;
};

type WrongPosType = any[];
type WrongSizeType = QuaggaJSRectSize;
const wrongPosTypeGuard = (o: any): o is WrongPosType =>
  typeof o === "object" && typeof o.x === "number" && typeof o.y === "number";
const wrongSizeTypeGuard = (o: any): o is WrongSizeType =>
  typeof o === "object" && typeof o.x === "number" && typeof o.y === "number";
const convertWrongPosType = function (o: QuaggaJSxy): WrongPosType {
  if (!wrongPosTypeGuard(o)) {
    throw "Should be that type";
  }
  return o;
};
const convertWrongSizeType = function (o: QuaggaJSxy): WrongSizeType {
  if (!wrongSizeTypeGuard(o)) {
    throw "Should be that type";
  }
  return o;
};

type QrCodeResultObject = QRCode & {
  codeResult: {
    code: string;
    format: string;
  };
};

function isQuaggaJSResultObject(o: any): o is QuaggaJSResultObject {
  return isObjectWithKeys(o, [
    "codeResult",
    "line",
    "angle",
    "pattern",
    "box",
    "boxes",
  ]);
}
function isQrCodeResultObject(o: any): o is QrCodeResultObject {
  return isObjectWithKeys(o, [
    "codeResult",
    "binaryData",
    "data",
    "chunks",
    "version",
    "location",
  ]);
}

type CallbackFunctionPayload = QuaggaJSResultObject | QrCodeResultObject;
type CallbackFunctionWithPayload = (
  data: CallbackFunctionPayload
) => void | undefined;

export default defineComponent({
  name: "QuaggaScanner",
  emits: ["scan"],
  props: {
    onDetected: {
      type: Function as PropType<CallbackFunctionWithPayload>,
      default: undefined,
    },
    onProcessed: {
      type: Function as PropType<CallbackFunctionWithPayload>,
      default: undefined,
    },
    readerTypes: {
      type: Array as PropType<string[]>,
      default: () => ["code_128_reader", "qrcode"],
    },
    readerSize: {
      type: Object as PropType<ReaderSize>,
      default: () => ({
        width: 640,
        height: 480,
      }),
      validator: (o: any) =>
        typeof o === "object" &&
        typeof o.width === "number" &&
        typeof o.height === "number",
    },
    aspectRatio: {
      type: Object as PropType<AspectRatio>,
      default: () => ({
        min: 1,
        max: 2,
      }),
      validator: (o: any) =>
        typeof o === "object" &&
        typeof o.min === "number" &&
        typeof o.max === "number",
    },
    facingMode: {
      type: String as PropType<string>,
      default: () => "environment",
    },
    anticipationWrapColor: {
      type: String as PropType<CssColor>,
      default: () => "springgreen",
    },
    barcodeBoxColor: {
      type: String as PropType<CssColor>,
      default: () => "springgreen",
    },
    barcodeLineColor: {
      type: String as PropType<CssColor>,
      default: () => "springgreen",
    },
  },
  setup(props: any, { emit }) {
    const canvas = ref(null); // assigned in the html via `ref="canvas"`.
    const videoWidth = ref(0);
    const videoHeight = ref(0);

    const lastCode = ref<string | undefined>(undefined);

    const defaultOnFrame: CallbackFunctionWithPayload = (
      result: CallbackFunctionPayload
    ) => {
      let drawingCtx = Quagga.canvas.ctx.overlay;
      let drawingCanvas = Quagga.canvas.dom.overlay;
      videoWidth.value = Quagga.canvas.dom.overlay.width;
      videoHeight.value = Quagga.canvas.dom.overlay.height;

      if (result) {
        // so basically both method arguments are wrongly typed. Code expects an object {x: int, y: int} for both,
        // but asks for different stuff in the typing.
        if (isQuaggaJSResultObject(result)) {
          if (result.boxes) {
            drawingCtx.clearRect(
              0,
              0,
              parseInt(drawingCanvas.getAttribute("width") ?? "0"),
              parseInt(drawingCanvas.getAttribute("height") ?? "0")
            );
            result.boxes
              .filter(function (box) {
                return box !== result.box;
              })
              .forEach(function (box) {
                Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, {
                  color: props.barcodeBoxColor,
                  lineWidth: 2,
                });
              });
          }
          if (result.box) {
            Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, {
              color: props.barcodeLineColor,
              lineWidth: 2,
            });
          }
          if (result.line) {
            Quagga.ImageDebug.drawPath(
              result.line,
              { x: 0, y: 1 },
              drawingCtx,
              {
                color: props.barcodeLineColor,
                lineWidth: 2,
              }
            );
          }
        } else if (isQrCodeResultObject(result)) {
          if (result.location) {
            Quagga.ImageDebug.drawPath(
              [
                result.location.topLeftCorner,
                result.location.topRightCorner,
                result.location.bottomRightCorner,
                result.location.bottomLeftCorner,
              ],
              { x: "x", y: "y" },
              drawingCtx,
              { color: props.barcodeBoxColor, lineWidth: 2 }
            );
            Quagga.ImageDebug.drawPath(
              [
                result.location.topLeftFinderPattern,
                result.location.topRightFinderPattern,
                {
                  x: result.location.bottomLeftFinderPattern.x,
                  y: result.location.topRightFinderPattern.y,
                },
                result.location.bottomLeftFinderPattern,
              ],
              { x: "x", y: "y" },
              drawingCtx,
              { color: props.barcodeLineColor, lineWidth: 2 }
            );
          }
        }

        const size: QuaggaJSxy = {
          x: videoWidth.value - 4,
          y: videoHeight.value - 4,
        };
        Quagga.ImageDebug.drawRect(
          convertWrongPosType({ x: 2, y: 2 }),
          convertWrongSizeType(size),
          drawingCtx,
          {
            color: props.anticipationWrapColor,
            lineWidth: 2,
          }
        );
      } else if (drawingCtx) {
        drawingCtx.clearRect(0, 0, videoWidth.value, videoHeight.value);
      }
    };
    const defaultOnScan: CallbackFunctionWithPayload = (
      data: CallbackFunctionPayload
    ): void => {
      console.log(`scanned code ${data.codeResult.code}: `, data);
    };

    const onProcessed = computed((): CallbackFunctionWithPayload => {
      return props.onProcessed !== undefined
        ? props.onProcessed
        : defaultOnFrame;
    });
    const onDetected = computed((): CallbackFunctionWithPayload => {
      return props.onDetected !== undefined ? props.onDetected : defaultOnScan;
    });

    function onProcessedWhichFakesOnDetected(
      data: CallbackFunctionPayload
    ): void {
      onProcessed.value(data);

      if (data && data.codeResult && data.codeResult.code) {
        const code = data.codeResult.code;
        if (code && code !== lastCode.value) {
          lastCode.value = code;
          emit("scan", code);
        }
        onDetected.value(data);
      }
    }

    const quaggaState = computed((): QuaggaJSConfigObject => {
      return {
        inputStream: {
          type: "LiveStream",
          constraints: {
            width: { min: props.readerSize.width },
            height: { min: props.readerSize.height },
            facingMode: props.facingMode,
            aspectRatio: { min: 1, max: 2 },
          },
        },
        locator: {
          patchSize: "medium",
          halfSample: true,
        },
        numOfWorkers: 2,
        frequency: 10,
        decoder: {
          readers: props.readerTypes,
        },
        locate: true,
      };
    });

    watch(
      onDetected,
      (
        oldValue: CallbackFunctionWithPayload,
        newValue: CallbackFunctionWithPayload
      ) => {
        if (oldValue) Quagga.offDetected(oldValue);
        if (newValue) Quagga.onDetected(newValue);
      }
    );

    watch(
      onProcessed,
      (
        oldValue: CallbackFunctionWithPayload,
        newValue: CallbackFunctionWithPayload
      ) => {
        if (oldValue) Quagga.offProcessed(oldValue);
        if (newValue) Quagga.onProcessed(newValue);
      }
    );

    onMounted(() => {
      try {
        Quagga.registerReader("qrcode", QrCodeReader);
      } catch (e) {
        if (isError(e) && e.message === "cannot register existing reader") {
          console.log(`Reader ${"qrcode"} already registered`);
        } else {
          console.warn(`failed to register reader ${"qrcode"}`, e);
        }
      }
      Quagga.init(quaggaState.value, function (err) {
        if (err) {
          return console.error(err);
        }
        Quagga.start();
        console.log("STARTED Quagga");
      });
      Quagga.onProcessed(onProcessedWhichFakesOnDetected);
    });

    // this was `destroyed` before, so basically `onUnmount` not the `before` variant.
    onBeforeUnmount(() => {
      Quagga.offProcessed(onProcessedWhichFakesOnDetected);
      Quagga.stop();
      console.log("STOPPED Quagga");
    });

    return {
      quaggaState,
      canvas,
      videoWidth,
      videoHeight,
    };
  },
});
</script>

<style scoped>
.viewport {
  position: relative;
}

.viewport canvas,
.viewport video {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  right: 0;
}
</style>
