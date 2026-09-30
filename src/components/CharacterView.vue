<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, type Ref } from 'vue'
import SpriteCanvas from '@/components/character/SpriteCanvas.vue'
import SpriteThumbnail from '@/components/common/SpriteThumbnail.vue'
import { CharacterRenderer } from '@/services/CharacterRenderer'
import { CharacterCollection } from '@/types/CharacterCollection'
import { ColorCollection } from '@/types/ColorCollection'
import type { Item } from '@/types/Item'
import rawData from '@/data/packed.json'
import rawColors from '@/data/colors.json'

interface CategoryTab {
  label: string
  icon: string
  type: string
  types?: string[]
}

const colors = new ColorCollection()
colors.initColors(rawColors)

const collection = new CharacterCollection(colors)
collection.initItems(rawData)

const renderer = new CharacterRenderer(collection)
const allowedBodyIds = new Set([
  'anatomy.body.teen',
  'anatomy.body.zombie',
  'anatomy.body.skeleton',
  'anatomy.shadow.shadow',
])
const defaultConfig = {
  'anatomy.body.teen': { colors: { primary: 'ivory' } },
  'clothes.torso.scoop_shirt': { colors: { primary: 'white' } },
  'clothes.legs.pants': { colors: { primary: 'blue' } },
  'clothes.feet.shoes': { colors: { primary: 'black' } },
}
const refresh = ref(0)
const selectedType = ref('anatomy.body')
const selectedGroup = ref('_')
const selectedItemId = ref('')
const activeItem: Ref<Item | undefined> = ref()
const activeMaterial = ref('')
const currentPose = ref('walk')
const spriteCanvas = ref()
const portraitCanvas = ref<HTMLCanvasElement>()
const invalidItemIds = ref(new Set<string>())
const savedFeedback = ref(false)
const excludedItemNames = new Set([
  'longsleeve_laced',
  'shirt',
  'sleeveless_laced',
  'sleeveless_stripped',
])

selectedGroup.value = Object.keys(collection.getFilteredOptions(selectedType.value))[0] ?? '_'

const tabs: CategoryTab[] = [
  { label: 'Body', icon: 'human', type: 'anatomy.body', types: ['anatomy.body', 'anatomy.shadow'] },
  {
    label: 'Head',
    icon: 'face-man',
    type: 'anatomy.head',
    types: [
      'anatomy.head', 'anatomy.beards', 'anatomy.ears', 'anatomy.fins',
      'anatomy.horns', 'anatomy.nose', 'anatomy.tail', 'anatomy.wings',
      'anatomy.wrinkles', 'anatomy.wound', 'clothes.eyes', 'clothes.ears',
      'injuries.arm', 'injuries.body', 'injuries.brain', 'injuries.eye',
      'injuries.hand', 'injuries.leg', 'injuries.mouth', 'injuries.ribs',
    ],
  },
  { label: 'Hair', icon: 'hair-dryer', type: 'anatomy.hair' },
  {
    label: 'Headwear',
    icon: 'hat-fedora',
    type: 'clothes.hat',
    types: ['clothes.hat', 'clothes.head_coverings', 'clothes.helmet_accessory', 'clothes.helmet_visor'],
  },
  { label: 'Arms', icon: 'arm-flex', type: 'clothes.arms', types: ['clothes.arms', 'clothes.hands', 'clothes.wrists'] },
  {
    label: 'Torso',
    icon: 'tshirt-crew',
    type: 'clothes.torso',
    types: [
      'clothes.torso', 'clothes.torso2', 'clothes.torso3', 'clothes.buckles',
      'clothes.cape', 'clothes.closure', 'clothes.collar', 'clothes.dress',
      'clothes.neck', 'clothes.pockets', 'clothes.shoulders', 'clothes.trim',
      'clothes.waist',
    ],
  },
  { label: 'Legs', icon: 'human-male', type: 'clothes.legs', types: ['clothes.legs', 'clothes.skirts'] },
  { label: 'Feet', icon: 'shoe-sneaker', type: 'clothes.feet' },
  {
    label: 'Tools',
    icon: 'hammer-wrench',
    type: 'equipment.tools',
    types: ['equipment.tools', 'equipment.bow_accessory', 'equipment.staff_accessory'],
  },
  {
    label: 'Weapons',
    icon: 'sword',
    type: 'equipment.swords',
    types: ['equipment.swords', 'equipment.bows', 'equipment.misc', 'equipment.shields', 'equipment.spears', 'equipment.staffs'],
  },
]

