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

  const addLabel = async () => {
    if (newLabel && !labels.includes(newLabel)) {
      const updatedLabels = [...labels, newLabel]
      setLabels(updatedLabels)
      await storage.set("labels", JSON.stringify(updatedLabels))
      setNewLabel("")
    }
  }

  const removeLabel = async (label: string) => {
    const updatedLabels = labels.filter(l => l !== label)
    setLabels(updatedLabels)
    await storage.set("labels", JSON.stringify(updatedLabels))
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Étiquettes de classification</h2>
      <div>
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Nouvelle étiquette"
        />
        <button onClick={addLabel}>Ajouter</button>
      </div>
      <ul>
        {labels.map((label) => (
          <li key={label}>
            {label}
            <button onClick={() => removeLabel(label)}>Supprimer</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default IndexPopup
