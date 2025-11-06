import './App.css'
import ReceiptForm from './components/ReceiptForm'
import LoadingScreen from './components/LoadingScreen'
import LoginLanding from './components/LoginLanding'
import { OidcProvider, useOidc } from './oidc'
import { useEffect, useState } from 'react'
import { getOidc } from './oidc'
// Vite environment flag to allow anonymous (no-login) mode.
// Set VITE_ALLOW_ANONYMOUS=1 or VITE_ALLOW_ANONYMOUS=true to enable.
const VITE_ALLOW_ANONYMOUS =
    typeof import.meta !== 'undefined' &&
    Boolean(
        (import.meta as any).env?.VITE_ALLOW_ANONYMOUS === '1' ||
            (import.meta as any).env?.VITE_ALLOW_ANONYMOUS === 'true'
    )

function InnerApp() {
    // useOidc typically exposes `isUserLoggedIn`. Rely on that directly.
    // Loading/initialization UI is provided via OidcProvider's `fallback`.
    const { isUserLoggedIn } = useOidc()

    return isUserLoggedIn ? <ReceiptForm /> : <LoginLanding />
}

function App() {
    // diagnostic: log the current URL on mount (helps debug callback redirects)
    useEffect(() => {
        console.log('[App] location:', location.href)
    }, [])

    // If anonymous mode is enabled we skip OIDC initialization entirely.
    const [oidcReady, setOidcReady] = useState(false)
    useEffect(() => {
        if (VITE_ALLOW_ANONYMOUS) {
            console.log('[App] anonymous mode enabled; skipping OIDC')
            setOidcReady(true)
            return
        }
        let mounted = true
        ;(async () => {
            try {
                const oidc = await getOidc()
                console.log('[App] oidc ready, isUserLoggedIn=', oidc.isUserLoggedIn)
                if (mounted) setOidcReady(true)
            } catch (err) {
                console.error('[App] getOidc() failed', err)
                if (mounted) alert('OIDC initialization error (see console)')
            }
        })()
        return () => { mounted = false }
    }, [])

    // If anonymous mode is enabled, render the app without the OIDC provider
    if (VITE_ALLOW_ANONYMOUS) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="space-y-4">
                        <ReceiptForm />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <OidcProvider fallback={<LoadingScreen />}>
            {oidcReady ? (
                <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                    <div className="w-full max-w-md">
                        <div className="space-y-4">
                            <InnerApp />
                        </div>
                    </div>
                </div>
            ) : (
                // while waiting for getOidc, keep showing the provider fallback
                <></>
            )}
        </OidcProvider>
    )
}

export default App
