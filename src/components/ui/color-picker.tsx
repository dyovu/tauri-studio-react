"use client"

import { useRef } from "react"

type Props = {
  currentColor: string,
  updateColor: (color: string) => void
}

export default function ColorPicker({ currentColor, updateColor }: Props) {

  const inputRef = useRef<HTMLInputElement>(null)

  const handleCircleClick = () => {
    // Programmatically click the hidden color input
    inputRef.current?.click()
  }

  return (
    <div className="relative inline-block">
      {/* Circular color display */}
      <button
        className="focus:outline-none fo w-8 h-8 border-2 rounded-md border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-shadow duration-200"
        style={{ backgroundColor: currentColor }}
        onClick={handleCircleClick}
        aria-label="カラーを選択"
      />

      {/* Hidden native color picker */}
      <input
        ref={inputRef}
        className="sr-only" // Visually hidden but accessible
        type="color"
        value={currentColor}
        onChange={(e) => updateColor(e.target.value)}
      />
    </div>
  )
}