const selectedTab = computed(() => tabs.find((tab) => tab.type === selectedType.value) ?? tabs[0])
const options = computed(() => {
  const grouped: { [key: string]: Item[] } = {}
  const tab = selectedTab.value
  const itemTypes = tab.types ?? [selectedType.value]

  for (const itemType of itemTypes) {
    const items = collection.getItems(itemType) as { [key: string]: Item } | undefined
    for (const item of Object.values(items ?? {})) {
      if (
        !isRenderableItem(item) ||
        invalidItemIds.value.has(item.id) ||
        (selectedType.value === 'anatomy.body' && !allowedBodyIds.has(item.id)) ||
        (selectedType.value === 'anatomy.head' && item.id.endsWith('_child')) ||
        excludedItemNames.has(item.id.split('.').at(-1) ?? '')
      ) continue
      const group = item.group || '_'
      grouped[group] = grouped[group] ?? []
      grouped[group].push(item)
    }
  }

  return grouped
})
const subcategories = computed(() => Object.keys(options.value))
const previewItems = computed(() => (options.value[selectedGroup.value] ?? []) as Item[])
const palette = computed(() => {
  if (!activeItem.value || !activeMaterial.value) return []
  const material = activeItem.value.materials[activeMaterial.value]
  return Object.values(collection.colors.getAll()).filter((color) =>
    material?.palettes.some((paletteName) => color.materials.includes(paletteName)),
  )
})
const equippedItems = computed(() => {
  refresh.value
  return Object.values(collection.selected)
    .flatMap((categories) => Object.values(categories))
    .filter((item): item is Item => Boolean(item))
})

function isRenderableItem(item: Item): boolean {
  if (!item.id || !item.path || !item.preview || !item.animations?.length) return false
  if (!Object.keys(item.layers).length) return false

  return Object.values(item.layers).every((layer) => {
    if (!layer || typeof layer.z !== 'number') return false
    if (!layer.conditions) return true
    return layer.conditions.every((condition) => condition.path !== null && condition.path !== undefined)
  })
}

function markInvalid(item: Item) {
  invalidItemIds.value = new Set(invalidItemIds.value).add(item.id)
}

function isItemIncompatible(item: Item): boolean {
  // `refresh` is tracked so this recomputes whenever body/anatomy selections change.
  refresh.value
  return !item.isAllowed()
}

function getItemCategory(item: Item): string {
  const itemType = item.id.split('.').slice(0, 2).join('.')
  return tabs.find((tab) => tab.type === itemType || tab.types?.includes(itemType))?.label ?? 'Accessory'
}

function getItemName(item: Item): string {
  return item.id === 'anatomy.body.teen' ? 'Body' : item.name
}

async function editEquippedItem(item: Item) {
  const itemType = item.id.split('.').slice(0, 2).join('.')
  const tab = tabs.find((candidate) => candidate.type === itemType || candidate.types?.includes(itemType))
  if (!tab) return

  selectedType.value = tab.type
  selectedGroup.value = item.group || '_'
  selectedItemId.value = item.id
  activeItem.value = item
  activeMaterial.value = Object.keys(item.materials)[0] ?? ''
  await selectItem(item)
  document.querySelector('.selection-content')?.scrollTo({ top: 0, behavior: 'smooth' })
}

function removeItem(item: Item) {
  collection.unselect(item)
  if (activeItem.value?.id === item.id) {
    activeItem.value = undefined
    activeMaterial.value = ''
    selectedItemId.value = ''
  }
  renderer.draw()
  drawPortrait()
  refresh.value++
}

function chooseTab(type: string) {
  selectedType.value = type
  const tab = selectedTab.value
  const itemTypes = tab.types ?? [type]
  const equippedInTab = itemTypes
    .map((itemType) => collection.getSelected(itemType))
    .find((item): item is Item => Boolean(item))

  if (equippedInTab) {
    selectedGroup.value = equippedInTab.group || '_'
    selectedItemId.value = equippedInTab.id
    activeItem.value = equippedInTab
    activeMaterial.value = Object.keys(equippedInTab.materials)[0] ?? ''
  } else {
    const groups = options.value
    selectedGroup.value = Object.keys(groups)[0] ?? '_'
    selectedItemId.value = ''
    activeItem.value = undefined
    activeMaterial.value = ''
  }
  renderer.draw()
  drawPortrait()
}

