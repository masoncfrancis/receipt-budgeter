import './App.css'
import ReceiptForm from './components/ReceiptForm'
import LoadingScreen from './components/LoadingScreen'
import LoginLanding from './components/LoginLanding'
import { OidcProvider, useOidc } from './oidc'

function InnerApp() {
    // useOidc typically exposes `isUserLoggedIn`. Rely on that directly.
    // Loading/initialization UI is provided via OidcProvider's `fallback`.
    const { isUserLoggedIn } = useOidc()

    return isUserLoggedIn ? <ReceiptForm /> : <LoginLanding />
}

function App() {
    return (
        <OidcProvider fallback={<LoadingScreen />}>
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="space-y-4">
                        <InnerApp />
                    </div>
                </div>
            </div>
        </OidcProvider>
    )
}

export default App
