// FREE tier endpoint — keyword matching only, zero Claude calls
const cors = require('../lib/cors');

// Extract keywords using simple NLP (no API cost)
function extractKeywords(text) {
  const stopWords = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'by','from','as','is','was','are','were','be','been','have','has','had',
    'do','does','did','will','would','could','should','may','might','must',
    'shall','can','need','dare','ought','used','able','this','that','these',
    'those','i','you','he','she','we','they','it','me','him','her','us','them',
    'my','your','his','its','our','their','what','which','who','whom','whose',
    'when','where','why','how','all','both','each','few','more','most','other',
    'some','such','no','nor','not','only','own','same','so','than','too','very',
    'just','about','above','after','before','between','during','into','through',
    'under','while','although','because','since','unless','until','within',
    'without','including','following','across','behind','beyond','plus','except',
    'up','out','around','down','off','above','well','also','use','using','used',
    'work','working','experience','years','year','team','company','role','position',
    'responsibilities','requirements','qualifications','preferred','required','ability'
  ]);

  // Extract meaningful phrases and single words
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s\-\/\+\#\.]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  // Count frequency
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

  // Also extract 2-word phrases
  const wordArr = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  for (let i = 0; i < wordArr.length - 1; i++) {
    const phrase = wordArr[i] + ' ' + wordArr[i+1];
    if (!stopWords.has(wordArr[i]) && !stopWords.has(wordArr[i+1])) {
      freq[phrase] = (freq[phrase] || 0) + 0.5;
    }
  }

  return freq;
}

function scoreResume(resumeText, jdText) {
  const jdFreq = extractKeywords(jdText);
  const resumeFreq = extractKeywords(resumeText);

  // Get top JD keywords by frequency
  const jdKeywords = Object.entries(jdFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([kw]) => kw);

  const missing = [];
  const present = [];

  jdKeywords.forEach(kw => {
    const inResume = resumeFreq[kw] > 0 ||
      resumeText.toLowerCase().includes(kw.toLowerCase());

    if (inResume) {
      present.push(kw);
    } else {
      missing.push(kw);
    }
  });

  // Score = % of top JD keywords found in resume
  const total = jdKeywords.length || 1;
  const matched = present.length;
  const rawScore = Math.round((matched / total) * 100);

  // Normalize to feel more realistic (compress toward middle)
  const score = Math.min(95, Math.max(12, Math.round(rawScore * 0.7 + 15)));

  return {
    score,
    missing_keywords: missing.slice(0, 8),
    present_keywords: present.slice(0, 6),
    verdict: score >= 70 ? 'Strong match' : score >= 50 ? 'Moderate match' : score >= 30 ? 'Needs work' : 'Low match'
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { resume, jobDescription } = req.body || {};

  if (!resume || !jobDescription) {
    return res.status(400).json({ error: 'resume and jobDescription are required' });
  }

  if (resume.length < 50) return res.status(400).json({ error: 'Resume too short' });
  if (jobDescription.length < 50) return res.status(400).json({ error: 'Job description too short' });

  try {
    const result = scoreResume(resume, jobDescription);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: 'Scoring failed' });
  }
};
