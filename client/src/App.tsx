import './App.css'
import ReceiptForm from './components/ReceiptForm'

function App() {
    return (
                <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                    <div className="w-full max-w-md">
                        <div className="text-center mb-6">
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Add Receipt</h1>
                            <p className="text-sm text-gray-300 mt-2">Upload a receipt image to extract items and add them to your budget.</p>
                        </div>

                        <div className="space-y-4">
                            <ReceiptForm />
                        </div>
                    </div>
                </div>
    )
}

export default App
