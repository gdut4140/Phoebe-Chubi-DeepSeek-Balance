import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Package root: lib/index.js -> package root. This keeps the bundle relocatable
// when installed as a normal DSH npm plugin (node_modules or a local link).
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// DSH home: used for the widget size memory file, since node_modules may
// be read-only or cleaned on update.
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')

// Resolve the character image relative to the package first, so the bundle
// works no matter where it is installed.
const IMAGE_CANDIDATES = [
  path.join(PACKAGE_ROOT, 'assets', 'feibi.png'),
]

// Size memory file: prefer writable DSH home locations.
const SIZE_FILE_CANDIDATES = [
  path.join(DSH_HOME, '.phoebe-size.json'),
  path.join(DSH_HOME, 'profiles', 'web', '.phoebe-size.json'),
]

// 点击音效池：随机五选一；2 秒内连点 3 次触发特殊音效 feiba。
const SOUND_NAMES = ['feibe', 'feibe1', 'feibe2', 'feibe3', 'feibe4', 'feiba']
const BALANCE_URL = 'https://api.deepseek.com/user/balance'
const BALANCE_TTL_MS = 25000
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
}

const WIDGET_JS = `(function () {
if (window.__phoebeWidget) return
window.__phoebeWidget = true

var MIN_SCALE = 0.6
var MAX_SCALE = 2.5
var STEP = 0.1
var CLICK_SQ = 9
var REFRESH_MS = 60000
var CHANGE_MS = 900
var ANIM_MS = 700
var BUBBLE_MS = 5000
var FETCH_TIMEOUT_MS = 25000
var BALANCE_URL = '/phoebe/balance.json'
var SIZE_URL = '/phoebe/size.json'
var IMG_URL = '/phoebe/image.png?v=3'

var css = [
  '.phoebe-root{position:fixed;right:0;bottom:0;--phoebe-scale:1;--phoebe-base:clamp(122px,calc(min(250px,min(100vw,100vh) * 0.28) * var(--phoebe-scale)),625px);width:var(--phoebe-base);height:var(--phoebe-base);pointer-events:none;user-select:none;-webkit-user-select:none;z-index:9999;font-family:inherit;transition:left .16s ease,top .16s ease,transform .3s ease}',
  '.phoebe-root.phoebe-left{transform:scaleX(-1)}',
  '.phoebe-root.phoebe-dragging{cursor:grabbing;transition:none}',
  '.phoebe-body{position:absolute;left:0;top:0;width:100%;height:100%;transform-origin:50% 100%;transition:transform .22s cubic-bezier(.34,1.56,.64,1)}',
  '.phoebe-img{position:absolute;right:0;bottom:0;width:59.45%;height:59.45%;display:block;pointer-events:none;-webkit-user-drag:none;user-select:none}',
  '.phoebe-bubble{position:absolute;left:0;top:0;width:100%;aspect-ratio:1026/700;pointer-events:none;z-index:1}',
  '.phoebe-bubble svg{display:block;width:100%;height:100%;pointer-events:none}',
  '.phoebe-bubble svg path,.phoebe-bubble svg ellipse{pointer-events:none;cursor:pointer}',
  '.phoebe-bubble.phoebe-bubble-open svg path,.phoebe-bubble.phoebe-bubble-open svg ellipse{pointer-events:visiblePainted}',
  '.phoebe-bubble .phoebe-bshape,.phoebe-bubble .phoebe-b1,.phoebe-bubble .phoebe-b2{opacity:0;transform:scale(.7);transform-box:fill-box;transform-origin:50% 50%;transition:opacity .2s ease,transform .2s ease}',
  '.phoebe-bubble.phoebe-bubble-open .phoebe-bshape,.phoebe-bubble.phoebe-bubble-open .phoebe-b1,.phoebe-bubble.phoebe-bubble-open .phoebe-b2{opacity:1;transform:none}',
  '.phoebe-bubble.phoebe-bubble-open .phoebe-b2{transition-delay:0s}',
  '.phoebe-bubble.phoebe-bubble-open .phoebe-b1{transition-delay:.13s}',
  '.phoebe-bubble.phoebe-bubble-open .phoebe-bshape{transition-delay:.26s}',
  '.phoebe-bubble .phoebe-bshape{transition-delay:.1s}',
  '.phoebe-bubble .phoebe-b1{transition-delay:.2s}',
  '.phoebe-bubble .phoebe-b2{transition-delay:.3s}',
  '.phoebe-text{position:absolute;left:44.25%;top:38%;transform:translate(-50%,-50%);text-align:center;color:#6d5736;line-height:1.15;white-space:nowrap;--phoebe-u:calc(var(--phoebe-base) / 1026);pointer-events:none;opacity:0;transition:opacity .16s ease,transform .3s ease}',
  '.phoebe-bubble.phoebe-bubble-open .phoebe-text{opacity:1;transition:opacity .16s ease .36s,transform .3s ease}',
  '.phoebe-root.phoebe-left .phoebe-text{transform:translate(-50%,-50%) scaleX(-1)}',
  '.phoebe-label{font-size:calc(var(--phoebe-u) * 66);font-weight:600;letter-spacing:.06em}',
  '.phoebe-amount{font-size:calc(var(--phoebe-u) * 128);font-weight:800;line-height:1.05}',
  '.phoebe-period{font-size:calc(var(--phoebe-u) * 104);font-weight:800;line-height:1.05}',
  '.phoebe-wrap{white-space:normal;max-width:calc(var(--phoebe-u) * 560);line-height:1.2}',
  '.phoebe-hint{font-size:calc(var(--phoebe-u) * 56);color:#a08a63;letter-spacing:.02em;margin-top:calc(var(--phoebe-u) * 9)}',
  '.phoebe-menu-btn{position:absolute;top:calc(40.55% + 4px);right:4px;width:26px;height:26px;border:none;border-radius:6px;background:rgba(122,95,58,.85);cursor:pointer;pointer-events:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:0;z-index:2;opacity:0;transition:opacity .15s ease}',
  '.phoebe-menu-btn.phoebe-menu-btn-visible{opacity:1}',
  '.phoebe-menu-btn span{display:block;width:14px;height:2px;background:#fef1c8;border-radius:1px}',
  '.phoebe-menu-btn:hover{background:#6d5736}',
  '.phoebe-menu{position:fixed;min-width:232px;background:rgba(253,242,206,.95);border:1px solid rgba(122,95,58,.35);border-radius:10px;padding:10px 12px;opacity:0;transform:scale(.92) translateY(-4px);transform-origin:top right;transition:opacity .18s ease,transform .2s cubic-bezier(.34,1.56,.64,1);pointer-events:none;z-index:10000;box-shadow:0 6px 18px rgba(0,0,0,.18);color-scheme:light}',
  '.phoebe-menu.phoebe-menu-open{opacity:1;transform:scale(1) translateY(0);pointer-events:auto}',
  '.phoebe-menu-row{display:flex;align-items:center;gap:8px;margin:5px 0;color:#6d5736;font-size:12px;white-space:nowrap}',
  '.phoebe-range{flex:1;min-width:0;accent-color:#6d5736}',
  '.phoebe-number{width:46px;border:1px solid rgba(122,95,58,.4);border-radius:6px;padding:2px 4px;font-size:12px;color:#6d5736;background:#fffdf5}',
  '.phoebe-sound{flex:1;border:1px solid rgba(122,95,58,.4);border-radius:6px;background:rgba(122,95,58,.08);color:#6d5736;font-size:12px;padding:3px 0;cursor:pointer}',
  '.phoebe-sound:hover{background:rgba(122,95,58,.16)}',
  '.phoebe-volpct{width:36px;text-align:right;color:#6d5736;font-size:12px}'
].join('\\n')

var styleEl = document.createElement('style')
styleEl.textContent = css
document.head.appendChild(styleEl)

var root = document.createElement('div')
root.className = 'phoebe-root'

var img = document.createElement('img')
img.className = 'phoebe-img'
img.src = IMG_URL
img.alt = 'DeepSeek 余额'
img.draggable = false

var menuBtn = document.createElement('button')
menuBtn.type = 'button'
menuBtn.className = 'phoebe-menu-btn'
menuBtn.title = '菜单'
menuBtn.innerHTML = '<span></span><span></span><span></span>'
menuBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleMenu() })

var menuBox = document.createElement('div')
menuBox.className = 'phoebe-menu'
function menuLabel(text) {
  var s = document.createElement('span')
  s.textContent = text
  return s
}
function menuRow() {
  var r = document.createElement('div')
  r.className = 'phoebe-menu-row'
  return r
}
var scaleInput = document.createElement('input')
scaleInput.type = 'range'
scaleInput.min = String(MIN_SCALE)
scaleInput.max = String(MAX_SCALE)
scaleInput.step = '0.1'
scaleInput.className = 'phoebe-range'
scaleInput.value = '1.5'
var scaleNumber = document.createElement('input')
scaleNumber.type = 'number'
scaleNumber.min = '1'
scaleNumber.max = '20'
scaleNumber.step = '1'
scaleNumber.className = 'phoebe-number'
scaleNumber.value = '10'
scaleInput.addEventListener('pointerdown', function () { root.style.transition = 'none' })
scaleInput.addEventListener('input', function () { setScale(scaleInput.value) })
scaleInput.addEventListener('change', function () { root.style.transition = '' })
scaleNumber.addEventListener('change', function () {
  var v = Math.round(Number(scaleNumber.value))
  var s = MIN_SCALE + Math.max(0, Math.min(20, v) - 1) * (MAX_SCALE - MIN_SCALE) / 19
  setScale(s)
  root.style.transition = ''
})
var row1 = menuRow()
row1.appendChild(menuLabel('大小'))
row1.appendChild(scaleInput)
row1.appendChild(scaleNumber)
var volInput = document.createElement('input')
volInput.type = 'range'
volInput.min = '0'
volInput.max = '1'
volInput.step = '0.05'
volInput.className = 'phoebe-range'
volInput.value = '0.9'
var volPct = document.createElement('span')
volPct.className = 'phoebe-volpct'
volPct.textContent = '90%'
volInput.addEventListener('input', function () { setVol(volInput.value) })
var row3 = menuRow()
row3.appendChild(menuLabel('音量'))
row3.appendChild(volInput)
row3.appendChild(volPct)
menuBox.appendChild(row1)
menuBox.appendChild(row3)

var apiKeyRow = menuRow()
apiKeyRow.appendChild(menuLabel('API Key'))
var apiKeyInput = document.createElement('input')
apiKeyInput.type = 'password'
apiKeyInput.placeholder = 'sk-...（留空用默认凭据）'
apiKeyInput.style.cssText = 'flex:1;min-width:0;padding:2px 6px;border:1px solid rgba(122,95,58,.4);border-radius:6px;font-size:12px;color:#6d5736;background:#fffdf5'
var apiKeySave = document.createElement('button')
apiKeySave.type = 'button'
apiKeySave.className = 'phoebe-sound'
apiKeySave.style.flex = 'none'
apiKeySave.textContent = '保存'
apiKeySave.addEventListener('click', function (e) {
  e.stopPropagation()
  storedApiKey = apiKeyInput.value.trim()
  saveConfig()
  updateApiKeyHint()
  refresh(false)
})
apiKeyRow.appendChild(apiKeyInput)
apiKeyRow.appendChild(apiKeySave)
menuBox.appendChild(apiKeyRow)

var apiKeyHint = document.createElement('div')
apiKeyHint.style.cssText = 'font-size:11px;color:#a08a63;margin:2px 0 4px;line-height:1.3'
menuBox.appendChild(apiKeyHint)

var textBox = document.createElement('div')
textBox.className = 'phoebe-text'
var labelEl = document.createElement('div')
labelEl.className = 'phoebe-label'
labelEl.textContent = 'DeepSeek 余额'
var amountEl = document.createElement('div')
amountEl.className = 'phoebe-amount'
var hintEl = document.createElement('div')
hintEl.className = 'phoebe-hint'
textBox.appendChild(labelEl)
textBox.appendChild(amountEl)
textBox.appendChild(hintEl)

var bubbleBox = document.createElement('div')
bubbleBox.className = 'phoebe-bubble'
bubbleBox.innerHTML = '<svg viewBox="0 0 1026 700" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">' +
  '<path class="phoebe-bshape" fill="#fef1c8" stroke="#c3b091" stroke-width="18" stroke-linejoin="round" stroke-linecap="round" d="M 827 248 A 373 232 0 1 0 81 246 A 373 232 0 0 0 301 465 A 57 32 10 0 0 413 484 A 373 232 0 0 0 827 248 Z"/>' +
  '<ellipse class="phoebe-b1" cx="352" cy="561" rx="37.5" ry="26" fill="#fef1c8" stroke="#c3b091" stroke-width="18"/>' +
  '<ellipse class="phoebe-b2" cx="442" cy="646" rx="24.5" ry="18" fill="#fef1c8" stroke="#c3b091" stroke-width="18"/>' +
  '</svg>'
bubbleBox.appendChild(textBox)
bubbleBox.addEventListener('click', function (e) {
  e.stopPropagation()
  if (!bubbleShown) return
  if (bubbleRandomActive) {
    // 再次点击：关闭
    hideBubble()
  } else {
    // 首次点击：切到随机台词段（不延长总显示时长）
    bubbleRandomActive = true
    bubbleRandomLines = pickRandomLines()
    swapBubbleContent(function () { applyBubbleLines(bubbleRandomLines) })
  }
})

var body = document.createElement('div')
body.className = 'phoebe-body'
body.appendChild(img)
body.appendChild(bubbleBox)
root.appendChild(body)
root.appendChild(menuBtn)
document.body.appendChild(root)
document.body.appendChild(menuBox)

// Position model: the widget is ALWAYS expressed in left/top px (so edge snaps
// animate smoothly via the CSS transition on both sides — switching to
// right/auto cannot transition and flashes). The anchor info (h/v + offsets)
// lives in state and is used by settle() to recompute coordinates on window
// resize and size changes, keeping the widget glued to its anchored edge.
var state = {
  scale: 1.5,
  h: 'right',
  hOff: 0,
  v: 'bottom',
  vOff: 0,
  left: 0,
  top: 0,
  balance: null,
  currency: null,
  status: 'loading',
  message: ''
}
var busy = false
var settleTimer = null
var animDelayTimer = null
var drag = null
var shown = null
var animId = null
var bubbleShown = false
var bubbleTimer = null
var bubbleRandomActive = false
var bubbleRandomLines = null
var BUBBLE_STYLE_CLASS = { A: 'phoebe-label', B: 'phoebe-amount', P: 'phoebe-period', C: 'phoebe-hint' }
function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function singleCenter(style, text, color, wrap) { return [null, { t: text, s: style, c: color || '', w: !!wrap }, null] }
function buildBalanceGroup() {
  return [
    { t: 'DeepSeek 余额', s: 'A', c: '' },
    { t: fmt(state.balance, state.currency), s: 'B', c: '' },
    { t: '菲比啾比~', s: 'C', c: '' },
  ]
}
var RANDOM_GROUPS = [
  { w: 20, lines: buildBalanceGroup },
  { w: 7, lines: function () { return singleCenter('B', pickOne(['好模型... ↓', '好女孩...↓'])) } },
  { w: 7, lines: function () { return singleCenter('A', pickOne(['不知道主人有什么用，先赶走吧~', '我...我...我也要挣钱吗？', '我去吃饭啦，测完叫我', '我的头发很贵的！', '好困...要充电了', '坏了...主人彻底怒了！']), '', true) } },
  { w: 3, lines: function () { return singleCenter('A', pickOne(['恭喜你实现token自由！token全跑了！', '真当我是便宜货啊...', '小心我记你的小本本！']), '', true) } },
  { w: 1, lines: function () { return [{ t: '这个', s: 'A', c: '' }, { t: '凶', s: 'B', c: '' }, { t: '是什么意思呀...', s: 'A', c: '' }] } },
  { w: 1, lines: function () { return singleCenter('B', '啾比啾比... ') } },
]
function pickRandomLines() {
  var total = 0
  for (var i = 0; i < RANDOM_GROUPS.length; i++) total += RANDOM_GROUPS[i].w
  var r = Math.random() * total
  for (var i = 0; i < RANDOM_GROUPS.length; i++) {
    r -= RANDOM_GROUPS[i].w
    if (r < 0) return RANDOM_GROUPS[i].lines()
  }
  return RANDOM_GROUPS[RANDOM_GROUPS.length - 1].lines()
}
function applyBubbleLines(lines) {
  var els = [labelEl, amountEl, hintEl]
  for (var i = 0; i < 3; i++) {
    var el = els[i]
    var ln = lines && lines[i]
    if (ln) {
      el.style.display = ''
      el.className = (BUBBLE_STYLE_CLASS[ln.s] || 'phoebe-label') + (ln.w ? ' phoebe-wrap' : '')
      el.textContent = ln.t
      el.style.color = ln.c || ''
    } else {
      el.style.display = 'none'
      el.textContent = ''
      el.style.color = ''
    }
  }
}
var bubbleSwapTimer = null
var hintFadeTimer = null
var lastHintText = null
function setHint(text) {
  // 「加载中…」→「菲比啾比~」等提示行变化时做淡出淡入，其余直接替换
  if (text === lastHintText) return
  lastHintText = text
  if (hintFadeTimer) { clearTimeout(hintFadeTimer); hintFadeTimer = null }
  if (!bubbleShown) {
    hintEl.textContent = text
    return
  }
  hintEl.style.transition = 'opacity .18s ease'
  hintEl.style.opacity = '0'
  hintFadeTimer = setTimeout(function () {
    hintFadeTimer = null
    hintEl.textContent = text
    hintEl.style.opacity = '1'
    setTimeout(function () {
      hintEl.style.transition = ''
      hintEl.style.opacity = ''
    }, 220)
  }, 190)
}
function swapBubbleContent(applyFn) {
  if (bubbleSwapTimer) { clearTimeout(bubbleSwapTimer); bubbleSwapTimer = null }
  textBox.style.transition = 'opacity .18s ease'
  textBox.style.opacity = '0'
  bubbleSwapTimer = setTimeout(function () {
    bubbleSwapTimer = null
    applyFn()
    textBox.style.opacity = '1'
    setTimeout(function () {
      textBox.style.transition = ''
      textBox.style.opacity = ''
    }, 220)
  }, 190)
}
function restoreBubbleLines() {
  if (bubbleSwapTimer) { clearTimeout(bubbleSwapTimer); bubbleSwapTimer = null }
  if (hintFadeTimer) { clearTimeout(hintFadeTimer); hintFadeTimer = null }
  lastHintText = null
  textBox.style.transition = ''
  textBox.style.opacity = ''
  labelEl.style.display = ''
  labelEl.className = 'phoebe-label'
  labelEl.textContent = 'DeepSeek 余额'
  labelEl.style.color = ''
  amountEl.className = 'phoebe-amount'
  amountEl.style.color = ''
  hintEl.className = 'phoebe-hint'
  hintEl.style.color = ''
  render()
}
function showBubble() {
  if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer = null }
  bubbleShown = true
  bubbleRandomActive = false
  restoreBubbleLines()
  bubbleBox.classList.add('phoebe-bubble-open')
  // 默认展示当前内容；点击气泡切到随机台词段；总时长 5 秒自动关闭
  bubbleTimer = setTimeout(hideBubble, BUBBLE_MS)
}
function hideBubble() {
  if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer = null }
  if (bubbleSwapTimer) { clearTimeout(bubbleSwapTimer); bubbleSwapTimer = null }
  if (hintFadeTimer) { clearTimeout(hintFadeTimer); hintFadeTimer = null }
  textBox.style.transition = ''
  textBox.style.opacity = ''
  hintEl.style.transition = ''
  hintEl.style.opacity = ''
  bubbleRandomActive = false
  bubbleRandomLines = null
  bubbleShown = false
  bubbleBox.classList.remove('phoebe-bubble-open')
}

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }
function viewport() {
  return {
    w: window.innerWidth || document.documentElement.clientWidth || 1280,
    h: window.innerHeight || document.documentElement.clientHeight || 800
  }
}
function fmt(balance, currency) {
  var num = Number(balance)
  var fixed = isFinite(num) ? num.toFixed(2) : '--'
  return currency === 'CNY' ? '¥ ' + fixed : fixed + ' ' + currency
}
function animateAmount(from, to, currency, duration) {
  if (animId) cancelAnimationFrame(animId)
  if (from === null || !isFinite(from)) from = to
  if (from === to) {
    shown = to
    amountEl.textContent = fmt(to, currency)
    return
  }
  var startTime = null
  function step(ts) {
    if (startTime === null) startTime = ts
    var t = Math.min(1, (ts - startTime) / duration)
    var eased = 1 - Math.pow(1 - t, 3)
    var val = from + (to - from) * eased
    amountEl.textContent = fmt(val, currency)
    if (t < 1) {
      animId = requestAnimationFrame(step)
    } else {
      animId = null
      shown = to
      amountEl.textContent = fmt(to, currency)
    }
  }
  animId = requestAnimationFrame(step)
}
function render() {
  var amount, hint
  if (state.status === 'error') {
    amount = shown !== null ? fmt(shown, state.currency) : '--'
    hint = state.message ? state.message.slice(0, 14) : '获取失败 · 点击重试'
  } else if (state.balance === null) {
    amount = shown !== null ? fmt(shown, state.currency) : '…'
    hint = '加载中…'
  } else {
    amount = shown !== null ? fmt(shown, state.currency) : fmt(state.balance, state.currency)
    hint = '菲比啾比~'
  }
  amountEl.textContent = amount
  if (bubbleRandomActive && bubbleRandomLines) {
    applyBubbleLines(bubbleRandomLines)
  } else if (!reactionActive) {
    setHint(hint)
  }
}
function express() {
  root.style.right = 'auto'
  root.style.bottom = 'auto'
  root.style.left = state.left + 'px'
  root.style.top = state.top + 'px'
  root.classList.toggle('phoebe-left', state.h === 'left')
}
function settle() {
  var vp = viewport()
  var w = root.offsetWidth || root.getBoundingClientRect().width || 0
  var h = root.offsetHeight || root.getBoundingClientRect().height || 0
  if (drag && drag.active) {
    // mid-drag resize: keep the pointer-follow position, just clamp into view
    state.left = clamp(state.left, 0, Math.max(0, vp.w - w))
    state.top = clamp(state.top, 0, Math.max(0, vp.h - h))
    express()
    return
  }
  if (state.h === 'right') {
    state.left = Math.max(0, vp.w - w - state.hOff)
  } else if (state.h === 'left') {
    state.left = state.hOff
  } else {
    state.left = clamp(state.left, 0, Math.max(0, vp.w - w))
  }
  if (state.v === 'bottom') {
    state.top = Math.max(0, vp.h - h - state.vOff)
  } else if (state.v === 'top') {
    state.top = state.vOff
  } else {
    state.top = clamp(state.top, 0, Math.max(0, vp.h - h))
  }
  express()
}
function refresh(manual) {
  if (busy) return
  busy = true
  if (animDelayTimer) { clearTimeout(animDelayTimer); animDelayTimer = null }
  if (manual || state.balance === null) { state.status = 'loading'; render() }
  var ctrl = null
  var timer = null
  try {
    ctrl = new AbortController()
    timer = setTimeout(function () { try { ctrl.abort() } catch (err) {} }, FETCH_TIMEOUT_MS)
  } catch (err) {}
  fetch(BALANCE_URL, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
    .then(function (r) { return r.json() })
    .then(function (data) {
      if (data && data.ok) {
        var nb = Number(data.totalBalance)
        var nc = String(data.currency || 'CNY')
        var changed = state.balance !== null && (nb !== state.balance || nc !== state.currency)
        var currencyChanged = state.currency !== null && nc !== state.currency
        state.balance = nb
        state.currency = nc
        state.message = ''
        if (changed && !currencyChanged) {
          if (!manual) {
            showBubble()
            state.status = 'changing'
            // balance-change bubble: wait 0.3s after it floats out, then roll the number
            if (animDelayTimer) clearTimeout(animDelayTimer)
            animDelayTimer = setTimeout(function () {
              animDelayTimer = null
              animateAmount(shown, nb, nc, ANIM_MS)
            }, 300)
            if (settleTimer) clearTimeout(settleTimer)
            settleTimer = setTimeout(function () {
              settleTimer = null
              if (state.status === 'changing') { state.status = 'ok'; render() }
            }, CHANGE_MS + 300)
          } else {
            animateAmount(shown, nb, nc, ANIM_MS)
            state.status = 'ok'
            render()
          }
        } else {
          if (animId === null) shown = nb
          state.status = 'ok'
          render()
        }
      } else {
        state.status = 'error'
        state.message = (data && data.error) ? String(data.error) : '获取失败'
        render()
      }
    })
    .catch(function () {
      state.status = 'error'
      state.message = '获取失败'
      render()
    })
    .finally(function () {
      busy = false
      if (timer) clearTimeout(timer)
    })
}
var soundOn = true
var soundVol = 0.9
var storedApiKey = ''
var RANDOM_SOUND_NAMES = ['feibe', 'feibe1', 'feibe2', 'feibe3', 'feibe4']
var SPECIAL_SOUND_NAME = 'feiba'
var RAPID_WINDOW_MS = 2000
var RAPID_CLICKS = 3
var clickTimes = []
var audioPool = {}
function updateApiKeyHint() {
  apiKeyHint.textContent = storedApiKey ? '已用自定义 Key 查余额' : '未设 Key，用默认凭据查余额'
}
function saveConfig() {
  try {
    fetch(SIZE_URL, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scale: state.scale, sound: soundOn, vol: soundVol, apiKey: storedApiKey }) })
  } catch (err) {}
}
function getAudio(name) {
  if (!audioPool[name]) {
    var a = new Audio('/phoebe/sound.mp3?name=' + name)
    a.preload = 'auto'
    a.volume = soundVol
    audioPool[name] = a
  }
  return audioPool[name]
}
function setPoolVolume(v) {
  for (var k in audioPool) {
    try { audioPool[k].volume = v } catch (err) {}
  }
}
function playSound(name) {
  if (!soundOn) return
  try {
    var a = getAudio(name)
    a.currentTime = 0
    var p = a.play()
    if (p && typeof p.catch === 'function') p.catch(function () {})
  } catch (err) {}
}
var reactionActive = false
var reactionTimer = null
function showReaction(text) {
  reactionActive = true
  hintEl.textContent = text
  if (reactionTimer) clearTimeout(reactionTimer)
  reactionTimer = setTimeout(function () {
    reactionTimer = null
    reactionActive = false
    lastHintText = null
    render()
  }, 2500)
}
function playClickSound() {
  var now = Date.now()
  clickTimes.push(now)
  clickTimes = clickTimes.filter(function (t) { return now - t < RAPID_WINDOW_MS })
  if (clickTimes.length >= RAPID_CLICKS) {
    clickTimes = []
    playSound(SPECIAL_SOUND_NAME)
    showReaction('菲八啾比!')
  } else {
    playSound(RANDOM_SOUND_NAMES[Math.floor(Math.random() * RANDOM_SOUND_NAMES.length)])
  }
}
function scaleToDisplay(s) {
  return Math.round((s - MIN_SCALE) / ((MAX_SCALE - MIN_SCALE) / 19)) + 1
}
function setScale(v) {
  var next = Math.round(Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(v))) * 10) / 10
  var rect = root.getBoundingClientRect()
  // fixed point: the character's corner — bottom-right when unflipped, bottom-left
  // when flipped. Growing extends the widget up-left / up-right from that
  // corner; shrinking pulls it back toward the corner.
  var fx = state.h === 'left' ? rect.left : rect.right
  var fy = rect.bottom
  state.scale = next
  root.style.setProperty('--phoebe-scale', String(next))
  scaleInput.value = String(next)
  scaleNumber.value = String(scaleToDisplay(next))
  saveConfig()
  // keep the corner fixed while resizing; the position correction applies
  // instantly because the caller disables the transition for the whole drag
  var r2 = root.getBoundingClientRect()
  var vp = viewport()
  if (state.h === 'left') {
    state.left = Math.min(Math.max(fx, 0), Math.max(0, vp.w - r2.width))
  } else {
    state.left = Math.min(Math.max(fx - r2.width, 0), Math.max(0, vp.w - r2.width))
  }
  state.top = Math.min(Math.max(fy - r2.height, 0), Math.max(0, vp.h - r2.height))
  express()
}
function setVol(v) {
  var next = Math.round(Math.min(1, Math.max(0, Number(v))) * 100) / 100
  soundVol = next
  soundOn = next > 0
  volInput.value = String(next)
  volPct.textContent = Math.round(next * 100) + '%'
  setPoolVolume(next)
  saveConfig()
}
var SQUISH = 'scaleY(0.88) scaleX(1.05)'
function pressDown() {
  body.style.transform = SQUISH
  playClickSound()
}
function pressUp() {
  body.style.transform = 'scaleY(1) scaleX(1)'
}
var menuOpen = false
function toggleMenu() {
  menuOpen = !menuOpen
  if (menuOpen) positionMenu()
  menuBox.classList.toggle('phoebe-menu-open', menuOpen)
  if (menuOpen) menuBtn.classList.add('phoebe-menu-btn-visible')
}
function closeMenu() {
  menuOpen = false
  menuBox.classList.remove('phoebe-menu-open')
  root.style.transition = ''
  snapCheck()
}
function snapCheck() {
  var rect = root.getBoundingClientRect()
  var vp = viewport()
  var w = rect.width, h = rect.height
  var left = rect.left, top = rect.top
  var centerX = left + w / 2
  var centerY = top + h / 2
  var moved = false
  if (centerX < vp.w / 4) {
    state.h = 'left'
    state.hOff = 0
    left = 0
    moved = true
  } else if (centerX > vp.w * 3 / 4) {
    state.h = 'right'
    state.hOff = 0
    left = vp.w - w
    moved = true
  } else {
    state.h = null
    state.hOff = left
  }
  if (centerY < vp.h / 4) {
    state.v = 'top'
    state.vOff = 0
    top = 0
    moved = true
  } else {
    state.v = 'bottom'
    state.vOff = Math.max(0, vp.h - top - h)
  }
  if (moved) {
    state.left = left
    state.top = top
    settle()
  }
}
function positionMenu() {
  try {
    var r = root.getBoundingClientRect()
    var b = menuBtn.getBoundingClientRect()
    var vp = viewport()
    var onLeft = r.left + r.width / 2 < vp.w / 2
    // the menu appears ABOVE the button, anchored to its side:
    // right side → menu bottom-right aligns with the button's top-right;
    // left side → menu bottom-left aligns with the button's top-left
    if (onLeft) {
      menuBox.style.left = b.left + 'px'
      menuBox.style.right = 'auto'
      menuBox.style.transformOrigin = 'bottom left'
    } else {
      menuBox.style.right = (vp.w - b.right) + 'px'
      menuBox.style.left = 'auto'
      menuBox.style.transformOrigin = 'bottom right'
    }
    menuBox.style.bottom = (vp.h - b.top) + 'px'
    menuBox.style.top = 'auto'
  } catch (err) {}
}

var hitCanvas = null
var hitReady = false
function setupHitTest() {
  try {
    hitCanvas = document.createElement('canvas')
    hitCanvas.width = 610
    hitCanvas.height = 610
    var probe = new Image()
    probe.onload = function () {
      try {
        hitCanvas.getContext('2d').drawImage(probe, 0, 0)
        hitReady = true
      } catch (err) {}
    }
    probe.onerror = function () {}
    probe.src = IMG_URL
  } catch (err) {}
}
function isCharacterHit(e) {
  if (!hitCanvas || !hitReady) return true
  try {
    var r = img.getBoundingClientRect()
    if (!r || r.width <= 0 || r.height <= 0) return false
    var lx = (e.clientX - r.left) / r.width * 610
    var ly = (e.clientY - r.top) / r.height * 610
    if (lx < 0 || ly < 0 || lx >= 610 || ly >= 610) return false
    if (state.h === 'left') lx = 610 - lx
    var data = hitCanvas.getContext('2d').getImageData(Math.floor(lx), Math.floor(ly), 1, 1).data
    return data[3] > 10
  } catch (err) {
    return true
  }
}
function onDocPointerDown(e) {
  if (e.target && e.target.closest) {
    if (e.target.closest('.phoebe-bubble') || e.target.closest('.phoebe-menu') || e.target.closest('.phoebe-menu-btn')) return
  }
  if (menuOpen) {
    closeMenu()
    return
  }
  if (e.button !== 0 && e.pointerType === 'mouse') return
  if (!isCharacterHit(e)) return
  try { e.preventDefault(); e.stopPropagation() } catch (err) {}
  var vp = viewport()
  var rect = root.getBoundingClientRect()
  drag = { active: true, startX: e.clientX, startY: e.clientY, origLeft: rect.left, origTop: rect.top, w: rect.width, h: rect.height, moved: false, vp: vp }
  root.classList.add('phoebe-dragging')
  pressDown()
  setWidgetCursor('grabbing')
  document.addEventListener('pointermove', onDocPointerMove, true)
  document.addEventListener('pointerup', onDocPointerUp, true)
  document.addEventListener('pointercancel', onDocPointerCancel, true)
  document.addEventListener('click', onDocClickStopper, true)
}
function onDocPointerMove(e) {
  if (!drag || !drag.active) return
  var dx = e.clientX - drag.startX
  var dy = e.clientY - drag.startY
  if (dx * dx + dy * dy >= CLICK_SQ) drag.moved = true
  // Keep the pre-drag flip orientation while dragging (state.h/v stay as they
  // were); on release endDrag() recomputes the anchors and settle() flips the
  // class with a smooth transition instead of reverting instantly.
  state.left = clamp(drag.origLeft + dx, 0, Math.max(0, drag.vp.w - drag.w))
  state.top = clamp(drag.origTop + dy, 0, Math.max(0, drag.vp.h - drag.h))
  express()
}
function onDocPointerUp(e) { endDrag(e, true) }
function onDocPointerCancel(e) { endDrag(e, false) }
function onDocClickStopper(e) {
  try { e.preventDefault(); e.stopPropagation() } catch (err) {}
}
document.addEventListener('pointerdown', onDocPointerDown, true)

var widgetCursor = ''
function setWidgetCursor(v) {
  if (v !== widgetCursor) {
    widgetCursor = v
    try { document.body.style.cursor = v } catch (err) {}
  }
}
function onDocPointerMoveCursor(e) {
  if (drag && drag.active) { setWidgetCursor('grabbing'); return }
  var el = null
  try { el = document.elementFromPoint(e.clientX, e.clientY) } catch (err) {}
  if (el && el.closest && (el.closest('.phoebe-bubble') || el.closest('.phoebe-menu') || el.closest('.phoebe-menu-btn'))) {
    setWidgetCursor('')
    menuBtn.classList.add('phoebe-menu-btn-visible')
    return
  }
  var over = isCharacterHit(e)
  setWidgetCursor(over ? 'grab' : '')
  menuBtn.classList.toggle('phoebe-menu-btn-visible', over || menuOpen)
}
document.addEventListener('pointermove', onDocPointerMoveCursor, true)

function endDrag(e, clickAllowed) {
  if (!drag || !drag.active) return
  drag.active = false
  document.removeEventListener('pointermove', onDocPointerMove, true)
  document.removeEventListener('pointerup', onDocPointerUp, true)
  document.removeEventListener('pointercancel', onDocPointerCancel, true)
  document.removeEventListener('click', onDocClickStopper, true)
  pressUp()
  root.classList.remove('phoebe-dragging')
  setWidgetCursor(isCharacterHit(e) ? 'grab' : '')
  if (clickAllowed && !drag.moved) { showBubble(); refresh(true); return }
  var dx = e.clientX - drag.startX
  var dy = e.clientY - drag.startY
  var left = clamp(drag.origLeft + dx, 0, Math.max(0, drag.vp.w - drag.w))
  var top = clamp(drag.origTop + dy, 0, Math.max(0, drag.vp.h - drag.h))
  var centerX = left + drag.w / 2
  var centerY = top + drag.h / 2
  if (centerX < drag.vp.w / 4) {
    state.h = 'left'
    state.hOff = 0
  } else if (centerX > drag.vp.w * 3 / 4) {
    state.h = 'right'
    state.hOff = 0
  } else {
    state.h = null
    state.hOff = left
  }
  if (centerY < drag.vp.h / 4) {
    state.v = 'top'
    state.vOff = 0
  } else if (centerY > drag.vp.h * 3 / 4) {
    state.v = 'bottom'
    state.vOff = 0
  } else {
    state.v = null
    state.vOff = top
  }
  state.left = left
  state.top = top
  settle()
}
window.addEventListener('resize', function () {
  settle()
})

var rect0 = root.getBoundingClientRect()
state.left = rect0.left
state.top = rect0.top
express()
render()
updateApiKeyHint()
setupHitTest()
fetch(SIZE_URL, { cache: 'no-store' })
  .then(function (r) { return r.json() })
  .then(function (d) {
    if (d && typeof d.scale === 'number' && d.scale >= MIN_SCALE - 0.1 && d.scale <= MAX_SCALE + 0.1) {
      state.scale = d.scale
      root.style.setProperty('--phoebe-scale', String(d.scale))
      scaleInput.value = String(d.scale)
      scaleNumber.value = String(scaleToDisplay(d.scale))
      settle()
    }
    if (d && typeof d.vol === 'number') {
      soundVol = d.vol
      soundOn = soundVol > 0
      volInput.value = String(soundVol)
      volPct.textContent = Math.round(soundVol * 100) + '%'
      setPoolVolume(soundVol)
    }
    if (d && typeof d.apiKey === 'string') {
      storedApiKey = d.apiKey
      apiKeyInput.value = d.apiKey
    }
    updateApiKeyHint()
    refresh(false)
  })
  .catch(function () { refresh(false) })
setInterval(function () { refresh(false) }, REFRESH_MS)
})()`


