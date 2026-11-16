import { track } from './analytics.js'

/**
 * A self-contained image annotation editor.
 * All drawing happens in the browser — nothing is uploaded.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{ onStateChange?: (state: object) => void }} [options]
 */
export function createEditor(canvas, { onStateChange = () => {} } = {}) {
  const ctx = canvas.getContext('2d')

  const state = {
    image: null,
    shapes: [],
    redoStack: [],
    tool: 'pen',
    color: '#f43f5e',
    size: 4,
    hasImage: false,
    canUndo: false,
    canRedo: false,
  }

  const dpr = Math.max(window.devicePixelRatio || 1, 1)
  let cssWidth = 0
  let cssHeight = 0
  let drawing = null
  let textPos = null

  const textInput = document.getElementById('text-input')

  /* ----------------------------- rendering ----------------------------- */

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    if (state.image) {
      ctx.drawImage(state.image, 0, 0, cssWidth, cssHeight)
    }

    for (const shape of state.shapes) drawShape(shape)
    if (drawing) drawShape(drawing)
  }

  function drawShape(s) {
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (s.type === 'pen' || s.type === 'highlighter') {
      ctx.globalAlpha = s.type === 'highlighter' ? 0.35 : 1
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.type === 'highlighter' ? s.size * 4 : s.size
      ctx.beginPath()
      ctx.moveTo(s.points[0].x, s.points[0].y)
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y)
      }
      ctx.stroke()
    } else if (s.type === 'text') {
      ctx.globalAlpha = 1
      ctx.fillStyle = s.color
      ctx.font = `${Math.max(s.size * 5, 14)}px system-ui, sans-serif`
      ctx.textBaseline = 'top'
      ctx.fillText(s.text, s.x, s.y)
    } else {
      // line, arrow, rect, ellipse
      ctx.globalAlpha = 1
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.size
      ctx.beginPath()
      const { start, end } = s
      if (s.type === 'line' || s.type === 'arrow') {
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(end.x, end.y)
        if (s.type === 'arrow') drawArrowHead(start, end, s.size)
      } else if (s.type === 'rect') {
        ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y)
      } else if (s.type === 'ellipse') {
        ctx.ellipse(
          (start.x + end.x) / 2,
          (start.y + end.y) / 2,
          Math.abs(end.x - start.x) / 2,
          Math.abs(end.y - start.y) / 2,
          0,
          0,
          Math.PI * 2,
        )
      }
      ctx.stroke()
    }

    ctx.restore()
  }

  function drawArrowHead(start, end, size) {
    const angle = Math.atan2(end.y - start.y, end.x - start.x)
    const len = Math.max(size * 4, 12)
    ctx.moveTo(end.x, end.y)
    ctx.lineTo(
      end.x - len * Math.cos(angle - Math.PI / 6),
      end.y - len * Math.sin(angle - Math.PI / 6),
    )
    ctx.moveTo(end.x, end.y)
    ctx.lineTo(
      end.x - len * Math.cos(angle + Math.PI / 6),
      end.y - len * Math.sin(angle + Math.PI / 6),
    )
  }

  /* ------------------------- sizing & image load ------------------------ */

  function fitImage(img) {
    const container = canvas.parentElement
    const pad = 24
    const maxW = container.clientWidth - pad * 2
    const maxH = container.clientHeight - pad * 2
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
    cssWidth = Math.max(1, Math.round(img.naturalWidth * scale))
    cssHeight = Math.max(1, Math.round(img.naturalHeight * scale))
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`
    canvas.width = Math.round(cssWidth * dpr)
    canvas.height = Math.round(cssHeight * dpr)
  }

  function loadImageFromFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      state.image = img
      state.shapes = []
      state.redoStack = []
      fitImage(img)
      emit()
      render()
      track('image_loaded', { type: file.type, sizeKb: Math.round(file.size / 1024) })
    }
    img.src = url
  }

  /* ---------------------------- pointer input --------------------------- */

  function getPos(e) {
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onPointerDown(e) {
    if (!state.image || !textInput.classList.contains('hidden')) return
    const pos = getPos(e)

    if (state.tool === 'text') {
      e.preventDefault()
      openTextInput(pos)
      return
    }

    canvas.setPointerCapture(e.pointerId)
    drawing = {
      type: state.tool,
      color: state.color,
      size: state.size,
      points: [pos],
      start: pos,
      end: pos,
    }
    render()
  }

  function onPointerMove(e) {
    if (!drawing) return
    const pos = getPos(e)
    if (drawing.type === 'pen' || drawing.type === 'highlighter') {
      drawing.points.push(pos)
    } else {
      drawing.end = pos
    }
    render()
  }

  function onPointerUp() {
    if (!drawing) return
    const shape = drawing
    drawing = null

    const isEmptyPoint =
      (shape.type === 'pen' || shape.type === 'highlighter') && shape.points.length < 2
    const isEmptyDrag =
      (shape.type === 'line' ||
        shape.type === 'arrow' ||
        shape.type === 'rect' ||
        shape.type === 'ellipse') &&
      Math.hypot(shape.end.x - shape.start.x, shape.end.y - shape.start.y) < 2

    if (!isEmptyPoint && !isEmptyDrag) {
      state.shapes.push(shape)
      state.redoStack = []
      track('draw', { tool: shape.type })
    }
    emit()
    render()
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)

  /* ------------------------------ text tool ----------------------------- */

  function openTextInput(pos) {
    textPos = pos
    const stageRect = canvas.parentElement.getBoundingClientRect()
    const canvasRect = canvas.getBoundingClientRect()
    textInput.style.left = `${canvasRect.left - stageRect.left + pos.x}px`
    textInput.style.top = `${canvasRect.top - stageRect.top + pos.y}px`
    textInput.style.color = state.color
    textInput.style.fontSize = `${Math.max(state.size * 5, 16)}px`
    textInput.value = ''
    textInput.classList.remove('hidden')
    textInput.focus()
    // Re-focus after the pointer interaction settles, in case the browser
    // moved focus away during the click.
    requestAnimationFrame(() => {
      if (!textInput.classList.contains('hidden') && document.activeElement !== textInput) {
        textInput.focus()
      }
    })
  }

  function commitText() {
    if (!textInput.classList.contains('hidden')) textInput.classList.add('hidden')
    const value = textInput.value.trim()
    if (!value || !textPos) return
    state.shapes.push({
      type: 'text',
      text: value,
      x: textPos.x,
      y: textPos.y,
      color: state.color,
      size: state.size,
    })
    state.redoStack = []
    textPos = null
    track('draw', { tool: 'text' })
    emit()
    render()
  }

  textInput.addEventListener('keydown', (e) => {
    e.stopPropagation()
    if (e.key === 'Enter') {
      commitText()
    } else if (e.key === 'Escape') {
      textInput.classList.add('hidden')
      textPos = null
    }
  })
  textInput.addEventListener('blur', () => {
    if (!textInput.classList.contains('hidden')) commitText()
  })

  /* --------------------------- history & actions ------------------------ */

  function undo() {
    if (!state.shapes.length) return
    state.redoStack.push(state.shapes.pop())
    emit()
    render()
  }

  function redo() {
    if (!state.redoStack.length) return
    state.shapes.push(state.redoStack.pop())
    emit()
    render()
  }

  function clearAll() {
    if (!state.shapes.length) return
    state.shapes = []
    state.redoStack = []
    emit()
    render()
    track('clear')
  }

  function removeImage() {
    if (!textInput.classList.contains('hidden')) {
      textInput.classList.add('hidden')
      textPos = null
    }
    state.image = null
    state.shapes = []
    state.redoStack = []
    drawing = null
    cssWidth = 0
    cssHeight = 0
    canvas.style.width = ''
    canvas.style.height = ''
    canvas.width = 0
    canvas.height = 0
    emit()
    render()
    track('remove_image')
  }

  function download() {
    if (!state.image) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `inkmark-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      track('download')
    }, 'image/png')
  }

  /**
   * Copies the annotated image to the clipboard as a PNG.
   * The ClipboardItem is built synchronously with a Promise<Blob> so Safari
   * still treats it as part of the user's click.
   * @returns {Promise<boolean>} whether the copy succeeded
   */
  async function copyToClipboard() {
    if (!state.image) return false
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false
    const blob = new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
    )
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      track('copy_image')
      return true
    } catch {
      return false
    }
  }

  function setTool(tool) {
    state.tool = tool
    canvas.style.cursor = tool === 'text' ? 'text' : 'crosshair'
  }

  function setColor(color) {
    state.color = color
  }

  function setSize(size) {
    state.size = size
  }

  /* ------------------------------ helpers ------------------------------- */

  function emit() {
    state.hasImage = !!state.image
    state.canUndo = state.shapes.length > 0
    state.canRedo = state.redoStack.length > 0
    onStateChange(state)
  }

  return {
    state,
    loadImageFromFile,
    download,
    copyToClipboard,
    undo,
    redo,
    clearAll,
    removeImage,
    setTool,
    setColor,
    setSize,
  }
}
