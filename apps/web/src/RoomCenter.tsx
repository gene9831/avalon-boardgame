import type {
  ComponentPropsWithoutRef,
  ReactNode,
} from 'react'

const centerWidthByDensity = {
  compact: 'w-[152px]',
  regular: 'w-[168px]',
  wide: 'w-[min(20rem,100%)]',
} as const

export interface RoomCenterProps
  extends Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'className'> {
  children: ReactNode
  density?: keyof typeof centerWidthByDensity
}

export function RoomCenter({
  children,
  density = 'regular',
  ...props
}: RoomCenterProps) {
  return (
    <div
      {...props}
      className={`room-center-summary font-avalon-serif shrink-0 text-center ${centerWidthByDensity[density]}`}
    >
      {children}
    </div>
  )
}
