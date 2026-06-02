import { useEffect, useRef, useState } from "react"

const SPEED_OPTIONS = ["slow", "normal", "fast"]
const CONF_OPTIONS = ["hesitant", "neutral", "confident"]

export default function App() {
  const audioRef = useRef(null)

  const API_URL = "https://speechiq-api.paulogabe1.workers.dev"

  // =========================
  // USER (ONLY LOCAL STORAGE USED)
  // =========================
  const [nickname] = useState(() => {
    let n = localStorage.getItem("speechiq-nickname")

    if (!n) {
      n = prompt("Enter nickname")
      n = (n || "").trim().toLowerCase()
      localStorage.setItem("speechiq-nickname", n)
    }

    return n
  })

  // =========================
  // DATA
  // =========================
  const [audioFiles, setAudioFiles] = useState([])
  const [index, setIndex] = useState(0)

  const [speed, setSpeed] = useState("")
  const [confidence, setConfidence] = useState("")

  const [progress, setProgress] = useState(0)
  const [completedFiles, setCompletedFiles] = useState(new Set())

  const current = audioFiles[index]

  // =========================
  // LOAD MANIFEST
  // =========================
  useEffect(() => {
    fetch("/manifest.json")
      .then(res => res.json())
      .then(data => setAudioFiles(data))
  }, [])

  // =========================
  // LOAD USER STATE FROM DB
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

      if (!data.success) return

      setProgress(data.progress || 0)
      setCompletedFiles(new Set(data.completed_files || []))

    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadState()
  }, [nickname])

  // =========================
  // RESET DRAFT ON CLIP CHANGE
  // =========================
  useEffect(() => {
    setSpeed("")
    setConfidence("")
  }, [index, current])

  // =========================
  // HELPERS
  // =========================
  const isComplete = (file) => {
    return completedFiles.has(file.original || file.filename)
  }

  const progressValue = audioFiles.length
    ? (progress / audioFiles.length) * 100
    : 0

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

      if (!data.success) {
        console.error(data)
        return
      }

      await loadState()

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

  // =========================
  // UI uses unchanged below
  // =========================

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