import { useState } from 'react'
import type { ReceiptItem } from '../types'
import { MOCK_ITEMS, MOCK_CATEGORIES } from '../types'

function mockApiSendImage(file: File): Promise<ReceiptItem[]> {
  // simulate network latency; use file to avoid TS unused variable error
  // (in real implementation we'd send the file in a multipart/form request)
  // keep a tiny log for debugging
  // eslint-disable-next-line no-console
  console.log('mockApiSendImage called for', file.name)
  return new Promise((res) => setTimeout(() => res(MOCK_ITEMS), 700))
}

export default function ReceiptUploader() {
  const [file, setFile] = useState<File | null>(null)
  const [items, setItems] = useState<ReceiptItem[] | null>(null)
  const [loading, setLoading] = useState(false)

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    setFile(f)
    setItems(null)
  }

  const upload = async () => {
    if (!file) return
    setLoading(true)
    try {
      // Here we would POST the image to the REST API
      const parsed = await mockApiSendImage(file)
      setItems(parsed)
    } finally {
      setLoading(false)
    }
  }

  const updateItem = (idx: number, patch: Partial<ReceiptItem>) => {
    if (!items) return
    const copy = items.slice()
    copy[idx] = { ...copy[idx], ...patch }
    setItems(copy)
  }

  // UI flow:
  // - initial state: show only upload controls
  // - after scan: show editable items and Save
  const showResults = !!items

  return (
    <div className="uploader-root">
      {!showResults ? (
        <div className="uploader-card single">
          <div className="upload-column">
            <label className="file-drop" aria-label="Select receipt image">
              <input aria-hidden type="file" accept="image/*" onChange={onFileChange} />
              <div className="drop-text">Drop or click to select your receipt</div>
              <div className="drop-sub">Supported: JPG, PNG — Max 10MB</div>
            </label>

            <div className="preview-and-actions">
              <div className="file-box">
                <div className="file-info">
                  <div className="file-name">{file ? file.name : 'No file selected'}</div>
                  <div className="file-sub">We’ll look at your receipt and suggest items to add — you can edit them before saving.</div>
                </div>
              </div>

              <div className="actions">
                <button onClick={upload} disabled={!file || loading} className="primary">
                  {loading ? 'Scanning...' : 'Scan receipt'}
                </button>

                {file && (
                  <div className="file-meta">
                    <button className="ghost" onClick={() => { setFile(null); setItems(null) }}>
                      Choose another
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="uploader-card">
          <div className="upload-column">
            <div className="summary-top">
              <div className="file-name">{file ? file.name : ''}</div>
              <div className="file-sub">Below are the items we found — edit any field you want, then save.</div>
            </div>
            <div className="actions" style={{ marginTop: 12 }}>
              <button className="ghost" onClick={() => { setItems(null); }}>
                Back
              </button>
            </div>
          </div>

          <div className="items-column">
            <h2>Items to add</h2>
            <div className="items-list">
              {items!.map((it, i) => (
                <div key={i} className="item-row">
                  <div className="item-name">{it.name}</div>

                  <label className="item-field">
                    <div className="field-label">Kind</div>
                    <input
                      type="text"
                      value={it.kind}
                      onChange={(e) => updateItem(i, { kind: e.target.value })}
                    />
                  </label>

                  <label className="item-field">
                    <div className="field-label">Category</div>
                    <select
                      value={it.budgetCategory}
                      onChange={(e) => updateItem(i, { budgetCategory: e.target.value })}
                    >
                      {MOCK_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}

              <div className="save-row">
                <button className="primary" onClick={() => alert('Save mock: ' + JSON.stringify(items, null, 2))}>
                  Add items to budget
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
