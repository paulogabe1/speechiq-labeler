import { useEffect, useRef, useState } from "react"

const SPEED_OPTIONS = ["slow", "normal", "fast"]
const CONF_OPTIONS = ["hesitant", "neutral", "confident"]

export default function App() {
  const [showUserModal, setShowUserModal] = useState(false)
  const [tempNickname, setTempNickname] = useState("")

  const audioRef = useRef(null)

  const API_URL = "https://speechiq-api.paulogabe1.workers.dev"

  // =========================
  // USER (ONLY LOCAL STORAGE)
  // =========================
  const [nickname, setNickname] = useState(() => {
    return localStorage.getItem("speechiq-nickname") || ""
  })

  // =========================
  // CORE STATE
  // =========================
  const [audioFiles, setAudioFiles] = useState([])
  const [index, setIndex] = useState(0)

  const [speed, setSpeed] = useState("")
  const [confidence, setConfidence] = useState("")

  const [progress, setProgress] = useState(0)
  const [completedFiles, setCompletedFiles] = useState(new Set())
  const [labelMap, setLabelMap] = useState({})

  const current = audioFiles[index]

  // =========================
  // LOAD MANIFEST
  // =========================
  useEffect(() => {
    if (!nickname) {
      setShowUserModal(true)
    }
  }, [nickname])

  useEffect(() => {
    fetch("/manifest.json")
      .then(r => r.json())
      .then(data => setAudioFiles(Array.isArray(data) ? data : []))
      .catch(err => console.error("manifest load error:", err))
  }, [])

  // =========================
  // LOAD DB STATE
  // =========================
  const loadState = async () => {
    if (!nickname) return

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "state",
          nickname
        })
      })

      const data = await res.json()

      if (!data?.success) return

      setProgress(data.progress || 0)

      setCompletedFiles(new Set(data.completed_files || []))

      setLabelMap(data.labels || {})

    } catch (err) {
      console.error("state load failed:", err)
    }
  }

  useEffect(() => {
    loadState()
  }, [nickname])

  // =========================
  // RESET DRAFT WHEN CHANGING CLIP
  // =========================
  useEffect(() => {
    if (!current) return

    const key = current.original || current.filename
    const existing = labelMap[key]

    if (existing) {
      setSpeed(existing.speed || "")
      setConfidence(existing.confidence || "")
    } else {
      setSpeed("")
      setConfidence("")
    }
  }, [index, current, labelMap])

  // =========================
  // HELPERS
  // =========================
  const confirmUser = () => {
    const clean = tempNickname.trim().toLowerCase()

    if (!clean) return

    setNickname(clean)
    localStorage.setItem("speechiq-nickname", clean)

    setShowUserModal(false)
  }

  const cancelUserChange = () => {
    // if no existing user → force input again
    if (!nickname) return

    setTempNickname("")
    setShowUserModal(false)
  }

  const isComplete = (file) => {
    if (!file) return false
    return completedFiles.has(file.original || file.filename)
  }

  const progressPercent = audioFiles.length
    ? (progress / audioFiles.length) * 100
    : 0

  // =========================
  // AUDIO ACTIONS
  // =========================
  const replay = () => {
    if (!audioRef.current) return
    audioRef.current.currentTime = 0
    audioRef.current.play()
  }

  // =========================
  // SUBMIT
  // =========================
  const submit = async () => {
    if (!current) return

    if (!speed || !confidence) {
      alert("Warning: incomplete label")
    }

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          nickname,
          original_file: current.original || current.filename,
          speed,
          confidence
        })
      })

      const data = await res.json()

      if (!data?.success) {
        console.error("submit failed:", data)
        return
      }

      await loadState()

    } catch (err) {
      console.error("submit error:", err)
    }

    if (index < audioFiles.length - 1) {
      setIndex(i => i + 1)
    }
  }

  const jumpTo = (i) => {
    if (i >= 0 && i < audioFiles.length) {
      setIndex(i)
    }
  }

  // =========================
  // SAFE UI GUARD (prevents blank screen)
  // =========================
  if (!audioFiles.length) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h2>Loading SpeechIQ...</h2>
        </div>
      </div>
    )
  }

  // =========================
  // UI
  // =========================
  return (
    <div style={styles.page}>
      <div style={styles.card}>

        <h2>SpeechIQ Labeler</h2>
        <p>User: {nickname}</p>

        <button
          onClick={() => {
            setTempNickname(nickname)
            setShowUserModal(true)
          }}
          style={styles.switchUser}
        >
          Switch User
        </button>

        {/* NAV */}
        <div style={styles.navigator}>
          {audioFiles.map((f, i) => (
            <button
              key={f.filename}
              onClick={() => jumpTo(i)}
              style={{
                ...styles.navBtn,
                background: isComplete(f) ? "#00d084" : "#333",
                border: i === index ? "2px solid white" : "2px solid transparent"
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <p>
          Clip {index + 1} / {audioFiles.length}
        </p>

        {/* PROGRESS */}
        <div style={styles.barOuter}>
          <div
            style={{
              ...styles.barInner,
              width: `${progressPercent}%`
            }}
          />
        </div>

        {/* AUDIO */}
        {current && (
          <>
            <h3>
              {(current.original || current.filename).replace(".flac", "")}
            </h3>

            <audio
              ref={audioRef}
              controls
              autoPlay
              src={current.path}
              style={{ width: "100%" }}
            />
          </>
        )}

        {/* SPEED */}
        <div style={styles.labelPanel}>
          <div style={styles.optionGroup}>
            <h4>Speed</h4>
            <div style={styles.row}>
              {SPEED_OPTIONS.map(o => (
                <button
                  key={o}
                  onClick={() =>
                    setSpeed(prev => (prev === o ? "" : o))
                  }
                  style={speed === o ? styles.active : styles.btn}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* CONFIDENCE */}
          <div style={styles.optionGroup}>
            <h4>Confidence</h4>
            <div style={styles.row}>
              {CONF_OPTIONS.map(o => (
                <button
                  key={o}
                  onClick={() =>
                    setConfidence(prev => (prev === o ? "" : o))
                  }
                  style={confidence === o ? styles.active : styles.btn}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        <div style={styles.controls}>
          <button onClick={replay} style={styles.secondary}>
            Replay
          </button>

          <button onClick={submit} style={styles.primary}>
            Submit
          </button>
        </div>

      </div>

      {showUserModal && (
        <div
          style={styles.modalOverlay}
          onMouseDown={cancelUserChange}
        >
          <div
            style={styles.modalBox}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 10 }}>Set User</h3>

            <input
              autoFocus
              value={tempNickname}
              onChange={(e) => setTempNickname(e.target.value)}
              placeholder="Enter nickname"
              style={styles.input}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmUser()
              }}
              onFocus={(e) => (e.currentTarget.style.border = "1px solid #00d084")}
              onBlur={(e) => (e.currentTarget.style.border = "1px solid #333")}
            />

            <div style={styles.modalActions}>
              <button onClick={confirmUser} style={styles.primary}>
                Confirm
              </button>

              <button onClick={cancelUserChange} style={styles.secondary}>
                Cancel
              </button>
            </div>

            {!nickname && (
              <p style={{ color: "#ffb347", marginTop: 10, fontSize: 13 }}>
                You must enter a name to continue
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

// =========================
// STYLES
// =========================

const styles = {
  page: {
    minHeight: "60vh",
    //zoom: 1.2,
    background: "#111",
    color: "white",
    display: "flex",
    justifyContent: "center",
    padding: 20,
    fontFamily: "Arial",
  },
  card: {
    //width: 850,
    background: "#1c1c1c",
    padding: 20,
    borderRadius: 12
  },
  navigator: {
    display: "flex",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 15
  },
  navBtn: {
    width: 34,
    height: 34,
    border: "none",
    color: "white",
    cursor: "pointer",
    borderRadius: 5,
    fontSize: 15,
  },
  barOuter: {
    height: 10,
    background: "#333",
    borderRadius: 10,
    marginBottom: 15
  },
  barInner: {
    height: "100%",
    background: "#00d084"
  },
  row: {
    display: "flex",
    gap: 10,
    marginBottom: 10
  },
  btn: {
    padding: 8,
    background: "#333",
    border: "none",
    color: "white",
    borderRadius: 6,
    fontSize: 15,
  },
  active: {
    padding: 8,
    background: "#00d084",
    border: "none",
    color: "black",
    borderRadius: 6
  },
  controls: {
    display: "flex",
    gap: 10,
    marginTop: 15
  },
  primary: {
    flex: 1,
    padding: 10,
    background: "#00d084",
    border: "none",
    borderRadius: 6
  },
  secondary: {
    flex: 1,
    padding: 10,
    background: "#444",
    border: "none",
    color: "white",
    borderRadius: 6
  },
  export: {
    marginTop: 15,
    width: "100%",
    padding: 10,
    background: "#2196f3",
    border: "none",
    borderRadius: 6,
    color: "white"
  },
  labelPanel: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 20,
    marginTop: 20,
    marginBottom: 20
  },

  optionGroup: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  },

  switchUser: {
    marginTop: 10,
    marginBottom: 15,
    padding: "8px 12px",
    background: "#2a2a2a",
    color: "#fff",
    border: "1px solid #444",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    transition: "0.2s",
  },

  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.4)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    zIndex: 9999,
    animation: "fadeIn 0.15s ease-out"
  },

  modalBox: {
    width: 340,
    background: "#1c1c1c",
    padding: 20,
    borderRadius: 12,
    border: "1px solid #333",
    textAlign: "center",
    transform: "scale(0.98)",
    animation: "popIn 0.15s ease-out",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
  },

  input: {
    width: "100%",
    padding: 12,
    marginTop: 10,
    background: "#111",
    border: "1px solid #333",
    color: "white",
    borderRadius: 8,
    boxSizing: "border-box",
    fontSize: 14,
    outline: "none"
  },

    modalActions: {
    display: "flex",
    gap: 10,
    marginTop: 15
  },

  "@keyframes fadeIn": {
    from: { opacity: 0 },
    to: { opacity: 1 }
  },

  "@keyframes popIn": {
    from: {
      transform: "scale(0.95)",
      opacity: 0
    },
    to: {
      transform: "scale(1)",
      opacity: 1
    }
  }
}