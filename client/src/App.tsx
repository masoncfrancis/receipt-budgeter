import './App.css'
import ReceiptUploader from './components/ReceiptUploader'

function App() {
  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Budget App — Add Receipt</h1>
        <p className="subtitle">Upload a receipt image and edit the parsed items before saving.</p>
      </header>

      <main>
        <ReceiptUploader />
      </main>
    </div>
  )
}

export default App
