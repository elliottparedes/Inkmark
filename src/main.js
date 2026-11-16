import './style.css'
import { createEditor } from './editor.js'
import { track } from './analytics.js'
import 'vanilla-colorful/hex-color-picker.js'
import 'vanilla-colorful/hex-input.js'
import {
  createIcons,
  Pencil,
  Highlighter,
  MoveUpRight,
  Minus,
  Square,
  Circle,
  Type,
  Undo2,
  Redo2,
  Trash2,
  ImagePlus,
  Download,
  Upload,
  Copy,
} from 'lucide'

// Icons: Lucide (ISC license). Swaps every <i data-lucide="..."> for an inline SVG.
createIcons({
  icons: {
    Pencil,
    Highlighter,
    MoveUpRight,
    Minus,
    Square,
    Circle,
    Type,
    Undo2,
    Redo2,
    Trash2,
    ImagePlus,
    Download,
    Upload,
    Copy,
  },
  attrs: { width: 16, height: 16, 'stroke-width': 1.75, 'aria-hidden': 'true' },
})

const canvas = document.getElementById('canvas')
const stage = document.getElementById('dropzone')
const emptyState = document.getElementById('empty-state')
const fileInput = document.getElementById('file-input')
const sizeInput = document.getElementById('size')
const sizeValue = document.getElementById('size-value')

const editor = createEditor(canvas, { onStateChange })

function onStateChange(state) {
  emptyState.classList.toggle('hidden', state.hasImage)
  canvas.classList.toggle('hidden', !state.hasImage)
  setDisabled('[data-tool]', !state.hasImage)
  if (!state.hasImage) closeColorPopover()
  document.querySelectorAll('[data-needs-image]').forEach((el) => {
    el.classList.toggle('disabled', !state.hasImage)
    el.querySelectorAll('input, button').forEach((input) => (input.disabled = !state.hasImage))
  })
  setDisabled('[data-action="undo"]', !state.canUndo)
  setDisabled('[data-action="redo"]', !state.canRedo)
  setDisabled('[data-action="clear"]', state.shapes.length === 0)
  setDisabled('[data-action="remove-image"]', !state.hasImage)
  setDisabled('[data-action="download"]', !state.hasImage)
  setDisabled('[data-action="copy"]', !state.hasImage)
}

function setDisabled(selector, disabled) {
  document.querySelectorAll(selector).forEach((el) => (el.disabled = disabled))
}

// Delegated clicks: works for toolbar buttons AND the upload button in the empty state.
document.addEventListener('click', (e) => {
  if (!(e.target instanceof Element)) return
  const btn = e.target.closest('[data-tool], [data-action]')
  if (!btn) return

  if (btn.dataset.tool) {
    editor.setTool(btn.dataset.tool)
    document
      .querySelectorAll('[data-tool]')
      .forEach((b) => b.classList.toggle('active', b === btn))
    track('select_tool', { tool: btn.dataset.tool })
    return
  }

  const action = btn.dataset.action
  if (action === 'upload') fileInput.click()
  else if (action === 'undo') editor.undo()
  else if (action === 'redo') editor.redo()
  else if (action === 'clear') editor.clearAll()
  else if (action === 'remove-image') editor.removeImage()
  else if (action === 'download') editor.download()
  else if (action === 'copy') copyImage()
})

async function copyImage() {
  if (!editor.state.hasImage) return
  const ok = await editor.copyToClipboard()
  showToast(ok ? 'Copied to clipboard' : "Couldn't copy here, so use Download instead")
}

/* ------------------------------ color picker ---------------------------- */

const SWATCHES = [
  ['#f43f5e', 'Red'],
  ['#f97316', 'Orange'],
  ['#facc15', 'Yellow'],
  ['#22c55e', 'Green'],
  ['#3b82f6', 'Blue'],
  ['#a855f7', 'Purple'],
  ['#ffffff', 'White'],
  ['#111111', 'Black'],
]

const colorControl = document.querySelector('.color-control')
const colorTrigger = document.getElementById('color-trigger')
const colorDot = document.getElementById('color-dot')
const colorPopover = document.getElementById('color-popover')
const colorPicker = document.getElementById('color-picker')
const colorHex = document.getElementById('color-hex')
const swatchList = document.getElementById('swatches')

for (const [hex, name] of SWATCHES) {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'swatch'
  b.dataset.color = hex
  b.style.setProperty('--swatch', hex)
  b.title = name
  b.setAttribute('aria-label', name)
  swatchList.appendChild(b)
}

