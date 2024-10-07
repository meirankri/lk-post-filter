import React from "react"

interface ClassificationDisplayProps {
  classification: string | null
  error?: string
  container: HTMLElement
}

export const ClassificationDisplay: React.FC<ClassificationDisplayProps> = ({ classification, error, container }) => {
  return (
    <div className="mt-2 p-2 bg-gray-100 rounded">
      {classification ? (
        <>
          <p className="text-sm font-semibold">Classification :</p>
          <p className="text-base">{classification}</p>
        </>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        <p className="text-sm">Chargement...</p>
      )}
    </div>
  )
}

export default ClassificationDisplay