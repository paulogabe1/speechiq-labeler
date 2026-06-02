import { useEffect, useRef, useState } from "react"

const SPEED_OPTIONS = ["slow", "normal", "fast"]
const CONF_OPTIONS = ["hesitant", "neutral", "confident"]

export default function App() {
  const audioRef = useRef(null)

  const API_URL = "https://speechiq-api.paulogabe1.workers.dev"

  // =========================
  // USER
  // =========================
  const [nickname] = useState(() => {
    let n = localStorage.getItem("speechiq-nickname")

    if (!n) {
      n = prompt("Enter nickname")
      n = n.trim().toLowerCase()
      localStorage.setItem("speechiq-nickname", n)
    }

    return n
  })

  const [audioFiles, setAudioFiles] = useState([])
  const [index, setIndex] = useState(0)

  const [labels, setLabels] = useState(() => {
    return JSON.parse(localStorage.getItem("speechiq-labels") || "{}")
  })

  const [speed, setSpeed] = useState("")
  const [confidence, setConfidence] = useState("")

  const [progress, setProgress] = useState(0)

  // =========================
  // LOAD MANIFEST
  // =========================
  useEffect(() => {
    fetch("/manifest.json")
      .then(res => res.json())
      .then(data => setAudioFiles(data))
  }, [])

  const current = audioFiles[index]

  // =========================
  // LOAD LABEL FROM CACHE
  // =========================
  useEffect(() => {
    if (!current) return

    const existing = labels[current.filename]

    if (existing) {
      setSpeed(existing.speed || "")
      setConfidence(existing.confidence || "")
    } else {
      setSpeed("")
      setConfidence("")
    }
  }, [index, audioFiles])

  // =========================
  // FETCH PROGRESS FROM DB (NEW)
  // =========================
  const fetchProgress = async () => {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "progress",
          nickname
        })
      })

      const data = await res.json()
      setProgress(data.progress || 0)

    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchProgress()
  }, [nickname])

  // =========================
  // SAVE LOCAL LABEL (UNCHANGED)
  // =========================
  const saveCurrentLabel = (newSpeed = speed, newConfidence = confidence) => {
    if (!current) return

    const updated = { ...labels }

    if (!newSpeed && !newConfidence) {
      delete updated[current.filename]
    } else {
      updated[current.filename] = {
        speed: newSpeed,
        confidence: newConfidence
      }
    }

    setLabels(updated)
    localStorage.setItem("speechiq-labels", JSON.stringify(updated))
  }

  // =========================
  // ACTIONS
  // =========================
  const replay = () => {
    if (!audioRef.current) return
    audioRef.current.currentTime = 0
    audioRef.current.play()
  }

  const submit = async () => {
    if (!current) return

    if (!speed || !confidence) {
      alert("Warning: clip is incomplete")
    }

    saveCurrentLabel(speed, confidence)

    try {
      await fetch(API_URL, {
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

      fetchProgress()

    } catch (err) {
      console.error(err)
    }

    if (index < audioFiles.length - 1) {
      setIndex(index + 1)
    }
  }

  const jumpTo = (i) => {
    if (i >= 0 && i < audioFiles.length) {
      setIndex(i)
    }
  }

  const getLabelState = (file) => {
    const label = labels[file.filename]

    if (!label) return "empty"
    if (label.speed && label.confidence) return "complete"
    return "partial"
  }

  const progressValue = audioFiles.length
    ? (progress / audioFiles.length) * 100
    : 0

  // =========================
  // UI (UNCHANGED)
  // =========================
  return (
    <div style={styles.page}>
      <div style={styles.card}>

        <h2>SpeechIQ Labeler</h2>

        <p>User: {nickname}</p>

        <button
          onClick={() => {
            localStorage.removeItem("speechiq-nickname")
            window.location.reload()
          }}
        >
          Switch User
        </button>

        <div style={styles.navigator}>
          {audioFiles.map((f, i) => (
            <button
              key={f.filename}
              onClick={() => jumpTo(i)}
              style={{
                ...styles.navBtn,
                background:
                  getLabelState(f) === "complete"
                    ? "#00d084"
                    : getLabelState(f) === "partial"
                    ? "#e6b800"
                    : "#333",
                border:
                  i === index ? "2px solid white" : "2px solid transparent"
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <p>
          Clip {index + 1} / {audioFiles.length || 0}
        </p>

        <div style={styles.barOuter}>
          <div
            style={{
              ...styles.barInner,
              width: `${progressValue}%`
            }}
          />
        </div>

        {current && (
          <>
            <h3>
              {current.original.replace(".flac", "")}
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

        <div style={styles.labelPanel}>

          <div style={styles.optionGroup}>
            <h4>Speed</h4>
            <div style={styles.row}>
              {SPEED_OPTIONS.map(o => (
                <button
                  key={o}
                  onClick={() => {
                    const v = speed === o ? "" : o
                    setSpeed(v)
                    saveCurrentLabel(v, confidence)
                  }}
                  style={speed === o ? styles.active : styles.btn}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.optionGroup}>
            <h4>Confidence</h4>
            <div style={styles.row}>
              {CONF_OPTIONS.map(o => (
                <button
                  key={o}
                  onClick={() => {
                    const v = confidence === o ? "" : o
                    setConfidence(v)
                    saveCurrentLabel(speed, v)
                  }}
                  style={confidence === o ? styles.active : styles.btn}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

        </div>

        <div style={styles.controls}>
          <button onClick={replay} style={styles.secondary}>
            Replay (R)
          </button>

          <button onClick={submit} style={styles.primary}>
            Submit (Enter)
          </button>
        </div>

      </div>
    </div>
  )
}

// =========================
// STYLES
// =========================

const styles = {
  page: {
    minHeight: "100vh",
    background: "#111",
    color: "white",
    display: "flex",
    justifyContent: "center",
    padding: 20,
    fontFamily: "Arial"
  },
  card: {
    width: 850,
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
    borderRadius: 5
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
    borderRadius: 6
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
}