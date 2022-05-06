<template>
  <div id="interactive" class="viewport scanner">
    <video />
    <canvas class="drawingBuffer" />
  </div>
</template>

<script type="ts">
import Quagga from '@ericblade/quagga2';
import QrCodeReader from './qr_plugin';

import {
  ref,
  watch,
  onMounted,
  onBeforeUnmount,
  computed,
} from "vue";

export default {
  name: 'QuaggaScanner',
  props: {
    onDetected: {
      type: Function,
      default(result) {
        console.log('detected: ', result);
      },
    },
    onProcessed: {
      type: Function,
      default: undefined,
    },
    readerTypes: {
      type: Array,
      default: () => [
        'code_128_reader',
        'qrcode',
      ],
    },
    readerSize: {
      type: Object,
      default: () => ({
        width: 640,
        height: 480,
      }),
      validator: o =>
        typeof o.width === 'number' && typeof o.height === 'number',
    },
    aspectRatio: {
      type: Object,
      default: () => ({
        min: 1,
        max: 2,
      }),
      validator: o => typeof o.min === 'number' && typeof o.max === 'number',
    },
    facingMode: {
      type: String,
      default: () => 'environment'
    }
  },
  setup(props) {
    const defaultOnFrame = (result) => {
      let drawingCtx = Quagga.canvas.ctx.overlay;
      let drawingCanvas = Quagga.canvas.dom.overlay;

      if (result) {
        if (result.boxes) {
          drawingCtx.clearRect(
            0,
            0,
            parseInt(drawingCanvas.getAttribute('width')),
            parseInt(drawingCanvas.getAttribute('height'))
          );
          result.boxes
            .filter(function(box) {
              return box !== result.box;
            })
            .forEach(function(box) {
              Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, {
                color: 'green',
                lineWidth: 2,
              });
            });
        }
        if (result.box) {
          Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, {
            color: '#00F',
            lineWidth: 2,
          });
        }

        if (result.codeResult && result.codeResult.code) {
          Quagga.ImageDebug.drawPath(
            result.line,
            { x: 'x', y: 'y' },
            drawingCtx,
            { color: 'red', lineWidth: 3 }
          );
        }
      } else if (drawingCtx && drawingCtx.clearRect) {
        drawingCtx.clearRect(
            0,
            0,
            parseInt(drawingCanvas.getAttribute('width')),
            parseInt(drawingCanvas.getAttribute('height'))
        );
      }
    };
    const onProcessed = computed(() => {
      return props.onProcessed !== undefined ? props.onProcessed : defaultOnFrame;
    });
    const quaggaState = computed(() => {
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

    watch(props.onDetected, (oldValue, newValue) => {
      if (oldValue) Quagga.offDetected(oldValue);
      if (newValue) Quagga.onDetected(newValue);
    });

    watch(onProcessed, (oldValue, newValue) => {
      if (oldValue) Quagga.offProcessed(oldValue);
      if (newValue) Quagga.onProcessed(newValue);
    });

    onMounted(() => {
      Quagga.registerReader('qrcode', QrCodeReader);
      Quagga.init(quaggaState.value, function (err) {
        if (err) {
          return console.error(err);
        }
        Quagga.start();
        console.log('STARTED Quagga')
      });
      Quagga.onDetected(props.onDetected);
      Quagga.onProcessed(onProcessed.value);
    });

    // this was `destroyed` before, so basically `onUnmount` not the `before` variant.
    onBeforeUnmount(() => {
      if (props.onDetected) Quagga.offDetected(props.onDetected);
      if (onProcessed.value) Quagga.offProcessed(onProcessed.value);
      Quagga.stop();
      console.log('STOPPED Quagga');
    });

    return { quaggaState };
  },
};
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
}
</style>
