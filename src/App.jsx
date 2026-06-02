import { useEffect, useRef, useState } from "react"

const SPEED_OPTIONS = ["slow", "normal", "fast"]
const CONF_OPTIONS = ["hesitant", "neutral", "confident"]

export default function App() {
  const [nickname] = useState(() => {
    let n = localStorage.getItem("speechiq-nickname")

    if (!n) {
      n = prompt("Enter nickname")
      n = n.trim().toLowerCase()
      localStorage.setItem("speechiq-nickname", n)
    }

    return n
  })

  const API_URL = "https://speechiq-api.paulogabe1.workers.dev"

  const audioRef = useRef(null)

  const [audioFiles, setAudioFiles] = useState([])
  const [index, setIndex] = useState(() => {
    return Number(localStorage.getItem("speechiq-index")) || 0
  })

  const [labels, setLabels] = useState(() => {
    return JSON.parse(localStorage.getItem("speechiq-labels") || "{}")
  })

  const [speed, setSpeed] = useState("")
  const [confidence, setConfidence] = useState("")

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
  // LOAD EXISTING LABEL
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
  // SAVE STATE
  // =========================
  useEffect(() => {
    localStorage.setItem("speechiq-index", index)
  }, [index])

  useEffect(() => {
    localStorage.setItem("speechiq-labels", JSON.stringify(labels))
  }, [labels])

  // =========================
  // KEYBOARD SHORTCUTS
  // =========================
  useEffect(() => {
    const handler = (e) => {
      if (document.activeElement.tagName === "INPUT") return

      switch (e.key.toLowerCase()) {
        case "s":
          setSpeed("slow")
          break
        case "n":
          setSpeed("normal")
          break
        case "f":
          setSpeed("fast")
          break

        case "h":
          setConfidence("hesitant")
          break
        case "m":
          setConfidence("neutral")
          break
        case "c":
          setConfidence("confident")
          break

        case "r":
          replay()
          break

        case "enter":
          submit()
          break
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [speed, confidence, index, labels])

  // =========================
  // ACTIONS
  // =========================
  const replay = () => {
    if (!audioRef.current) return
    audioRef.current.currentTime = 0
    audioRef.current.play()
  }

  const saveCurrentLabel = (
    newSpeed = speed,
    newConfidence = confidence
  ) => {
    if (!current) return

    const updated = { ...labels }

    // completely empty -> remove entry
    if (!newSpeed && !newConfidence) {
      delete updated[current.filename]
    } else {
      updated[current.filename] = {
        speed: newSpeed,
        confidence: newConfidence
      }
    }

    setLabels(updated)
  }

  const getLabelState = (file) => {
    const label = labels[file.filename]

    if (!label) return "empty"

    const hasSpeed = !!label.speed
    const hasConfidence = !!label.confidence

    if (hasSpeed && hasConfidence) return "complete"

    return "partial"
  }

  const submit = async () => {

    if (!speed || !confidence) {
      alert("Warning: clip is incomplete")
    }

    if (!current) return

    // 1. Save locally (keep your system working offline)
    saveCurrentLabel(speed, confidence)

    try {
      // 2. Send to backend
      await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nickname,
          original_file: current.original || current.filename,
          speed,
          confidence
        })
      })
    } catch (err) {
      console.error("Backend save failed:", err)
    }

    // 3. Move to next clip
    if (index < audioFiles.length - 1) {
      setIndex(index + 1)
    }
  }

  const jumpTo = (i) => {
    if (i >= 0 && i < audioFiles.length) {
      setIndex(i)
    }
  }

  const exportCSV = () => {
    const rows = [["original_file", "speed", "confidence"]]

    Object.entries(labels).forEach(([file, val]) => {
      const meta = audioFiles.find(f => f.filename === file)

      rows.push([
        meta?.original || file,
        val.speed,
        val.confidence
      ])
    })

    const csv = rows.map(r => r.join(",")).join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = "speechiq_labels.csv"
    a.click()

    URL.revokeObjectURL(url)
  }

  const progress = Object.keys(labels).length

  // =========================
  // UI
  // =========================
  return (
    <div style={styles.page}>
      <div style={styles.card}>

        <h2>SpeechIQ Labeler</h2>

        {/* NAVIGATOR */}
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
                  i === index
                    ? "2px solid white"
                    : "2px solid transparent"
              }}
              title={f.filename}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <p>
          Clip {index + 1} / {audioFiles.length || 0}
        </p>

        {/* PROGRESS */}
        <div style={styles.barOuter}>
          <div
            style={{
              ...styles.barInner,
              width: `${audioFiles.length
                ? (progress / audioFiles.length) * 100
                : 0}%`
            }}
          />
        </div>

        {/* AUDIO */}
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

        {/* SPEED */}
        <div style={styles.optionGroup}>
          <h4>Speed</h4>

          <div style={styles.row}>
            {SPEED_OPTIONS.map(o => (
              <button
                key={o}
                onClick={() => {
                  const newValue = speed === o ? "" : o

                  setSpeed(newValue)
                  saveCurrentLabel(newValue, confidence)
                }}
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
                onClick={() => {
                  const newValue = confidence === o ? "" : o

                  setConfidence(newValue)
                  saveCurrentLabel(speed, newValue)
                }}
                style={confidence === o ? styles.active : styles.btn}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

      </div>

        {/* CONTROLS */}
        <div style={styles.controls}>
          <button onClick={replay} style={styles.secondary}>
            Replay (R)
          </button>

          <button onClick={submit} style={styles.primary}>
            Submit (Enter)
          </button>
        </div>

        <button onClick={exportCSV} style={styles.export}>
          Export CSV
        </button>

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