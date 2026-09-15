// Vercel serverless function: /api/tutor
// Talks to Groq's free LLM API (no credit card required — see README).
// Keeps the API key server-side so it never reaches the browser.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

const TOPIC_LABELS = {
  kinematics: 'kinematics (multi-phase motion, average vs instantaneous velocity)',
  freefall: 'free fall and projectile motion',
  derivatives: 'derivatives (limit definition and derivative rules)',
  limits: 'limits (algebraic and exponential)',
}

async function callGroq(messages) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error(
      'GROQ_API_KEY is not set. Add it in your Vercel project settings (see README).'
    )
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Groq API error (${res.status}): ${text}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

function extractJson(raw) {
  // Model sometimes wraps JSON in ```json fences — strip those before parsing.
  const cleaned = raw.replace(/```json|```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON found in model response')
  return JSON.parse(cleaned.slice(start, end + 1))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST' })
    return
  }

  const { action, topic, difficulty, problem, studentAnswer, studentWork } = req.body || {}
  const topicLabel = TOPIC_LABELS[topic] || topic

  try {
    if (action === 'new_problem') {
      const raw = await callGroq([
        {
          role: 'system',
          content:
            'You write short, original word problems for a high school student practicing calculus and physics. ' +
            'Respond with ONLY valid JSON of the form {"problem": "..."} — no markdown, no code fences, no extra keys. ' +
            'Never include the answer or hints in the problem text.',
        },
        {
          role: 'user',
          content: `Topic: ${topicLabel}. Difficulty: ${difficulty} out of 5 (1 = single-step warm-up, 5 = multi-step, combines sub-concepts, requires careful setup). Write one problem at this difficulty.`,
        },
      ])
      const parsed = extractJson(raw)
      res.status(200).json({ problem: parsed.problem })
      return
    }

    if (action === 'grade') {
      const raw = await callGroq([
        {
          role: 'system',
          content:
            'You grade a student\'s answer to a calculus/physics problem. Be encouraging but precise. ' +
            'Respond with ONLY valid JSON of the form {"correct": true|false, "feedback": "2-4 sentences explaining the correct approach", "misconception": "the specific error, or empty string if correct"} — no markdown, no code fences.',
        },
        {
          role: 'user',
          content: `Problem: ${problem}\n\nStudent's shown work: ${studentWork || '(none provided)'}\n\nStudent's final answer: ${studentAnswer}\n\nGrade this.`,
        },
      ])
      const parsed = extractJson(raw)
      res.status(200).json(parsed)
      return
    }

    res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
