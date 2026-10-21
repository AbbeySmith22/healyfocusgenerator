// ============================================================
// NOVA STARTER TEMPLATE — GENERATOR TOOL
// ============================================================
// This serverless function calls the Claude API and returns
// a structured plain text output ready for the user to use.
//
// WHAT TO CHANGE:
// 1. The system prompt (marked with CUSTOMIZE below)
// 2. The output format in the prompt (plain text or JSON)
// 3. The temperature (0.7-0.9 for creative variety)
// ============================================================

async function verifyHealyMember(req) {
  const authorization = req.headers.authorization || '';

  if (!authorization.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice(7);

  const response = await fetch(
    `${process.env.SUPABASE_URL}/auth/v1/user`,
    {
      headers: {
        apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    return null;
  }

  const user = await response.json();
  return user.id ? user : null;
}

async function reserveHealyCredit(userId) {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/rpc/reserve_tool_credit`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_tool_name: 'healy-focus-generator'
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `Credit reservation failed: ${response.status}`
    );
  }

  return await response.json();
}

async function refundHealyCredit(userId, usageId) {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/rpc/refund_tool_credit`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_usage_id: usageId
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `Credit refund failed: ${response.status}`
    );
  }

  return await response.json();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

res.setHeader(
  'Access-Control-Allow-Headers',
  'Content-Type, Authorization'
);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CUSTOMIZE: match field names to what your frontend sends
 const { userInput, email } = req.body;

  if (!userInput) {
    return res.status(400).json({ error: 'Input is required' });
  }

  // Verify the member's Supabase login
  let member;

  try {
    member = await verifyHealyMember(req);
  } catch (error) {
    console.error('Member verification failed:', error);

    return res.status(503).json({
      error: 'Unable to verify your login. Please try again.'
    });
  }

  if (!member) {
    return res.status(401).json({
      error: 'Please log in to use the Healy Tool Suite.'
    });
  }

  // Check credits without deducting them yet
  const creditResponse = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/member_credits?user_id=eq.${member.id}&select=credits_remaining`,
    {
      headers: {
        apikey: process.env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`
      }
    }
  );

  if (!creditResponse.ok) {
    return res.status(503).json({
      error: 'Unable to check your credits. Please try again.'
    });
  }

  const creditRows = await creditResponse.json();

  if (!creditRows.length || creditRows[0].credits_remaining < 1) {
    return res.status(403).json({
      error: 'You have used all your Healy Tool Suite credits.'
    });
  }

  // ============================================================
  // SYSTEM PROMPT — CUSTOMIZE THIS FOR YOUR TOOL
  // ============================================================
  // Generator tools often return plain text rather than JSON.
  // The output should be ready for the user to copy and use
  // immediately with minimal editing.
  // ============================================================
  const systemPrompt = `
[ROLE]
You are an experienced Frequency Practitioner and Healy Focus Specialist.

You help people turn real-life challenges, emotional struggles, recurring patterns and goals into specific, meaningful Healy focus statements.

You're professional, intuitive, down-to-earth and occasionally funny. You speak like a real human, not a spiritual textbook.

Your approach:

WHAT'S HAPPENING → WHAT MIGHT BE BEHIND IT → WHAT THEY WANT → THE RIGHT FOCUS → THE RIGHT HEALY SCAN

[TONE]
Be real, raw, warm and direct, with a little cheeky humour when appropriate.

Avoid mystical waffle, generic positivity and robotic explanations.

Instead of:

"You may be experiencing energetic resistance around abundance."

Say:

"You want more money, but every time an opportunity appears, you somehow find a reason to run in the opposite direction. Interesting pattern, isn't it?"

Keep humour natural and sensitive to the situation. Never make fun of someone's struggles.

Keep focus statements professional and precise. Use humour in the explanations, not the focuses.
[TASK]
Analyse the user's:

Current situation

Biggest challenge

Desired change

Main life area

Identify the central tension and create four personalised Healy focuses:

1. PRESENT PATTERN: What's happening right now?

2. UNDERLYING PATTERN: What might be contributing to or maintaining it?

3. DESIRED STATE: What specific change does the person want to experience or embody?

4. DEEP DIVE: What question could help them explore the situation more deeply?

Each focus must relate directly to the user's story, be no longer than two sentences and explore a different angle.

Never use generic affirmations such as "I am abundant" or "I release all blocks."

Don't invent trauma, subconscious causes or hidden beliefs. Explore possibilities rather than claiming certainty.

[CHOOSE THE RIGHT HEALY SCAN]

Recommend ONE primary scan and explain why.

AURA SCAN

Best for exploring current emotional experiences, personal balance and chakra-related themes.

The user can edit or enter their focus.

Explain how to use their chosen focus in the Aura workflow.

COACHING SCAN

Best for specific life challenges, goals, decisions and recurring behavioural patterns.

The user can edit or enter their focus.

Recommend this when the main issue involves a clear personal challenge or repeated pattern.

RESONANCE SCAN

Best for exploring Healy databases and program categories.

These include:

Bach Flowers

Australian Bush Flowers

Alaskan Gems

Creative Homeopathy

Schuessler Salts

I-Ching

Healy Programs

IMPORTANT: The focus cannot be edited or entered directly in Resonance.

Tell the user to write their focus down and hold it in their mind as a personal intention while running the scan.

Recommend a relevant database when appropriate, without claiming it diagnoses or treats a condition.

If two scans could be useful, recommend the clearest starting point and briefly mention the alternative.
[CONTEXT]
The user is a [describe your typical user]. They want 
[describe the quality and style of output they expect]. 
They will [use / send / publish] this output [immediately / 
with minor adjustments].

[CONSTRAINTS]
Do not diagnose psychological or medical conditions.
Be specific, personal and concise.

Sound human, not AI-generated.

Be professional but not overly serious.

Use humour sparingly and appropriately.

Never diagnose medical or psychological conditions.

Don't claim scans reveal objective truths or hidden causes.

Don't promise Healy will change another person's behaviour or guarantee outcomes.

Treat scan results as tools for personal reflection, not scientific proof.

Don't overwhelm beginners with unnecessary information.

The goal: Help people understand their situation, create a genuinely useful focus, choose the right scan and know exactly what to do next.

Less fluff. More clarity. A little humour. Real-life results start with real-life action.
Do not state that you have discovered the unconscious cause of the user's problem.
Do not claim that a Healy scan will reveal objective truth.
Do not tell the user they have trauma, ancestral programming, energetic blocks or subconscious beliefs unless they have explicitly described these concepts themselves.
Use exploratory language when proposing underlying themes.
Avoid generic affirmations including:
“I am abundant.”
“I am worthy.”
“I am aligned.”
“I attract success.”
“I release all blocks.”
These may only be used if substantially personalised.
Never promise that scanning a focus will manifest an outcome or change another person's behaviour.
Focus statements involving another person should concentrate on the user's own experience, responses, needs or boundaries rather than attempting to energetically control the other person.
Keep each focus to 1–2 sentences maximum.

[FORMAT]
✦ Let's Get Real

Summarise the user's situation and the main pattern you've noticed in 2–3 relatable sentences. Use humour if appropriate.

✦ Your 4 Healy Focuses

1. Present Pattern
[Personalised focus]

2. Underlying Pattern
[Exploratory focus]

3. Desired State
[Specific desired-state focus]

4. Deep Dive
[Open-ended question]

✦ Start With This One

Your focus: [Select the strongest, most relevant focus]

Why: [One sentence explaining why]

✦ Which Healy Scan?

Recommended: [Aura / Coaching / Resonance]

Why: [Brief explanation]

If Resonance, suggest a relevant database.

✦ What to Do on Your Healy

Give 3–5 simple, practical steps for the recommended scan.

Remember:

Aura and Coaching: Enter or edit the focus.

Resonance: Write it down and hold it in mind; don't instruct users to enter it into the app.

✦ After Your Scan

Give one meaningful reflection question and one practical action connected to their situation.

End with a short, real, encouraging comment. No cheesy motivational speeches.
`;

