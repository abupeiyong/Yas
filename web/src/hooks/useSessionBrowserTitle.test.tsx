import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Session } from '@/types/api'
import { useSessionBrowserTitle } from './useSessionBrowserTitle'

function makeSession(metadata: Session['metadata']): Session {
    return {
        id: '1234567890abcdef',
        active: true,
        thinking: false,
        activeAt: 0,
        updatedAt: 0,
        metadata,
    } as Session
}

describe('useSessionBrowserTitle', () => {
    it('tracks session title updates and restores the app title on unmount', () => {
        document.title = 'Yas'
        const initialSession = makeSession({
            path: '/work/hapi',
            host: 'localhost',
            summary: { text: 'Initial summary', updatedAt: 1 },
        })

        const { rerender, unmount } = renderHook(
            ({ session }) => useSessionBrowserTitle(session),
            { initialProps: { session: initialSession } },
        )

        expect(document.title).toBe('Initial summary - Yas')

        rerender({
            session: makeSession({
                ...initialSession.metadata!,
                name: 'Renamed session',
            }),
        })

        expect(document.title).toBe('Renamed session - Yas')

        unmount()
        expect(document.title).toBe('Yas')
    })

    it('uses the app title while loading and the shared session fallbacks when titles are missing', () => {
        document.title = 'Stale session - Yas'

        const { rerender } = renderHook(
            ({ session }: { session: Session | null }) => useSessionBrowserTitle(session),
            { initialProps: { session: null as Session | null } },
        )

        expect(document.title).toBe('Yas')

        rerender({
            session: makeSession({ path: '/work/hapi', host: 'localhost' }),
        })
        expect(document.title).toBe('hapi - Yas')

        rerender({ session: makeSession(null) })
        expect(document.title).toBe('12345678 - Yas')
    })
})
