# BBA Boss

A pixel-art study game that turns your own lecture slides into a level you play through. Built for university students studying memorisation-heavy, qualitative courses.

**Play it:** https://bba-boss.vercel.app

## The problem

Reading the same slides over and over for a History or Marketing course is hard to stick with, and it is easy to get distracted. BBA Boss takes the slides you already have and turns them into short lessons, timed recall quizzes and a final exam, so revising feels like progressing through a game instead of rereading a PDF.

## What you can do

- Upload up to 6 lecture PDFs at once, or paste text, or start with one of 5 built-in sample marketing chapters.
- Answer 5 setup questions: what to focus on, which question types you want, how your exam tests you, whether you want AI explainers, and which examples you want.
- Walk around a pixel-art version of the IBA, University of Dhaka campus, reading lesson boards and taking a timed recall quiz after each one.
- Finish in Exam Hall 01 with a harder exam, twist cards, a boss fight and a final grade.
- Earn BBA Bucks from correct answers, spend them in a 24-item shop, and unlock 4 more characters on top of the 2 free ones.

## How it works

**From slides to rooms.** The 5 setup questions decide how lessons are built:

- Focus: definitions, lists and frameworks, numbers, cases, or everything balanced
- Question types: MCQ, True/False, Fill in the blanks, Short questions, or all of them
- Exam style: memorisation, applying ideas, or a mix
- AI explainers: on or off
- Examples: Bangladeshi, global, both, or none

Each lesson board then follows the same layout as the sample chapters: lines taken straight from the slides first, then key terms (plus worked maths when the slides have numbers), an optional plain-language explainer, and optional examples. Slide tables show as tables, and practice problems get their own box with the solution behind a button. Boards are spread across the Main Building, Eucalyptus Tree, Canteen, Classroom, Library and Bunker, and every recall quiz uses only the question types you picked.

**The exam.** It uses a separate, harder question bank that never repeats a recall question. About half the questions come from your focus areas, and you get more scenario questions if you chose "applying ideas".

**Characters.** Each character has one power you can use once per exam. You can tap a locked character to see their stats and power before buying them.

| Character | Stat | Power | Cost |
|---|---|---|---|
| YMN | Funny 95 | SIX SEVEN | free |
| IBRU | Rich 95 | LT MONEY | free |
| RYD | Handsome and Aura 95 | RIZZ | 2,500 B$ |
| PRJT | Brain 97 | NERD ATTACK | 4,000 B$ |
| RNGN | Aura 95 | GUITAR RIFF | 6,000 B$ |
| ARIK | Handsome 92 | BETRAYAL | 9,000 B$ |

## Rules the project follows

- **Slides come first.** Every lesson starts with lines taken directly from your slides. The AI explains them, it does not replace them.
- **Examples never become questions.** Bangladeshi and global examples are study aids only, so you are never tested on something that was not in your slides.
- **It still works without AI.** If the AI cannot be reached or the daily limit is used up, the level is built by an offline slide reader instead.
- **No keys in the page.** API keys stay on the server as environment variables, and the browser only gets a short-lived signed build token.

## Data and sources

- **Your slides.** PDFs are read in the browser with pdf.js, which is bundled into the page.
- **Google Gemini** writes the explainers, key terms and questions from your slide text.
- **Tavily web search** (optional) finds real-world examples when you ask for them.
- **Sample chapters.** The 5 built-in chapters (STP, Pricing Strategy, Game Theory for Pricing, Future of Marketing, and Steve Jobs and Apple) were written by hand from real course slides.

Because slide lines are shown word for word and examples are kept out of the questions, what you are tested on can always be checked against your own slides.

## How it's built

- **Front end:** one static HTML file (`public/index.html`) with plain JavaScript, canvas pixel art, chiptune audio and pdf.js inlined. No framework and no build step.
- **API:** two Vercel serverless functions in Node 20. `POST /api/start` checks the daily limit and returns a signed build token (HMAC-SHA256, valid for 6 hours). `POST /api/ai` runs one Gemini request, with an optional Tavily search, for a valid token. Shared logic lives in `api/_core.js`.
- **Storage:** daily usage counts live in Upstash Redis. Game progress and the last 3 built chapters are saved in the player's browser (`localStorage`).
- **Hosting:** Vercel. There is no CI and no scheduled job. Deploys are run by hand.

## Quality and limits

There are no automated tests or CI workflows in this repository yet. What the code does enforce:

- 10 AI-built PDFs per player per day, 40 per network and 500 for the whole site, reset at midnight Dhaka time.
- Up to 40 AI requests per minute per IP. Prompts are capped at 40,000 characters and replies at 8,192 tokens.
- Requests from other origins are refused unless listed in `ALLOWED_ORIGIN`.
- The page is about 1.9 MB, most of it the bundled pdf.js. It loads no external scripts, only two Google Fonts (Press Start 2P and VT323).
- The waving BBA Buck note stops animating when the system asks for reduced motion. No full accessibility audit has been done.

## Run it locally

```bash
git clone https://github.com/ahmar-biswas/bba-boss.git
cd bba-boss
npx serve public
```

There is nothing to install. Served this way, the game runs fully but builds levels with the offline slide reader, because the API functions are not running. To run the AI path too, put the variables below in `.env.local` and use `npx vercel dev` (needs a free Vercel account).

| Command | What it does |
|---|---|
| `npx serve public` | Serves the game only, with the offline slide reader |
| `npx vercel dev` | Serves the game and the `/api` functions locally |
| `npx vercel deploy --prod` | Deploys to production (on Windows PowerShell use `npx.cmd`) |

| Variable | Needed | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | yes | Google Gemini API key |
| `TOKEN_SECRET` | yes | Random secret that signs build tokens |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | yes | Upstash Redis for the daily counts |
| `TAVILY_API_KEY` | optional | Web search for real-world examples |
| `GEMINI_MODEL` | optional | Defaults to `gemini-2.5-flash`. The live site uses `gemini-flash-lite-latest` |
| `DAILY_PDFS`, `IP_DAILY_PDFS`, `GLOBAL_DAILY_PDFS` | optional | Override the daily limits (10, 40, 500) |

Never commit real values.

## Status and next steps

BBA Boss is live and playable. It is a solo project, and recent work has gone into cleaning up how slide text is shown (joining split lines, removing repeated headers, detecting tables and practice problems). Things it does not have yet, and that would be the next steps: automated tests, a CI check on pull requests, and saves that follow you across devices instead of living in one browser.

## About

Built by Ahmar Biswas ([@ahmar-biswas](https://github.com/ahmar-biswas)).

> This is for the most boring qualitative courses you will encounter. I built this during my midterms because I genuinely could not study for my History or Marketing courses without getting distracted. So I built a gamification tool for anyone's slides. It works best if you upload clearly typed slides from qualitative courses, especially ones that are memorization heavy.

Feedback and bug reports are welcome through [GitHub issues](https://github.com/ahmar-biswas/bba-boss/issues).
