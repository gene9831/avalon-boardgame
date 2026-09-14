import type { Role } from '@avalon/game'

export interface RoleArtworkSource {
  height: number
  slug: string
  width: number
}

export const ROLE_ARTWORK: Readonly<Record<Role, RoleArtworkSource>> = {
  assassin: { height: 1051, slug: 'assassin', width: 674 },
  loyal_servant: { height: 1010, slug: 'loyal-servant', width: 674 },
  merlin: { height: 1127, slug: 'merlin', width: 752 },
  minion: { height: 1010, slug: 'minion', width: 674 },
  morgana: { height: 1127, slug: 'morgana', width: 752 },
  percival: { height: 1127, slug: 'percival', width: 752 },
}

export function getRoleArtworkSourceSet(source: RoleArtworkSource) {
  return [320, 480, source.width]
    .map((width) => `/images/roles/${source.slug}-${width}.webp ${width}w`)
    .join(', ')
}
