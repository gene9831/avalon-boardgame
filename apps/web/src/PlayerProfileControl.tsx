import { Shuffle, UserRound, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Ref,
} from 'react'

import { PlayerAvatar } from './player-avatars'
import { getPlayerNameValidationError } from './player-name'
import {
  createRandomPlayerProfile,
  PLAYER_AVATAR_IDS,
  type PlayerAvatarID,
  type PlayerProfile,
} from './player-profile'
import { useModalLayer } from './use-modal-layer'

export interface PlayerProfileControlProps {
  locked: boolean
  onSave: (profile: PlayerProfile) => void
  profile: PlayerProfile
}

export function PlayerProfileControl({
  locked,
  onSave,
  profile,
}: PlayerProfileControlProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(profile)
  const [error, setError] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    setError(null)
  }, [])

  useEffect(() => {
    if (!open) setDraft(profile)
  }, [open, profile])

  useModalLayer({ onClose: close, open, panelRef, triggerRef })

  const save = () => {
    const validationError = getPlayerNameValidationError(draft.name)
    if (validationError !== null) {
      setError(validationError)
      return
    }
    onSave(draft)
    close()
  }

  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-label="打开用户中心"
        className="flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-slate-950/55 px-1.5 py-1.5 text-left text-slate-100 transition hover:border-amber-200/50 hover:bg-slate-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        data-profile-locked={locked || undefined}
        onClick={() => setOpen((value) => !value)}
        ref={triggerRef}
        type="button"
      >
        <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border border-amber-200/55 bg-slate-900">
          <PlayerAvatar avatarID={profile.avatarID} className="size-full object-contain p-1" />
        </span>
        <span className="hidden max-w-28 truncate pr-1 text-sm font-semibold sm:block">
          {profile.name}
        </span>
      </button>

      {open && (
        <>
          <button
            aria-label="关闭用户中心"
            className="fixed inset-0 z-[109] cursor-default bg-slate-950/55 sm:bg-transparent"
            onClick={close}
            type="button"
          />
          <PlayerProfilePanel
            draft={draft}
            error={error}
            locked={locked}
            onAvatarChange={(avatarID) => setDraft((current) => ({ ...current, avatarID }))}
            onClose={close}
            onNameChange={(name) => {
              setDraft((current) => ({ ...current, name }))
              setError(null)
            }}
            onRandomize={() => {
              setDraft(createRandomPlayerProfile())
              setError(null)
            }}
            onSave={save}
            panelRef={panelRef}
          />
        </>
      )}
    </div>
  )
}

export function PlayerProfilePanel({
  draft,
  error,
  locked,
  onAvatarChange,
  onClose,
  onNameChange,
  onRandomize,
  onSave,
  panelRef,
}: {
  draft: PlayerProfile
  error: string | null
  locked: boolean
  onAvatarChange: (avatarID: PlayerAvatarID) => void
  onClose: () => void
  onNameChange: (name: string) => void
  onRandomize: () => void
  onSave: () => void
  panelRef?: Ref<HTMLElement>
}) {
  return (
    <section
      aria-label="用户中心"
      aria-modal="true"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[110] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl border border-white/15 bg-slate-950/98 p-5 text-slate-200 shadow-2xl shadow-black/50 sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-[calc(100%+0.65rem)] sm:w-80"
      ref={panelRef}
      role="dialog"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserRound aria-hidden="true" className="size-5 text-amber-200" />
          <h2 className="font-semibold text-white">用户中心</h2>
        </div>
        <button
          aria-label="关闭用户中心"
          className="grid min-h-11 min-w-11 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>

      {locked ? (
        <div className="mt-5">
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200/15 bg-amber-300/[0.06] p-3">
            <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full border border-amber-200/50 bg-slate-900">
              <PlayerAvatar avatarID={draft.avatarID} className="size-full object-contain p-1.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{draft.name}</p>
              <p className="mt-0.5 text-xs text-slate-400">本局资料已锁定</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            退出房间后可修改名称和头像。
          </p>
        </div>
      ) : (
        <>
          <label className="mt-5 block text-sm font-medium text-slate-200">
            显示名称
            <input
              aria-invalid={error !== null}
              className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-white outline-none transition focus:border-amber-300/70 focus:ring-2 focus:ring-amber-300/15"
              maxLength={24}
              name="player-profile-name"
              onChange={(event) => onNameChange(event.target.value)}
              value={draft.name}
            />
          </label>
          {error !== null && <p className="mt-2 text-sm text-rose-200" role="alert">{error}</p>}

          <fieldset className="mt-5">
            <legend className="text-sm font-medium text-slate-200">选择头像</legend>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {PLAYER_AVATAR_IDS.map((avatarID, index) => (
                <button
                  aria-label={`选择头像 ${index + 1}`}
                  aria-pressed={avatarID === draft.avatarID}
                  className={`grid aspect-square place-items-center overflow-hidden rounded-xl border p-1.5 transition ${avatarID === draft.avatarID ? 'border-amber-200 bg-amber-300/15 shadow-lg shadow-amber-300/10' : 'border-white/10 bg-slate-900 hover:border-white/30'}`}
                  data-avatar-option={avatarID}
                  key={avatarID}
                  onClick={() => onAvatarChange(avatarID)}
                  type="button"
                >
                  <PlayerAvatar avatarID={avatarID} className="size-full object-contain" />
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/35 hover:text-white"
              onClick={onRandomize}
              type="button"
            >
              <Shuffle aria-hidden="true" className="size-4" />
              重新随机
            </button>
            <button
              className="min-h-11 rounded-xl bg-amber-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
              onClick={onSave}
              type="button"
            >
              保存资料
            </button>
          </div>
        </>
      )}

      <p className="mt-5 border-t border-white/10 pt-4 text-[0.7rem] leading-5 text-slate-500">
        头像素材：{' '}
        <a
          className="text-slate-400 underline decoration-slate-600 underline-offset-2 hover:text-slate-200"
          href="https://github.com/ImperialOctopus/avalon-printable/tree/master/characters"
          rel="noreferrer"
          target="_blank"
        >
          ImperialOctopus/avalon-printable
        </a>{' '}
        ·{' '}
        <a
          className="text-slate-400 underline decoration-slate-600 underline-offset-2 hover:text-slate-200"
          href="https://creativecommons.org/licenses/by/4.0/"
          rel="noreferrer"
          target="_blank"
        >
          CC BY 4.0
        </a>
      </p>
    </section>
  )
}
