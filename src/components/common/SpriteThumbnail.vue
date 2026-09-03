<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import type { Item } from '@/types/Item'

const props = defineProps<{
  item: Item
}>()

const emit = defineEmits<{
  invalid: [item: Item]
}>()

const canvas = ref<HTMLCanvasElement>()

function drawThumbnail() {
  const target = canvas.value
  if (!target) return

  const image = new Image()
  image.onload = () => {
    const context = target.getContext('2d')
    if (!context) return

    const frameSize = 64
    const sourceY = image.height >= frameSize * 3 ? frameSize * 2 : 0
    target.width = frameSize
    target.height = frameSize
    context.imageSmoothingEnabled = false
    context.clearRect(0, 0, frameSize, frameSize)
    context.drawImage(image, 0, sourceY, frameSize, frameSize, 0, 0, frameSize, frameSize)
  }
  image.onerror = () => emit('invalid', props.item)
  image.src = props.item.preview.replace('/./', '/')
}

onMounted(drawThumbnail)
watch(() => props.item.preview, async () => {
  await nextTick()
  drawThumbnail()
})
</script>

<template>
  <canvas ref="canvas" class="sprite-thumbnail" :aria-label="item.name"></canvas>
</template>

<style scoped>
.sprite-thumbnail {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 9px;
  background: #f9e9e1;
  image-rendering: pixelated;
}
</style>
