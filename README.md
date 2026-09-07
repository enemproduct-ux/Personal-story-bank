# Story Bank

A searchable personal bank for behavioral interview stories — built for
"tell me about a time…" prep, but generic enough for any story you want to
find fast by keyword or category.

Add a story once, tag it by what kind of question it answers, and search
across your whole bank by any word that might come up in the room. Your
stories live in your own private cloud database (via [Supabase](https://supabase.com)),
so you can add and search from your phone, laptop, or anywhere else — and
nobody but you can see them.

No build step, no server to run, no framework. It's plain HTML, CSS, and
JavaScript that talks directly to a Supabase project you own for free.

## Why it's built this way

This is meant to be forked. Everyone who clones this repo creates their own
free Supabase project — your data never touches anyone else's infrastructure,
including the original author's. The app itself can be opened straight from
your file system, or deployed for free to something like GitHub Pages,
Netlify, or Vercel if you want a stable link you can open from any device.

## Setup (about 10 minutes)

1. **Create a free Supabase project.** Go to [supabase.com](https://supabase.com),
   sign up, and create a new project. Pick any region and set a database
   password (you won't need it day to day).

2. **Create the table.** In your Supabase project, open **SQL Editor → New
   query**, paste in the contents of [`schema.sql`](./schema.sql), and run it.
   This creates a `stories` table locked down with Row Level Security, so a
   signed-in user can only ever see their own rows.

3. **Get your API keys.** In your Supabase project, go to **Project Settings
   → API**. You'll need the **Project URL** and the **anon public** key (not
   the `service_role` key — never expose that one in a browser app).

4. **Configure the app.**
   ```bash
   cp config.example.js config.js
   ```
   Open `config.js` and paste in your Project URL and anon key.
   `config.js` is git-ignored on purpose — it's specific to your own Supabase
   project and should never be committed.

5. **Run it.** Either:
   - Open `index.html` directly in a browser, or
   - Serve the folder with any static file server, e.g. `npx serve .`, or
   - Deploy the whole folder (it's 100% static) to GitHub Pages, Netlify, or
     Vercel for a permanent link you can bookmark on your phone.

6. **Sign up.** The first time you open the app, use the "Create account"
   button with any email and password. By default Supabase requires email
   confirmation — check your inbox, or turn off "Confirm email" under
   **Authentication → Providers → Email** in your Supabase dashboard if
   you'd rather skip that for a personal tool.

7. **Add your stories**, or hit **Import JSON** and load
   [`example-stories.json`](./example-stories.json) to see the format, then
   replace them with your own.

## Using it

- **Add story** — title, one or more categories (comma-separated — new ones
  are created automatically as you type them), the question types it
  answers, a one-line "anchor" for a fast glance, and the full ~2-minute
  spoken version.
- Wrap the 3–5 words you'd want to catch mid-sentence in `**double
  asterisks**` — they render as highlighted glance-anchors in both the
  collapsed anchor line and the full answer.
- **Search** matches against everything — title, tags, and the full text —
  so typing almost any word from a question someone actually asks you should
  surface the right story.
- **Tags** are generated from whatever you've typed on your own stories —
  there's no fixed category list to work around.
- **Export JSON** backs up everything to a file; **Import JSON** loads a file
  in the same shape back in (see `example-stories.json` for the format).

## A note on privacy

Don't commit your own stories into a public fork of this repo. Keep your
personal data in your own Supabase project (that's what it's for) and use
Export/Import purely as your own local backup — not as a file you check into
git.

## Tech

Vanilla HTML/CSS/JS, [Supabase](https://supabase.com) (Postgres + auth) via
its JS client loaded from a CDN. No build tooling, no framework, no
dependencies to install.

## License

MIT — see [`LICENSE`](./LICENSE). Fork it, rename it, make it yours.