async function selectItem(item: Item | undefined) {
  selectedItemId.value = item?.id ?? ''
  if (!item) {
    if (activeItem.value) collection.unselect(activeItem.value)
    activeItem.value = undefined
    activeMaterial.value = ''
    renderer.draw()
    drawPortrait()
    return
  }

  await ensureBaseBody(item)
  activeItem.value = await collection.select(item)
  activeMaterial.value = Object.keys(item.materials)[0] ?? ''
  renderer.draw()
  drawPortrait()
  refresh.value++
}

async function ensureBaseBody(item: Item) {
  if (item.id.startsWith('anatomy.body.') || collection.isBodySelected()) return

  const bodyItems = collection.getItems('anatomy.body') as { [key: string]: Item } | undefined
  const defaultBody = Object.values(bodyItems ?? {}).find((body) => isRenderableItem(body))
  if (defaultBody) await collection.select(defaultBody)
}

async function applyColor(colorId: string) {
  if (!activeItem.value || !activeMaterial.value) return
  activeItem.value.colors.set(activeMaterial.value, colorId)
  await collection.select(activeItem.value)
  renderer.draw()
  drawPortrait()
  refresh.value++
}

function drawPortrait() {
  const sourceCanvas = renderer.getAnimationCanvas('walk').value as HTMLCanvasElement | undefined
  const targetCanvas = portraitCanvas.value
  if (!sourceCanvas || !targetCanvas) return

  const context = targetCanvas.getContext('2d')
  if (!context) return

  const scale = 4
  const frameSize = 64
  targetCanvas.width = frameSize * scale
  targetCanvas.height = frameSize * scale
  context.imageSmoothingEnabled = false
  context.clearRect(0, 0, targetCanvas.width, targetCanvas.height)
  context.drawImage(
    sourceCanvas,
    0,
    frameSize * 2,
    frameSize,
    frameSize,
    0,
    0,
    frameSize * scale,
    frameSize * scale,
  )
}

function colorStyle(paletteValue: number[][]) {
  const swatch = paletteValue[Math.min(2, paletteValue.length - 1)] ?? [220, 220, 220]
  return { backgroundColor: `rgb(${swatch[0]}, ${swatch[1]}, ${swatch[2]})` }
}

function saveCharacter() {
  try {
    const previewCanvas = portraitCanvas.value
    const spritesheetCanvas = renderer.getAnimationCanvas('walk').value as HTMLCanvasElement | undefined
    if (!previewCanvas || !spritesheetCanvas) {
      throw new Error('Character canvases are not ready')
    }

    const previewImage = previewCanvas.toDataURL('image/png')
    const spritesheetImage = spritesheetCanvas.toDataURL('image/png')
    const config = JSON.parse(JSON.stringify(collection.dumpSelected()))

    window.parent.postMessage(
      {
        type: 'SAVE_LPC_CHARACTER',
        payload: {
          previewImage,
          spritesheetImage,
          config,
        },
      },
      '*',
    )

    savedFeedback.value = true
    window.setTimeout(() => {
      savedFeedback.value = false
    }, 1600)
  } catch (error) {
    console.error('Failed to save LPC character', error)
    savedFeedback.value = false
  }
}

function getSavedConfig(payload: unknown): Record<string, { colors: Record<string, string> }> | null {
  if (!payload || typeof payload !== 'object') return null
  const value = payload as Record<string, unknown>
  if (value.config && typeof value.config === 'object') {
    return value.config as Record<string, { colors: Record<string, string> }>
  }

  if (!value.layers || typeof value.layers !== 'object') return null
  const colorsByLayer = value.colors && typeof value.colors === 'object'
    ? value.colors as Record<string, Record<string, string>>
    : {}
  const layers = Array.isArray(value.layers)
    ? value.layers.reduce<Record<string, { colors: Record<string, string> }>>((config, id) => {
      if (typeof id === 'string') config[id] = { colors: colorsByLayer[id] ?? {} }
      return config
    }, {})
    : value.layers as Record<string, { colors?: Record<string, string> }>

  return Object.entries(layers).reduce<Record<string, { colors: Record<string, string> }>>((config, [id, layer]) => {
    if (typeof id === 'string' && layer && typeof layer === 'object') {
      config[id] = { colors: layer.colors ?? colorsByLayer[id] ?? {} }
    }
    return config
  }, {})
}

