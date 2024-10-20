import { useState, useEffect } from "react"
import { Storage } from "@plasmohq/storage"

const storage = new Storage()

function IndexPopup() {
  const [labels, setLabels] = useState<string[]>([])
  const [newLabel, setNewLabel] = useState("")

  useEffect(() => {
    loadLabels()
  }, [])

  const loadLabels = async () => {
    const storedLabels = await storage.get("labels")
    if (storedLabels) {
      setLabels(JSON.parse(storedLabels))
    }
  }

  const reloadCurrentTab = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab.id) {
      chrome.tabs.reload(tab.id)
    }
  }

  const addLabel = async () => {
    if (newLabel && !labels.includes(newLabel)) {
      const updatedLabels = [...labels, newLabel]
      setLabels(updatedLabels)
      await storage.set("labels", JSON.stringify(updatedLabels))
      setNewLabel("")
      await reloadCurrentTab()
    }
  }

  const removeLabel = async (label: string) => {
    const updatedLabels = labels.filter(l => l !== label)
    setLabels(updatedLabels)
    await storage.set("labels", JSON.stringify(updatedLabels))
    await reloadCurrentTab()
  }

  return (
    <div className="container">
      <h2 className="title">Classification Labels</h2>
      <div className="inputContainer">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="New label"
          className="input"
        />
        <button onClick={addLabel} className="button">Add</button>
      </div>
      <ul className="labelList">
        {labels.map((label) => (
          <li key={label} className="labelItem">
            <span>{label}</span>
            <button onClick={() => removeLabel(label)} className="removeButton">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

const styles = `
  .container {
    font-family: Arial, sans-serif;
    max-width: 400px;
    margin: 0 auto;
    padding: 20px;
    background-color: #f5f5f5;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  .title {
    color: #333;
    font-size: 24px;
    margin-bottom: 20px;
    text-align: center;
  }
  .inputContainer {
    display: flex;
    margin-bottom: 20px;
  }
  .input {
    flex-grow: 1;
    padding: 10px;
    font-size: 16px;
    border: 1px solid #ddd;
    border-radius: 4px 0 0 4px;
  }
  .button {
    padding: 10px 20px;
    font-size: 16px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 0 4px 4px 0;
    cursor: pointer;
    transition: background-color 0.3s;
  }
  .button:hover {
    background-color: #45a049;
  }
  .labelList {
    list-style-type: none;
    padding: 0;
  }
  .labelItem {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: white;
    margin-bottom: 10px;
    padding: 10px;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  .removeButton {
    background: none;
    border: none;
    cursor: pointer;
    color: #ff4d4d;
    transition: color 0.3s;
  }
  .removeButton:hover {
    color: #ff1a1a;
  }
`

export default function PlasmoOverlay() {
  return (
    <>
      <IndexPopup />
      <style>{styles}</style>
    </>
  )
}
