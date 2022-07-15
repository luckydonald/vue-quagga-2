<template>
  <div id="interactive" class="viewport scanner" :style="{ minWidth: `${videoWidth || readerSize.width }px`, minHeight: `${videoHeight || readerSize.height }px` }">
    <!-- :style="{ minWidth: `${readerSize.width}px`, minHeight: `${readerSize.height}px` }" -->
    <video/>
    <canvas class="drawingBuffer" />
  </div>
</template>

<script lang="ts">
import Quagga, {
  QuaggaJSConfigObject,
  QuaggaJSRectSize,
  QuaggaJSResultCallbackFunction,
  QuaggaJSResultObject,
  QuaggaJSxy,
} from '@ericblade/quagga2';
import QrCodeReader from './qr_plugin';

import {
  ref,
  watch,
  onMounted,
  onBeforeUnmount,
  computed,
  PropType,
  defineComponent,
} from "vue";
import {CssColor} from "@/helper/cssColor";
import {QRCode} from "jsqr";
import {isObjectWithKeys} from "@/helper/isObjectWithKeys";

const isError = function(exception: any): exception is Error {
    return (
      typeof exception == 'object'
      && exception !== null
      && 'name' in exception && typeof exception.name === 'string'
      && 'message' in exception && typeof exception.message === 'string'
    );
}

type CallbackFunctionValues = QuaggaJSResultCallbackFunction | undefined;
type AspectRatio = {
  min: number,
  max: number,
};
type ReaderSize = {
  width: number,
  height: number,
};

type WrongPosType = any[];
type WrongSizeType = QuaggaJSRectSize;
const wrongPosTypeGuard = (o: any): o is WrongPosType => typeof o === "object" && typeof o.x === "number" && typeof o.y === "number";
const wrongSizeTypeGuard = (o: any): o is WrongSizeType => typeof o === "object" && typeof o.x === "number" && typeof o.y === "number";
const convertWrongPosType = function (o: QuaggaJSxy): WrongPosType {
  if (!wrongPosTypeGuard(o)) {
    throw "Should be that type";
  }
  return o;
}
const convertWrongSizeType = function (o: QuaggaJSxy): WrongSizeType {
  if (!wrongSizeTypeGuard(o)) {
    throw "Should be that type";
  }
  return o;
}

type QrCodeResultObject = QRCode & {
  codeResult: {
    code: string,
    format: string,
  }
};

function isQuaggaJSResultObject(o: any): o is QuaggaJSResultObject {
  return isObjectWithKeys(o, ["codeResult", "line", "angle", "pattern", "box", "boxes"]);
}
function isQrCodeResultObject(o: any): o is QrCodeResultObject {
  return isObjectWithKeys(o, ["codeResult", "binaryData", "data", "chunks", "version", "location"]);

}