async function loadCharacterMessage(event: MessageEvent) {
  if (event.data?.type !== 'LOAD_LPC_CHARACTER') return
  const config = getSavedConfig(event.data.payload)
  if (!config) {
    console.warn('Ignoring LOAD_LPC_CHARACTER message without a valid configuration')
    return
  }

  await collection.initSelected(config)
  activeItem.value = undefined
  activeMaterial.value = ''
  selectedItemId.value = ''
  renderer.draw()
  drawPortrait()
  refresh.value++
}

onMounted(async () => {
  window.addEventListener('message', loadCharacterMessage)
  await collection.initSelected(defaultConfig)
  renderer.draw()
  drawPortrait()
  refresh.value++
})

onUnmounted(() => {
  window.removeEventListener('message', loadCharacterMessage)
})
</script>

<template>
  <section class="character-editor">
    <aside class="selection-card">
      <nav class="category-tabs" aria-label="Character categories">
        <button
          v-for="tab in tabs"
          :key="tab.type"
          class="category-tab"
          :class="{ active: selectedType === tab.type }"
          :title="tab.label"
          @click="chooseTab(tab.type)"
        >
          <i :class="`mdi mdi-${tab.icon}`"></i>
          <span>{{ tab.label }}</span>
        </button>
      </nav>

      <div class="selection-content">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Choose an item</p>
            <h2>{{ selectedTab.label }}</h2>
          </div>
          <select v-model="selectedGroup" aria-label="Choose a subcategory" @change="selectItem(undefined)">
            <option v-for="subcategory in subcategories" :key="subcategory" :value="subcategory">
              {{ subcategory === '_' ? 'All styles' : subcategory }}
            </option>
          </select>
        </div>

        <div class="preview-grid">
          <button
            v-for="item in previewItems"
            :key="item.id"
            class="preview-button"
            :class="{ selected: selectedItemId === item.id, incompatible: isItemIncompatible(item) }"
            :title="isItemIncompatible(item) ? `${getItemName(item)} — not visible on the current body type` : getItemName(item)"
            @click="selectItem(item)"
          >
            <SpriteThumbnail :item="item" @invalid="markInvalid" />
            <i v-if="isItemIncompatible(item)" class="mdi mdi-alert-circle incompatible-badge"></i>
            <span>{{ getItemName(item) }}</span>
          </button>
        </div>
      </div>
    </aside>

    <main class="preview-card">
      <div class="preview-title">
        <div>
          <p class="eyebrow">Your character</p>
          <h2>Live preview</h2>
        </div>
        <span class="pose-pill"><i class="mdi mdi-walk"></i> {{ currentPose }}</span>
      </div>

      <div class="canvas-stage">
        <SpriteCanvas ref="spriteCanvas" :current="currentPose" :renderer="renderer" class="hidden" />
        <canvas ref="portraitCanvas" class="portrait-canvas" aria-label="Front-facing character preview"></canvas>
      </div>

      <div class="palette-panel">
        <div class="palette-heading">
          <span>Color palette</span>
          <div v-if="activeItem" class="material-list">
            <button
              v-for="(material, materialName) in activeItem.materials"
              :key="materialName"
              :class="{ active: activeMaterial === materialName }"
              @click="activeMaterial = String(materialName)"
            >
              {{ material.name }}
            </button>
          </div>
        </div>
        <div class="color-palette-container">
          <div class="swatches">
          <button
            v-for="color in palette"
            :key="color.id"
            class="swatch"
            :title="color.name"
            :style="colorStyle(color.palette)"
            @click="applyColor(color.id)"
          ></button>
          <span v-if="!palette.length" class="palette-hint">Choose an item to see its colors.</span>
          </div>
        </div>
      </div>
    </main>

    <aside class="controls-card">
      <div>
        <p class="eyebrow">Your character</p>
        <h2>Active layers</h2>
      </div>
      <div v-if="equippedItems.length" class="equipped-list">
        <div
          v-for="item in equippedItems"
          :key="item.id"
          class="equipped-item"
          :class="{ incompatible: isItemIncompatible(item) }"
          role="button"
          tabindex="0"
          @click="editEquippedItem(item)"
          @keydown.enter="editEquippedItem(item)"
          @keydown.space.prevent="editEquippedItem(item)"
        >
          <SpriteThumbnail :item="item" />
          <div class="equipped-details">
            <span class="equipped-category">{{ getItemCategory(item) }}</span>
            <strong :title="item.name">{{ item.name }}</strong>
            <span v-if="isItemIncompatible(item)" class="equipped-warning" title="This item has no artwork for your current body type, so it won't be visible.">
              <i class="mdi mdi-alert-circle"></i> Not visible on this body
            </span>
          </div>
          <button class="remove-button" :aria-label="`Remove ${item.name}`" :title="`Remove ${item.name}`" @click.stop="removeItem(item)">
            <i class="mdi mdi-close"></i>
          </button>
        </div>
      </div>
      <p v-else class="empty-layers"><i class="mdi mdi-tshirt-crew-outline"></i> No items equipped yet.</p>
      <button class="save-button" @click="saveCharacter">
        <i :class="savedFeedback ? 'mdi mdi-check' : 'mdi mdi-content-save'"></i>
        {{ savedFeedback ? 'Saved!' : 'Save Character' }}
      </button>
    </aside>
  </section>
