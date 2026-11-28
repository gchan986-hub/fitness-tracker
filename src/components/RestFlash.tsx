interface Props {
  onClose: () => void
}

/** Full-screen "rest over" flash. Flashing is done in CSS (5 × 1 s); callers decide how long it stays up. */
export function RestFlash({ onClose }: Props) {
  return (
    <button type="button" className="rest-flash" aria-label="Rest over. Tap to continue" onClick={onClose}>
      <span className="rest-flash-title">REST OVER</span>
      <span className="rest-flash-sub">Next set · tap anywhere</span>
    </button>
  )
}
