import { useEffect, useRef, useState } from "react"

const SPEED_OPTIONS = ["slow", "normal", "fast"]
const CONF_OPTIONS = ["hesitant", "neutral", "confident"]

const API_URL = "https://YOUR_WORKER_URL.workers.dev"

export default function App() {
  const audioRef = useRef(null)

  // =========================
  // DATA
  // =========================
  const [audioFiles, setAudioFiles] = useState([])
  const [index, setIndex] = useState(0)

  // =========================
  // USER
  // =========================
  const [nickname, setNickname] = useState(() => {
    let n = localStorage.getItem("speechiq-nickname")

    if (!n) {
      n = prompt("Enter nickname")
      n = n.trim().toLowerCase()
      localStorage.setItem("speechiq-nickname", n)
    }

    return n
  })

  // =========================
  // LABEL STATE (local only for current session)
  // =========================
  const [speed, setSpeed] = useState("")
  const [confidence, setConfidence] = useState("")

  // =========================
  // DB STATE
  // =========================
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
  // LOAD LABEL FROM LOCAL CACHE (fallback only)
  // =========================
  useEffect(() => {
    if (!current) return

    const cache = JSON.parse(localStorage.getItem("speechiq-labels") || "{}")
    const existing = cache[current.filename]

    if (existing) {
      setSpeed(existing.speed || "")
      setConfidence(existing.confidence || "")
    } else {
      setSpeed("")
      setConfidence("")
    }
  }, [index, current])

  // =========================
  // FETCH PROGRESS FROM DB
  // =========================
  const fetchProgress = async () => {
    if (!nickname) return

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
      console.error("progress fetch failed", err)
    }
  }

  useEffect(() => {
    fetchProgress()
  }, [nickname])

  // =========================
  // ACTIONS
  // =========================
  const replay = () => {
    if (!audioRef.current) return
    audioRef.current.currentTime = 0
    audioRef.current.play()
  }

  const saveToLocalCache = (file, s, c) => {
    const cache = JSON.parse(localStorage.getItem("speechiq-labels") || "{}")

    cache[file] = { speed: s, confidence: c }

    localStorage.setItem("speechiq-labels", JSON.stringify(cache))
  }

  const submit = async () => {
    if (!current) return

    if (!speed || !confidence) {
      alert("Warning: incomplete label")
    }

    // save locally (instant UX)
    saveToLocalCache(current.filename, speed, confidence)

    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          nickname,
          original_file: current.filename,
          speed,
          confidence
        })
      })

      // refresh progress after submit
      fetchProgress()

    } catch (err) {
      console.error("submit failed", err)
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

  const switchUser = () => {
    localStorage.removeItem("speechiq-nickname")
    window.location.reload()
  }

  const getLabelState = (file) => {
    const cache = JSON.parse(localStorage.getItem("speechiq-labels") || "{}")
    const label = cache[file.filename]

    if (!label) return "empty"

    if (label.speed && label.confidence) return "complete"

    return "partial"
  }

  // =========================
  // UI
  // =========================
  return (
    <div style={styles.page}>
      <div style={styles.card}>

        <h2>SpeechIQ Labeler</h2>

        <p>User: <b>{nickname}</b></p>

        <button onClick={switchUser} style={styles.secondary}>
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
                background:
                  getLabelState(f) === "complete"
                    ? "#00d084"
                    : getLabelState(f) === "partial"
                    ? "#e6b800"
                    : "#333",
                border: i === index ? "2px solid white" : "none"
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <p>
          Progress: {progress} / {audioFiles.length}
        </p>

        <div style={styles.barOuter}>
          <div
            style={{
              ...styles.barInner,
              width: `${audioFiles.length ? (progress / audioFiles.length) * 100 : 0}%`
            }}
          />
        </div>

        {/* AUDIO */}
        {current && (
          <>
            <h3>{current.original.replace(".flac", "")}</h3>

            <audio
              ref={audioRef}
              controls
              src={current.path}
              style={{ width: "100%" }}
            />
          </>
        )}

        {/* SPEED */}
        <div style={styles.optionGroup}>
          <h4>Speed</h4>
          <div style={styles.row}>
            {SPEED_OPTIONS.map(o => (
              <button
                key={o}
                onClick={() => setSpeed(speed === o ? "" : o)}
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
                onClick={() => setConfidence(confidence === o ? "" : o)}
                style={confidence === o ? styles.active : styles.btn}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* CONTROLS */}
        <div style={styles.controls}>
          <button onClick={replay} style={styles.secondary}>
            Replay
          </button>

          <button onClick={submit} style={styles.primary}>
            Submit
          </button>
        </div>

      </div>
    </div>
  )
}

// =========================
// STYLES (unchanged)
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
    color: "white",
    borderRadius: 5,
    cursor: "pointer"
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
    gap: 10
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
    padding: 10,
    background: "#444",
    border: "none",
    color: "white",
    borderRadius: 6,
    marginBottom: 10
  },
  optionGroup: {
    marginTop: 15
  }
}