</template>

<style scoped>
.character-editor {
  display: grid;
  grid-template-columns: minmax(360px, 1.15fr) minmax(360px, 1fr) minmax(220px, 0.6fr);
  gap: 18px;
  flex: 1;
  min-height: 0;
  padding: 22px;
  overflow: hidden;
  background: #fff8f1;
  color: #4b3c4e;
}

.selection-card,
.preview-card,
.controls-card {
  min-height: 0;
  overflow: hidden;
  border: 4px solid #f0d9d3;
  border-radius: 26px;
  background: #fff;
  box-shadow: 0 8px 0 #ead2d2;
}

.selection-card {
  display: grid;
  grid-template-columns: 96px 1fr;
}

.category-tabs {
  min-height: 0;
  margin-left: 1px;
  overflow-y: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 8px;
  background: #f8e6e1;
  scrollbar-width: thin;
  scrollbar-color: #c9afd0 transparent;
}

.category-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 3px;
  border-radius: 13px;
  color: #927a8d;
  font-size: 0.66rem;
  font-weight: 700;
  transition: 0.2s ease;
}

.category-tab i { font-size: 1.35rem; }
.category-tab:hover,
.category-tab.active { background: #fff; color: #7f6ab2; box-shadow: 0 3px 0 #e6c9d0; }

.selection-content,
.preview-card,
.controls-card { padding: 20px; }
.selection-content {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #c9afd0 transparent;
}
.panel-heading,
.preview-title,
.palette-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.eyebrow { margin: 0 0 3px; color: #c28a9d; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
h2 { margin: 0; color: #5a4660; font-size: 1.35rem; }
select { max-width: 48%; padding: 9px 28px 9px 10px; border: 2px solid #efd6d5; border-radius: 12px; background: #fff8f1; color: #66536a; font-weight: 700; }
.preview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(82px, 1fr)); gap: 10px; margin-top: 20px; }
.preview-button { display: flex; position: relative; min-width: 0; flex-direction: column; align-items: center; gap: 5px; padding: 7px; border: 3px solid #f2e4df; border-radius: 15px; background: #fffaf7; color: #715d72; font-size: 0.72rem; font-weight: 700; }
.preview-button:hover, .preview-button.selected { border-color: #b9a5d8; background: #f1ecfb; }
.preview-button.incompatible { border-color: #f0d5a8; background: #fff6e8; opacity: 0.75; }
.preview-button.incompatible.selected { border-color: #e0a94c; background: #fdecc8; }
.preview-button img { width: 100%; aspect-ratio: 1; object-fit: contain; image-rendering: pixelated; border-radius: 9px; background: #f9e9e1; }
.preview-button span { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.incompatible-badge { position: absolute; top: 4px; right: 4px; color: #d68a1c; font-size: 1rem; text-shadow: 0 0 3px #fff; }
.preview-card { display: flex; flex-direction: column; background: #fffdfc; }
.pose-pill { padding: 7px 11px; border-radius: 12px; background: #e8f3ef; color: #5b927f; font-size: 0.75rem; font-weight: 800; }
.canvas-stage { display: flex; flex: 1; min-height: 220px; align-items: center; justify-content: center; margin: 18px 0; border: 3px dashed #efd6d5; border-radius: 20px; background-color: #fff4ec; background-image: radial-gradient(#f0d9d3 1px, transparent 1px); background-size: 14px 14px; overflow: auto; }
.portrait-canvas { width: 256px; height: 256px; image-rendering: pixelated; }
.palette-panel { padding: 14px; border-radius: 18px; background: #f8e9e4; }
.palette-heading { color: #715d72; font-size: 0.85rem; font-weight: 800; }
.material-list { display: flex; gap: 4px; }
.material-list button { padding: 4px 7px; border-radius: 8px; color: #9b7d91; font-size: 0.68rem; }
.material-list button.active { background: #fff; color: #7f6ab2; }
.color-palette-container { max-height: 200px; overflow-x: hidden; overflow-y: auto; padding: 8px 4px 8px 2px; scrollbar-width: thin; scrollbar-color: rgba(127, 106, 178, .45) transparent; }
.color-palette-container::-webkit-scrollbar { width: 6px; }
.color-palette-container::-webkit-scrollbar-thumb { background-color: rgba(127, 106, 178, .45); border-radius: 4px; }
.color-palette-container::-webkit-scrollbar-track { background: transparent; }
.swatches { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; padding: 3px; }
.swatch { width: 28px; height: 28px; flex: 0 0 28px; border: 3px solid #fff; border-radius: 50%; box-shadow: 0 2px 4px #d5bfc0; }
.swatch:hover { transform: scale(1.12); }
.palette-hint { color: #aa8f9c; font-size: 0.75rem; }
.controls-card { display: flex; flex-direction: column; background: #f0f4ff; border-color: #d2d9ef; box-shadow: 0 8px 0 #cbd3eb; }
.helper-text { margin-top: 14px; color: #847995; font-size: 0.9rem; line-height: 1.5; }
.equipped-list { display: grid; gap: 9px; min-height: 0; margin-top: 18px; overflow-y: auto; padding-right: 4px; scrollbar-width: thin; scrollbar-color: #b9c5e2 transparent; }
.equipped-item { display: flex; align-items: center; gap: 9px; min-width: 0; padding: 7px; border: 2px solid #dce2f2; border-radius: 14px; background: #fff; cursor: pointer; transition: .15s ease; }
.equipped-item:hover, .equipped-item:focus-visible { border-color: #b9a5d8; box-shadow: 0 3px 0 #d8cdeb; outline: none; transform: translateY(-1px); }
.equipped-item.incompatible { border-color: #f0d5a8; background: #fffaf0; }
.equipped-item :deep(.sprite-thumbnail) { width: 48px; height: 48px; flex: 0 0 48px; }
.equipped-details { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.equipped-category { color: #9a8cab; font-size: 0.66rem; font-weight: 800; text-transform: uppercase; }
.equipped-details strong { overflow: hidden; color: #6b5c7c; font-size: 0.8rem; text-overflow: ellipsis; white-space: nowrap; }
.equipped-warning { display: flex; align-items: center; gap: 3px; color: #b3791b; font-size: 0.66rem; font-weight: 700; }
.remove-button { display: flex; width: 26px; height: 26px; flex: 0 0 26px; align-items: center; justify-content: center; border-radius: 50%; color: #b38e9e; }
.remove-button:hover { background: #f9dede; color: #c26076; }
.empty-layers { display: flex; gap: 8px; align-items: center; margin-top: 24px; color: #887d9a; font-size: 0.82rem; font-weight: 700; }
.empty-layers i { color: #b5a4d0; font-size: 1.35rem; }
.save-button { display: flex; justify-content: center; align-items: center; gap: 8px; width: 100%; margin-top: auto; padding: 14px 12px; border-radius: 15px; background: #8e78bf; color: #fff; font-size: 0.95rem; font-weight: 800; box-shadow: 0 4px 0 #6f5b9e; }
.save-button:hover { background: #7f6ab2; transform: translateY(1px); box-shadow: 0 3px 0 #6f5b9e; }
@media (max-width: 1050px) { .character-editor { grid-template-columns: minmax(320px, 1fr) minmax(300px, 1fr); overflow-y: auto; } .controls-card { grid-column: 1 / -1; min-height: 180px; } }
@media (max-width: 700px) { .character-editor { display: flex; flex-direction: column; padding: 12px; } .selection-card { min-height: 460px; } .preview-card { min-height: 520px; } .controls-card { min-height: 220px; } }
</style>