export default defineComponent({
  name: 'QuaggaScanner',
  props: {
    onDetected: {
      type: Function as PropType<QuaggaJSResultCallbackFunction>,
      default(data: QuaggaJSResultObject) {
        console.log('detected: ', data);
      },
    },
    onProcessed: {
      type: Function as PropType<CallbackFunctionValues>,
      default: undefined,
    },
    readerTypes: {
      type: Array as PropType<string[]>,
      default: () => [
        'code_128_reader',
        'qrcode',
      ],
    },
    readerSize: {
      type: Object as PropType<ReaderSize>,
      default: () => ({
        width: 640,
        height: 480,
      }),
      validator: (o: any) => typeof o === 'object' && typeof o.width === 'number' && typeof o.height === 'number',
    },
    aspectRatio: {
      type: Object as PropType<AspectRatio>,
      default: () => ({
        min: 1,
        max: 2,
      }),
      validator: (o: any) => typeof o === 'object' && typeof o.min === 'number' && typeof o.max === 'number',
    },
    facingMode: {
      type: String as PropType<string>,
      default: () => 'environment'
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
  setup(props: any) {
    const canvas = ref(null);  // assigned in the html via `ref="canvas"`.
    const videoWidth = ref(0);
    const videoHeight = ref(0);

    const defaultOnFrame: QuaggaJSResultCallbackFunction = (result: QuaggaJSResultObject | QrCodeResultObject) => {
      let drawingCtx = Quagga.canvas.ctx.overlay;
      let drawingCanvas = Quagga.canvas.dom.overlay;
      videoWidth.value = Quagga.canvas.dom.overlay.width;
      videoHeight.value = Quagga.canvas.dom.overlay.height;

      if (result) {
        console.log(result);
        if (result.boxes) {
          drawingCtx.clearRect(
            0,
            0,
            parseInt(drawingCanvas.getAttribute('width') ?? '0'),
            parseInt(drawingCanvas.getAttribute('height') ?? '0')
          );
          result.boxes
            .filter(function(box) {
              return box !== result.box;
            })
            .forEach(function(box) {
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
          Quagga.ImageDebug.drawPath(result.line, { x: 0, y: 1 }, drawingCtx, {
            color: props.barcodeLineColor,
            lineWidth: 2,
          });
        }

        if (result.codeResult && result.codeResult.code) {
          Quagga.ImageDebug.drawPath(
          [],
          { x: 'x', y: 'y' },
          drawingCtx,
          { color: props.barcodeBoxColor, lineWidth: 3 }
        );
        }

        const size: QuaggaJSxy = {x: videoWidth.value - 4, y: videoHeight.value - 4};
        Quagga.ImageDebug.drawRect(convertWrongPosType({ x: 2, y: 2 }), convertWrongSizeType(size), drawingCtx, {
          color: props.anticipationWrapColor,
          lineWidth: 2,
        });
      } else if (drawingCtx) {
        drawingCtx.clearRect(
            0,
            0,
            videoWidth.value,
            videoHeight.value,
        );
      }
    };
    const onProcessed = computed((): QuaggaJSResultCallbackFunction => {
      return props.onProcessed !== undefined ? props.onProcessed : defaultOnFrame;
    });
    const quaggaState = computed((): QuaggaJSConfigObject => {
        return {
          inputStream: {
            type: 'LiveStream',
            constraints: {
              width: {min: props.readerSize.width},
              height: {min: props.readerSize.height},
              facingMode: props.facingMode,
              aspectRatio: {min: 1, max: 2},
            },
          },
          locator: {
            patchSize: 'medium',
            halfSample: true,
          },
          numOfWorkers: 2,
          frequency: 10,
          decoder: {
            readers: props.readerTypes,
          },
          locate: true,
        }
      }
    );

    watch(props.onDetected, (oldValue: CallbackFunctionValues, newValue: CallbackFunctionValues) => {
      if (oldValue) Quagga.offDetected(oldValue);
      if (newValue) Quagga.onDetected(newValue);
    });

    watch(onProcessed, (oldValue: CallbackFunctionValues, newValue: CallbackFunctionValues) => {
      if (oldValue) Quagga.offProcessed(oldValue);
      if (newValue) Quagga.onProcessed(newValue);
    });

    onMounted(() => {
      try {
        Quagga.registerReader('qrcode', QrCodeReader);
      } catch (e) {
        if (isError(e) && e.message === 'cannot register existing reader') {
          console.log(`Reader ${'qrcode'} already registered`)
        } else {
          console.warn(`failed to register reader ${'qrcode'}`, e);
        }
      }
      Quagga.init(quaggaState.value, function (err) {
        if (err) {
          return console.error(err);
        }
        Quagga.start();
        console.log('STARTED Quagga')
      });
      if (props.onDetected) {
        Quagga.onDetected(props.onDetected);
      }
      Quagga.onProcessed(onProcessed.value);
    });

    // this was `destroyed` before, so basically `onUnmount` not the `before` variant.
    onBeforeUnmount(() => {
      if (props.onDetected) Quagga.offDetected(props.onDetected);
      if (onProcessed.value) Quagga.offProcessed(onProcessed.value);
      Quagga.stop();
      console.log('STOPPED Quagga');
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
