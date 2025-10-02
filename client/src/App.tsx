import './App.css'
import ReceiptForm from './components/ReceiptForm'

function App() {
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

export default App
