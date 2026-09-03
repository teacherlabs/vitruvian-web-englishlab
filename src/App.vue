<script setup lang="ts">
import '@mdi/font/css/materialdesignicons.css'
import CharacterView from '@/components/CharacterView.vue'

</script>

<template>
  <div class="studio-shell flex flex-col h-screen scrollbar-thumb-violet-950 scrollbar-track-transparent scrollbar-thumb-rounded">
    <header class="studio-header flex h-16 px-5 items-center gap-4">
      <div class="flex gap-3 w-96 items-center">
        <img :src="'logo.png'" class="logo-mark h-11">
        <h1>Vitruvian <span>LPC Studio</span></h1>
      </div>
      <div class="grow flex gap-2 justify-center">
        <span class="mode-button active"><i class="mdi mdi-human"></i> Character</span>
      </div>
      <div class="text-right w-96 github-link">
        <a href="https://www.github.com/vitruvianstudio" target="_blank" class="text-2xl"><i class="mdi mdi-github"></i></a>
      </div>
    </header>
    <div class="h-[0px]"></div>

    <character-view></character-view>

    <footer class="studio-footer h-10 flex items-center justify-center text-sm gap-5"><div>&copy; 2023 by napsio</div> <div><i class="mdi mdi-alert-outline"></i> Preview studio — savings may change</div></footer>
  </div>
</template>

<style scoped>
.studio-shell { background: #fff8f1; color: #5a4660; }
.studio-header { background: #fff; border-bottom: 3px solid #f0d9d3; color: #6b5870; }
.logo-mark { border: 3px solid #efd6d5; border-radius: 50%; background: #fff4ec; }
.studio-header h1 { font-weight: 800; letter-spacing: .01em; }
.studio-header h1 span { color: #c28a9d; font-weight: 600; }
.mode-button { padding: 8px 14px; border-radius: 12px; color: #927a8d; font-weight: 700; }
.mode-button:hover, .mode-button.active { background: #f8e6e1; color: #7f6ab2; }
.github-link { color: #927a8d; }
.studio-footer { background: #f8e6e1; color: #927a8d; }
.studio-footer i { color: #d39369; }
</style>