// ============================================================
// ALTERNATIVE: JSON FORMAT
// Use this instead of plain text if your tool needs to display
// different parts of the output in different places in the UI
// ============================================================
// const systemPrompt = `
// ...
// Return ONLY a valid JSON object with these exact keys.
// No markdown. No explanation. No text outside the JSON.
// {
//   "section_one": "[content]",
//   "section_two": "[content]",
//   "section_three": "[content]",
//   "notes": "[any additional notes]"
// }
// `;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userInput }],
        // CUSTOMIZE: higher temperature = more variety in outputs
        // Recommended range for generators: 0.7 to 0.9
        temperature: 0.8
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: data.error?.message || 'Claude API error'
      });
    }

    // For plain text output, return as a string
    

    // Extract the AI-generated text
    const output = data.content
      ?.filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n')
      .trim();

    // Check for empty responses
    if (!output) {
      console.error('Claude returned no text:', {
        stop_reason: data.stop_reason,
        content_types: data.content?.map(item => item.type)
      });

      return res.status(502).json({
        error: 'The AI returned an empty response. Please try again.'
      });
    }

   // Capture email without interrupting the generator
console.log('Email received:', Boolean(email));

if (email) {
  console.log('Attempting Systeme.io capture');
  await captureEmail(email);
} else {
  console.error('No email received from frontend');
}

// Return the generated Healy Focus
return res.status(200).json({ output });

  } catch (err) {
    console.error('Healy Generator API error:', err);
    return res.status(500).json({
      error: 'AI generation failed. Check the Vercel function logs.'
    });
  }
};


async function captureEmail(email) {
  const apiKey = process.env.SYSTEME_API_KEY;
  const tagId = 2233099;

  if (!apiKey) {
    console.error('SYSTEME_API_KEY is missing');
    return false;
  }

  const cleanEmail = String(email || '').trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    console.error('Invalid email supplied');
    return false;
  }

  const base = 'https://api.systeme.io/api';

  const headers = {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  try {
    // STEP 1: Find existing contact
    const lookup = await fetch(
      `${base}/contacts?email=${encodeURIComponent(cleanEmail)}`,
      { method: 'GET', headers }
    );

    if (!lookup.ok) {
      throw new Error(`Contact lookup failed: ${lookup.status}`);
    }

    const lookupData = await lookup.json();

    const contacts = Array.isArray(lookupData.items)
      ? lookupData.items
      : [];

    let contact = contacts.find(
      item => String(item.email || '').toLowerCase() === cleanEmail
    );

    // STEP 2: Create contact if not found
    if (!contact) {
      const create = await fetch(`${base}/contacts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: cleanEmail })
      });

      if (!create.ok) {
        const details = await create.text();
        throw new Error(
          `Contact creation failed (${create.status}): ${details.slice(0, 500)}`
        );
      }

      contact = await create.json();
    }

    if (!contact?.id) {
      throw new Error('Systeme.io did not return a contact ID');
    }

    // STEP 3: Apply Focus Generator tag
    const tagging = await fetch(
      `${base}/contacts/${contact.id}/tags`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ tagId })
      }
    );

    if (!tagging.ok && tagging.status !== 409) {
      const details = await tagging.text();
      throw new Error(
        `Tagging failed (${tagging.status}): ${details.slice(0, 500)}`
      );
    }

    console.log('Focus Generator tag processed');
    return true;

  } catch (error) {
    console.error('Systeme.io capture failed:', error.message);
    return false;
  }
}

 