const name = 'phoebe-chubi-widget'
const inject = ['webServer', 'credentials']

function apply(ctx) {
    let imageBytes = null
    let balanceCache = null
    let balanceInFlight = null

    function loadImage() {
      if (imageBytes) return imageBytes
      for (const p of IMAGE_CANDIDATES) {
        try {
          const bytes = fs.readFileSync(p)
          if (bytes && bytes.length > 0) {
            imageBytes = bytes
            return bytes
          }
        } catch (err) {}
      }
      throw new Error('character image not found')
    }

    async function fetchBalance(keyOverride) {
      // 优先使用挂件菜单里输入的 API Key；没有则回退 DSH 凭据服务里的 DEEPSEEK_API_KEY
      let key = String(keyOverride || '').trim().replace(/^Bearer\s+/i, '')
      if (!key) {
        let cred
        try {
          cred = await ctx.credentials.resolve('DEEPSEEK_API_KEY')
        } catch (err) {
          return { ok: false, code: 'NO_KEY', error: '凭据读取失败: ' + String((err && err.message) || err).slice(0, 160) }
        }
        if (!cred) {
          return { ok: false, code: 'NO_KEY', error: '未配置 API Key' }
        }
        key = String(cred.value).trim().replace(/^Bearer\s+/i, '')
      }
      if (!key) {
        return { ok: false, code: 'NO_KEY', error: '未配置 API Key' }
      }
      let lastErr = null
      for (let attempt = 0; attempt < 2; attempt++) {
        let res
        try {
          res = await fetch(BALANCE_URL, {
            headers: { Authorization: 'Bearer ' + key },
            signal: AbortSignal.timeout(20000),
          })
        } catch (err) {
          lastErr = err
          if (attempt === 0) await new Promise((r) => setTimeout(r, 500))
          continue
        }
        if (!res.ok) {
          lastErr = new Error('HTTP ' + res.status)
          if (res.status < 500) break
          if (attempt === 0) await new Promise((r) => setTimeout(r, 500))
          continue
        }
        let data
        try {
          data = await res.json()
        } catch (err) {
          return { ok: false, code: 'PARSE', error: '余额接口返回不是合法 JSON' }
        }
        const info = data && Array.isArray(data.balance_infos) ? data.balance_infos[0] : null
        if (!info || info.total_balance === undefined) {
          return { ok: false, code: 'SHAPE', error: '余额接口返回结构异常' }
        }
        return {
          ok: true,
          totalBalance: Number(info.total_balance),
          currency: String(info.currency || 'CNY'),
          updatedAt: new Date().toISOString(),
        }
      }
      const transient = !(lastErr && /^HTTP 4\d\d/.test(lastErr.message))
      return {
        ok: false,
        code: 'HTTP',
        transient: transient,
        error: '余额接口请求失败: ' + String((lastErr && lastErr.message) || lastErr).slice(0, 200),
      }
    }

    async function getBalancePayload() {
      const cfg0 = readSizeConfig() || {}
      return fetchBalance(cfg0.apiKey)
    }

    function getBalance() {
      const now = Date.now()
      if (balanceCache && now - balanceCache.at < BALANCE_TTL_MS) {
        return Promise.resolve(balanceCache.payload)
      }
      if (balanceInFlight) return balanceInFlight
      balanceInFlight = getBalancePayload()
        .then((payload) => {
          if (payload.ok) {
            balanceCache = { at: now, payload }
            return payload
          }
          if (payload.transient && balanceCache) {
            // transient network/API blip: keep serving the last known balance
            return { ...balanceCache.payload, stale: true, error: payload.error }
          }
          if (!payload.transient) console.error('[phoebe-balance]', payload.code, payload.error)
          return payload
        })
        .catch((err) => ({
          ok: false,
          code: 'ERROR',
          error: '余额服务异常: ' + String((err && err.message) || err).slice(0, 200),
        }))
        .finally(() => {
          balanceInFlight = null
        })
      return balanceInFlight
    }

    function readSizeConfig() {
      for (const p of SIZE_FILE_CANDIDATES) {
        try {
          const parsed = JSON.parse(fs.readFileSync(p, 'utf8'))
          if (parsed && typeof parsed.scale === 'number') {
            return {
              scale: parsed.scale,
              sound: parsed.sound !== false,
              vol: typeof parsed.vol === 'number' ? parsed.vol : 0.9,
              apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
            }
          }
        } catch (err) {}
      }
      return null
    }

    function writeSizeConfig(scale, sound, vol, apiKey) {
      const body = JSON.stringify({
        scale: scale,
        sound: sound !== false,
        vol: typeof vol === 'number' ? vol : 0.9,
        apiKey: typeof apiKey === 'string' ? apiKey : '',
        updatedAt: new Date().toISOString(),
      })
      for (const p of SIZE_FILE_CANDIDATES) {
        try {
          fs.writeFileSync(p, body, 'utf8')
          return {
            ok: true,
            scale: scale,
            sound: sound !== false,
            vol: typeof vol === 'number' ? vol : 0.9,
            apiKey: typeof apiKey === 'string' ? apiKey : '',
          }
        } catch (err) {}
      }
      return { ok: false, error: '无法持久化挂件配置' }
    }

    function readBody(req) {
      return new Promise((resolve, reject) => {
        const chunks = []
        let size = 0
        req.on('data', (c) => {
          size += c.length
          if (size > 8192) {
            reject(new Error('body too large'))
            req.destroy()
            return
          }
          chunks.push(c)
        })
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        req.on('error', reject)
      })
    }

    const disposers = []

    disposers.push(ctx.webServer.register({
      kind: 'exact',
      path: '/phoebe/image.png',
      handler: (req, res) => {
        try {
          const bytes = loadImage()
          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-store',
            'Content-Length': String(bytes.length),
          })
          res.end(bytes)
        } catch (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('character image unavailable: ' + String((err && err.message) || err))
        }
      },
    }))

    disposers.push(ctx.webServer.register({
      kind: 'exact',
      path: '/phoebe/balance.json',
      handler: async (req, res) => {
        try {
          const payload = await getBalance()
          res.writeHead(200, JSON_HEADERS)
          res.end(JSON.stringify(payload))
        } catch (err) {
          res.writeHead(200, JSON_HEADERS)
          res.end(JSON.stringify({ ok: false, code: 'ERROR', error: String((err && err.message) || err).slice(0, 200) }))
        }
      },
    }))

    disposers.push(ctx.webServer.register({
      kind: 'exact',
      path: '/phoebe/size.json',
      handler: async (req, res) => {
        if (req.method === 'PUT' || req.method === 'POST') {
          try {
            const body = await readBody(req)
            const parsed = JSON.parse(body)
            const scale = typeof parsed.scale === 'number' ? parsed.scale : null
            if (scale === null) {
              res.writeHead(400, JSON_HEADERS)
              res.end(JSON.stringify({ ok: false, error: 'missing scale' }))
              return
            }
            // API Key 变化时让余额缓存失效，下次请求立即用新 Key 重查
            if (typeof parsed.apiKey === 'string') {
              const old = readSizeConfig()
              if (!old || (old.apiKey || '') !== parsed.apiKey) {
                balanceCache = null
              }
            }
            const cfg0 = readSizeConfig() || {}
            const apiKey = typeof parsed.apiKey === 'string' ? parsed.apiKey : (cfg0.apiKey || '')
            const result = writeSizeConfig(scale, parsed.sound !== false, parsed.vol, apiKey)
            res.writeHead(result.ok ? 200 : 500, JSON_HEADERS)
            res.end(JSON.stringify(result))
          } catch (err) {
            res.writeHead(400, JSON_HEADERS)
            res.end(JSON.stringify({ ok: false, error: String((err && err.message) || err) }))
          }
          return
        }
        res.writeHead(200, JSON_HEADERS)
        res.end(JSON.stringify(readSizeConfig() || {}))
      },
    }))

    function loadSound(name) {
      const file = path.join(PACKAGE_ROOT, 'assets', name + '.mp3')
      try {
        const bytes = fs.readFileSync(file)
        if (bytes && bytes.length > 0) return bytes
      } catch (err) {}
      return null
    }

    disposers.push(ctx.webServer.register({
      kind: 'exact',
      path: '/phoebe/sound.mp3',
      handler: (req, res) => {
        const m = /(?:^|&)name=([^&]+)/.exec(String(req.url).split('?')[1] || '')
        const name = m ? decodeURIComponent(m[1]) : ''
        if (SOUND_NAMES.indexOf(name) === -1) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('sound unavailable')
          return
        }
        const bytes = loadSound(name)
        if (!bytes) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('sound unavailable')
          return
        }
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-store',
          'Content-Length': String(bytes.length),
        })
        res.end(bytes)
      },
    }))

    disposers.push(ctx.webServer.register({
      kind: 'exact',
      path: '/phoebe/widget.js',
      handler: (req, res) => {
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-store',
        })
        res.end(WIDGET_JS)
      },
    }))

    disposers.push(ctx.webServer.tapIndex((html) => {
      if (html.indexOf('/phoebe/widget.js') !== -1) return html
      const tag = '<script defer src="/phoebe/widget.js"></script>'
      if (html.indexOf('</body>') !== -1) return html.replace('</body>', tag + '</body>')
      return html + tag
    }))

    ctx.effect(() => () => {
      for (const d of disposers) {
        try { d() } catch (err) {}
      }
    })
}

export { name, inject, apply }
