import './App.css'
import ReceiptForm from './components/ReceiptForm'
import LoadingScreen from './components/LoadingScreen'
import LoginLanding from './components/LoginLanding'
import { OidcProvider, useOidc } from './oidc'
import { useEffect, useState } from 'react'
import { getOidc } from './oidc'

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

    // ensure OIDC has initialized before we render the rest of the app
    const [oidcReady, setOidcReady] = useState(false)
    useEffect(() => {
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
