import { forwardRef, useId, type ReactNode } from 'react'
import { AnimatePresence, LayoutGroup, motion, useIsPresent, useReducedMotion } from 'framer-motion'
import { easeOut, pageTransition } from '../../utils/motion'

/** Overlap short exits with the next screen so navigation never waits on a fade. */
export const ScreenTransition = forwardRef<HTMLDivElement, { children: ReactNode; direction?: number; name: string }>(
  function ScreenTransition({ children, direction = 1, name }, ref) {
    const reducedMotion = useReducedMotion()
    const isPresent = useIsPresent()
    const layoutId = useId()

    return (
      <motion.div
        ref={ref}
        className="w-full"
        data-screen={name}
        aria-hidden={isPresent ? undefined : true}
        {...(isPresent ? {} : { inert: '' })}
        style={{ pointerEvents: isPresent ? 'auto' : 'none' }}
        custom={direction}
        initial="enter"
        animate="visible"
        exit="exit"
        variants={{
          enter: (travel: number) => ({ opacity: 0, x: reducedMotion ? 0 : travel * 12 }),
          visible: { opacity: 1, x: 0, transition: reducedMotion ? { duration: 0.1 } : pageTransition },
          exit: (travel: number) => ({ opacity: 0, x: reducedMotion ? 0 : travel * -8, transition: { duration: reducedMotion ? 0.1 : 0.12, ease: easeOut } }),
        }}
      >
        <LayoutGroup id={layoutId}>
          {/* The page owns its exit. Internal layout animations must not delay
              unmounting when tabs change rapidly. */}
          <AnimatePresence initial={false} propagate={false}>
            <div key="content">{children}</div>
          </AnimatePresence>
        </LayoutGroup>
      </motion.div>
    )
  },
)
