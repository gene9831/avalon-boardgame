import type { LabState } from './url-state'

export type SettingsDialog = Readonly<{
  element: HTMLDialogElement
  update: (state: LabState) => void
}>

type SettingsCallbacks = Readonly<{
  onChange: (patch: Partial<LabState>) => void
  onRotate: () => void
}>

export function createSettingsDialog(
  host: HTMLElement,
  state: LabState,
  callbacks: SettingsCallbacks,
): SettingsDialog {
  host.insertAdjacentHTML('beforeend', `
    <button class="settings-trigger fixed bottom-[max(16px,env(safe-area-inset-bottom))] right-[max(16px,env(safe-area-inset-right))] z-50 grid size-11 place-items-center rounded-full"
      type="button" aria-label="打开布局设置" aria-haspopup="dialog">⚙</button>
    <dialog class="settings-dialog" aria-labelledby="settings-title">
      <form method="dialog" class="settings-form">
        <header><div><p>LAYOUT LAB</p><h2 id="settings-title">预览设置</h2></div><button value="close" aria-label="关闭设置">×</button></header>
        <label class="switch-row"><span><b>使用设备尺寸</b><small>100dvw × 100dvh</small></span><input name="device" type="checkbox" role="switch"></label>
        <div class="simulation-fields">
          <label><span>设备预设</span><select name="preset">
            <option value="390x844">iPhone 390 × 844</option><option value="375x667">紧凑 375 × 667</option>
            <option value="430x932">宽屏 430 × 932</option><option value="768x1024">平板 768 × 1024</option>
          </select></label>
          <div class="dimension-row"><label><span>宽度</span><input name="width" type="number" min="1" inputmode="numeric"></label>
            <button name="rotate" type="button" aria-label="旋转宽高">⇄</button>
            <label><span>高度</span><input name="height" type="number" min="1" inputmode="numeric"></label></div>
        </div>
        <label><span>玩家人数</span><select name="players">${[5, 6, 7, 8, 9, 10].map((count) => `<option>${count}</option>`).join('')}</select></label>
        <label><span>玩家边界最小间距</span><input name="gap" type="number" min="0" step="0.1" inputmode="decimal"></label>
        <div class="avatar-tier-row">
          <label><span>最大头像尺寸</span><input name="maxAvatarSize" type="number" min="36" max="56" step="0.1" inputmode="decimal"></label>
          <label><span>头像递减步长</span><input name="avatarSizeStep" type="number" min="0.1" step="0.1" inputmode="decimal"></label>
        </div>
        <label class="switch-row"><span><b>显示几何边界</b><small>座位、安全区与轨道</small></span><input name="geometry" type="checkbox" role="switch"></label>
      </form>
    </dialog>`)

  const trigger = host.querySelector<HTMLButtonElement>('.settings-trigger')!
  const dialog = host.querySelector<HTMLDialogElement>('.settings-dialog')!
  const form = dialog.querySelector<HTMLFormElement>('form')!
  const device = form.elements.namedItem('device') as HTMLInputElement
  const width = form.elements.namedItem('width') as HTMLInputElement
  const height = form.elements.namedItem('height') as HTMLInputElement
  const players = form.elements.namedItem('players') as HTMLSelectElement
  const gap = form.elements.namedItem('gap') as HTMLInputElement
  const maxAvatarSize = form.elements.namedItem('maxAvatarSize') as HTMLInputElement
  const avatarSizeStep = form.elements.namedItem('avatarSizeStep') as HTMLInputElement
  const geometry = form.elements.namedItem('geometry') as HTMLInputElement
  const preset = form.elements.namedItem('preset') as HTMLSelectElement
  const simulationFields = form.querySelector<HTMLElement>('.simulation-fields')!

  const update = (nextState: LabState): void => {
    device.checked = nextState.viewportMode === 'device'
    width.value = String(nextState.simulatedWidth)
    height.value = String(nextState.simulatedHeight)
    players.value = String(nextState.playerCount)
    gap.value = String(nextState.gap)
    maxAvatarSize.value = String(nextState.maxAvatarSize)
    avatarSizeStep.value = String(nextState.avatarSizeStep)
    geometry.checked = nextState.showGeometry
    const presetValue = `${nextState.simulatedWidth}x${nextState.simulatedHeight}`
    preset.value = Array.from(preset.options).some((option) => option.value === presetValue)
      ? presetValue
      : ''
    simulationFields.hidden = device.checked
  }

  trigger.addEventListener('click', () => {
    dialog.showModal()
    device.focus()
  })
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close()
  })
  dialog.addEventListener('close', () => trigger.focus())
  device.addEventListener('change', () => callbacks.onChange({
    viewportMode: device.checked ? 'device' : 'simulated',
  }))
  preset.addEventListener('change', () => {
    const [simulatedWidth, simulatedHeight] = preset.value.split('x').map(Number)
    callbacks.onChange({ simulatedWidth, simulatedHeight })
  })
  width.addEventListener('change', () => callbacks.onChange({ simulatedWidth: Number(width.value) }))
  height.addEventListener('change', () => callbacks.onChange({ simulatedHeight: Number(height.value) }))
  players.addEventListener('change', () => callbacks.onChange({ playerCount: Number(players.value) }))
  gap.addEventListener('change', () => callbacks.onChange({ gap: Number(gap.value) }))
  maxAvatarSize.addEventListener('change', () => callbacks.onChange({
    maxAvatarSize: Number(maxAvatarSize.value),
  }))
  avatarSizeStep.addEventListener('change', () => callbacks.onChange({
    avatarSizeStep: Number(avatarSizeStep.value),
  }))
  geometry.addEventListener('change', () => callbacks.onChange({ showGeometry: geometry.checked }))
  ;(form.elements.namedItem('rotate') as HTMLButtonElement)
    .addEventListener('click', callbacks.onRotate)

  update(state)
  return { element: dialog, update }
}
