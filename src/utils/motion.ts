/** Shared timing keeps navigation, controls, and overlays feeling consistent. */
export const easeOut = [0.22, 1, 0.36, 1] as const
export const pageTransition = { duration: 0.24, ease: easeOut }
export const selectionSpring = { type: 'spring' as const, stiffness: 440, damping: 36, mass: 0.8 }
export const sheetSpring = { type: 'spring' as const, stiffness: 400, damping: 40, mass: 0.9 }
