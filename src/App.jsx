import { useState } from 'react'

const TOPICS = [
  { id: 'kinematics', label: 'Kinematics', hint: 'multi-phase motion' },
  { id: 'freefall', label: 'Free Fall', hint: 'gravity & projectiles' },
  { id: 'derivatives', label: 'Derivatives', hint: 'limit definition, rules' },
  { id: 'limits', label: 'Limits', hint: 'algebraic & exponential' },
]

const START_DIFFICULTY = 2

export default function App() {
  const [activeTopic, setActiveTopic] = useState(null)
  const [difficulty, setDifficulty] = useState(
    Object.fromEntries(TOPICS.map((t) => [t.id, START_DIFFICULTY]))
  )
  const [problem, setProblem] = useState(null)
  const [answer, setAnswer] = useState('')
  const [work, setWork] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [streak, setStreak] = useState(0)
  const [solved, setSolved] = useState(0)

  async function callTutor(body) {
    const res = await fetch('/api/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || `Request failed (${res.status})`)
    }
    return res.json()
  }

  async function startTopic(topicId) {
    setActiveTopic(topicId)
    setFeedback(null)
    setAnswer('')
    setWork('')
    setErrorMsg(null)
    setLoading(true)
    try {
      const data = await callTutor({
        action: 'new_problem',
        topic: topicId,
        difficulty: difficulty[topicId],
      })
      setProblem(data)
    } catch (err) {
      setErrorMsg(
        'Could not reach the tutor API. Make sure GROQ_API_KEY is set in your deployment (see README).'
      )
    } finally {
      setLoading(false)
    }
  }

  async function nextProblem() {
    if (!activeTopic) return
    setFeedback(null)
    setAnswer('')
    setWork('')
    setLoading(true)
    try {
      const data = await callTutor({
        action: 'new_problem',
        topic: activeTopic,
        difficulty: difficulty[activeTopic],
      })
      setProblem(data)
    } catch (err) {
      setErrorMsg('Could not reach the tutor API.')
    } finally {
      setLoading(false)
    }
  }

  async function submitAnswer(e) {
    e.preventDefault()
    if (!answer.trim() || !problem) return
    setLoading(true)
    setErrorMsg(null)
    try {
      const data = await callTutor({
        action: 'grade',
        topic: activeTopic,
        difficulty: difficulty[activeTopic],
        problem: problem.problem,
        studentAnswer: answer,
        studentWork: work,
      })
      setFeedback(data)
      setSolved((s) => s + 1)
      setStreak((s) => (data.correct ? s + 1 : 0))
      setDifficulty((d) => {
        const current = d[activeTopic]
        let next = current
        if (data.correct && streak + 1 >= 2) next = Math.min(5, current + 1)
        if (!data.correct) next = Math.max(1, current - 1)
        return { ...d, [activeTopic]: next }
      })
    } catch (err) {
      setErrorMsg('Could not reach the tutor API.')
    } finally {
      setLoading(false)
    }
  }

  const topicMeta = TOPICS.find((t) => t.id === activeTopic)

  return (
    <div className="page">
      <div className="grid-backdrop" />

      <header className="hero">
        <p className="wordmark">StudyBuddy</p>
        <h1>
          Practice that gets <em>harder</em> exactly when you get it right —
          and easier the moment you don't.
        </h1>
        <p className="sub">
          Pick a topic below. Every problem is generated fresh, graded on the
          spot, and the difficulty adjusts to where you actually are.
        </p>
      </header>

      <section className="topics" aria-label="Choose a topic">
        {TOPICS.map((t) => (
          <button
            key={t.id}
            className={`topic-pill ${activeTopic === t.id ? 'active' : ''}`}
            onClick={() => startTopic(t.id)}
          >
            <span className="topic-label">{t.label}</span>
            <span className="topic-hint">{t.hint}</span>
          </button>
        ))}
      </section>

      {activeTopic && (
        <section className="board">
          <div className="board-top">
            <span className="board-topic">{topicMeta?.label}</span>
            <MasteryDots level={difficulty[activeTopic]} />
          </div>

          {loading && !problem && <p className="loading">Writing a problem…</p>}

          {errorMsg && <p className="error">{errorMsg}</p>}

          {problem && (
            <>
              <p className="problem-text">{problem.problem}</p>

              {!feedback ? (
                <form onSubmit={submitAnswer} className="answer-form">
                  <textarea
                    className="work-input"
                    placeholder="Show your work (optional, but it helps the feedback)…"
                    value={work}
                    onChange={(e) => setWork(e.target.value)}
                    rows={3}
                  />
                  <div className="answer-row">
                    <input
                      className="answer-input"
                      placeholder="Your answer"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="submit-btn"
                      disabled={loading || !answer.trim()}
                    >
                      {loading ? 'Checking…' : 'Submit'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className={`feedback ${feedback.correct ? 'good' : 'bad'}`}>
                  <p className="verdict">
                    {feedback.correct ? 'Correct.' : 'Not quite.'}
                  </p>
                  <p className="explanation">{feedback.feedback}</p>
                  {feedback.misconception && !feedback.correct && (
                    <p className="misconception">
                      Likely gap: {feedback.misconception}
                    </p>
                  )}
                  <button className="next-btn" onClick={nextProblem}>
                    Next problem →
                  </button>
                </div>
              )}
            </>
          )}

          <div className="stats">
            <span>{solved} solved</span>
            <span>{streak} streak</span>
          </div>
        </section>
      )}
    </div>
  )
}

function MasteryDots({ level }) {
  return (
    <div className="mastery" aria-label={`Difficulty level ${level} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`dot ${i <= level ? 'filled' : ''}`} />
      ))}
    </div>
  )
}