function setColor(hex, { fromPicker = false, fromHex = false } = {}) {
  hex = hex.toLowerCase()
  editor.setColor(hex)
  colorDot.style.background = hex
  if (!fromPicker) colorPicker.color = hex
  if (!fromHex) colorHex.color = hex
  swatchList
    .querySelectorAll('.swatch')
    .forEach((s) => s.setAttribute('aria-pressed', String(s.dataset.color === hex)))
}

function openColorPopover() {
  colorPopover.classList.remove('hidden')
  colorTrigger.setAttribute('aria-expanded', 'true')
  // Keep the popover inside the viewport on narrow screens.
  colorPopover.style.transform = ''
  const r = colorPopover.getBoundingClientRect()
  const overflow = r.right - (window.innerWidth - 8)
  if (overflow > 0) colorPopover.style.transform = `translateX(${-overflow}px)`
  else if (r.left < 8) colorPopover.style.transform = `translateX(${8 - r.left}px)`
}

function closeColorPopover() {
  colorPopover.classList.add('hidden')
  colorTrigger.setAttribute('aria-expanded', 'false')
}

colorTrigger.addEventListener('click', () => {
  if (colorPopover.classList.contains('hidden')) openColorPopover()
  else closeColorPopover()
})

swatchList.addEventListener('click', (e) => {
  const swatch = e.target instanceof Element && e.target.closest('.swatch')
  if (!swatch) return
  setColor(swatch.dataset.color)
  closeColorPopover()
  colorTrigger.focus()
})

colorPicker.addEventListener('color-changed', (e) => setColor(e.detail.value, { fromPicker: true }))
colorHex.addEventListener('color-changed', (e) => setColor(e.detail.value, { fromHex: true }))

document.addEventListener('pointerdown', (e) => {
  if (!colorControl.contains(e.target)) closeColorPopover()
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !colorPopover.classList.contains('hidden')) {
    closeColorPopover()
    colorTrigger.focus()
  }
})

setColor(editor.state.color)

sizeInput.addEventListener('input', () => {
  editor.setSize(Number(sizeInput.value))
  sizeValue.textContent = `${sizeInput.value}px`
})

fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files[0]) editor.loadImageFromFile(fileInput.files[0])
  fileInput.value = ''
})

/* --------------------------------- toast -------------------------------- */

let toastTimer

function showToast(message) {
  const toast = document.getElementById('toast')
  toast.textContent = message
  toast.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500)
}

/* ------------------------------ drag & drop ----------------------------- */

for (const ev of ['dragover', 'dragenter']) {
  stage.addEventListener(ev, (e) => {
    e.preventDefault()
    stage.classList.add('dragging')
  })
}
for (const ev of ['dragleave', 'drop']) {
  stage.addEventListener(ev, (e) => {
    e.preventDefault()
    stage.classList.remove('dragging')
  })
}
stage.addEventListener('drop', (e) => {
  const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
  if (file) editor.loadImageFromFile(file)
})

/* --------------------------- paste a screenshot ------------------------- */

window.addEventListener('paste', (e) => {
  // Let normal text pastes (e.g. into the text-label box) through untouched.
  if (e.target instanceof Element && e.target.matches('input, textarea, [contenteditable]')) return
  const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
  if (item) {
    const file = item.getAsFile()
    if (file) editor.loadImageFromFile(file)
  } else {
    showToast('Your clipboard does not contain an image')
  }
})

/* ---------------------------- keyboard shortcuts ------------------------ */

const TOOL_KEYS = {
  v: 'pen',
  h: 'highlighter',
  a: 'arrow',
  l: 'line',
  r: 'rect',
  o: 'ellipse',
  t: 'text',
}

window.addEventListener('keydown', (e) => {
  if (e.target instanceof Element && e.target.matches('input, textarea, [contenteditable]')) return
  const mod = e.ctrlKey || e.metaKey

  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    if (e.shiftKey) editor.redo()
    else editor.undo()
  } else if (mod && e.key.toLowerCase() === 'y') {
    e.preventDefault()
    editor.redo()
  } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'c' && !String(window.getSelection())) {
    e.preventDefault()
    copyImage()
  } else if (mod && e.key.toLowerCase() === 's') {
    e.preventDefault()
    editor.download()
  } else if (!mod && editor.state.hasImage) {
    const tool = TOOL_KEYS[e.key.toLowerCase()]
    if (tool) {
      editor.setTool(tool)
      document
        .querySelectorAll('[data-tool]')
        .forEach((b) => b.classList.toggle('active', b.dataset.tool === tool))
    }
  }
})

// Initial UI state (buttons disabled until an image is loaded).
onStateChange(editor.state)
track('app_ready')
