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
