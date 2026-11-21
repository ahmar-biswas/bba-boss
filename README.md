# BBA Boss

A pixel-art study game for IBA students. Upload your lecture PDFs and the AI turns them into a playable level.

Live: https://bba-boss.vercel.app

## How it plays

- Upload one or more lecture PDFs (or paste text) and answer 5 quick setup questions: what to focus on, which question types, how the exam will test you, whether you want AI explainers, and which examples you want.
- The AI builds lessons with the slide text first, plus key points, short explainers and key terms. Slide tables show as tables, and practice problems are flagged in their own box with the solution behind a button.
- Each stop has a timed recall quiz, and the level ends in an exam hall.
- Correct answers earn BBA Bucks. Spend them in a 24-item shop and unlock characters.
- Progress and your last built chapters save in your browser.
- If the AI can't be reached or you hit the daily limit, the level is built with the offline slide reader instead.

## Folder layout

```
public/index.html   the whole game (single page, PDF reader included)
api/_core.js        shared server logic: daily limits, build tokens, Gemini and Tavily calls
api/start.js        POST /api/start: checks the daily limit, returns a build token
api/ai.js           POST /api/ai: runs one AI request for a build token
vercel.json         serves public/, gives the API functions up to 120 seconds
package.json
```

## Environment variables

Set these on the Vercel project. Never commit values.

| Name | Needed | What it's for |
|---|---|---|
| `GEMINI_API_KEY` | yes | Google Gemini API key |
| `TAVILY_API_KEY` | optional | Tavily web search for real-world examples |
| `TOKEN_SECRET` | yes | Random secret that signs build tokens |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | yes | Upstash Redis (connect it from Vercel Storage), stores the daily counts |
| `GEMINI_MODEL` | optional | Gemini model name. Default `gemini-2.5-flash`; the live site uses `gemini-flash-lite-latest` |
| `DAILY_PDFS` | optional | PDFs per player per day (default 10) |
| `IP_DAILY_PDFS` | optional | PDFs per network per day (default 40) |
| `GLOBAL_DAILY_PDFS` | optional | PDFs for the whole site per day (default 500) |

## Limits

- 10 AI-built PDFs per player per day, 40 per network and 500 for the whole site. Counts reset at midnight Dhaka time.
- A build token lasts 6 hours. Each IP can make up to 40 AI requests a minute.
- Prompts are capped at 40,000 characters and replies at 8,192 tokens.

## Deploy

From this folder, in PowerShell (use `npx.cmd` if scripts are blocked):

```powershell
npx.cmd vercel@latest deploy --prod
```

There is no build step: Vercel serves `public/` and runs the functions in `api/`.

# How it works

You upload your lecture slides, answer 5 quick questions, and the game turns your slides into a campus you walk through. Every lesson becomes a board in a room, every board ends in a recall quiz, and everything leads up to one big exam.

# From slides to rooms

First, you answer 5 setup questions so the game knows how to build your lessons:

- What to focus on: definitions, lists and frameworks, numbers, cases, or everything balanced
- Question types: MCQ, True/False, Fill in the blanks, Short questions, or all of them
- Exam style: memorisation, applying ideas, or a mix
- AI explainers: on or off
- Examples: Bangladeshi, global, both, or none

Then each lesson board is built in the same layout as the sample chapters:

- Lines taken straight from the slides, always first
- Key terms, plus worked maths when the slides have numbers
- A plain-language AI explainer, if you turned it on
- Bangladeshi or global examples, which are only study aids and never used in questions

The boards are placed around campus in the Main Building, Eucalyptus Tree, Canteen, Classroom, Library and Bunker. After every board you get a timed recall quiz that only uses the question types you picked.

# The exam

The exam takes place in Exam Hall 01, with twist cards, rumours, a boss fight and a final grade. It pays out BBA Bucks.

- It uses a separate, harder question bank that never repeats a recall question
- About half the questions come from your focus areas
- You get more scenario questions if you chose applying ideas

# Characters

Every character has one power you can use once per exam. YMN and IBRU are free, and the rest are unlocked with BBA Bucks. You can tap a locked character to see their stats and power, but you have to buy them before you can play as them.

- YMN: Funny 95, power SIX SEVEN, free
- IBRU: Rich 95, power LT MONEY, free
- RYD: Handsome and Aura 95, power RIZZ, 2,500 B$
- PRJT: Brain 97, power NERD ATTACK, 4,000 B$
- RNGN: Aura 95, power GUITAR RIFF, 6,000 B$
- ARIK: Handsome 92, power BETRAYAL, 9,000 B$
