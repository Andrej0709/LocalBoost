# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Installable as a home-screen app (PWA: `site.webmanifest`, `sw.js`, push notifications). Mobile web is the main way owners use the product; there is no native app.

## Users

The primary user is the owner of a small local business — café, bakery, pizza place, salon, gym, car wash and similar venues — in Serbia first and the EU in parallel. They have no marketing staff and no time to shoot, write or schedule posts. They open Adronis on their phone, usually once a week, to approve or reject the week's ads, often between customers. No single niche is prioritized; every local venue type is served equally.

Secondary audience: the Adronis team itself (founder and partner), who run the beta, read applications and publish approved ads by hand through the separate Adronis Portal repo.

## Product Purpose

Adronis is a weekly "drop" of ready-made ads for a local business. The owner describes the business once (the brief: voice, palette, street, offers, closed days). Every week the engine writes and renders a fresh batch of ads; the owner swipes to approve or reject in about two minutes; approved ads are published to their channels.

Success for the owner: their business keeps showing up online every week without them making anything. Success for Adronis: owners keep approving drops week after week, and the business reaches a living income (target €1,500–3,000/month within 12–18 months of launch).

## Positioning

Adronis never asks the owner to make anything. No brief queue, no revision calls, no strategy meetings — the drop lands whether or not the owner had a good week, and their only job is approve or reject. It sits between cheap AI generators (which still need the owner to prompt and post) and freelancers or agencies (which need briefs and retainers). Ads are fitted to the venue's real local context: the weather forecast for the posting day, local town events, holidays and the venue's closed days.

## Operating Context

- Weekly rhythm: a drop lands in **Approvals**; ads not approved or rejected before the next drop **expire** (never recycled). Opt-in auto-approval after 48 hours avoids that.
- Owners can put a heart on ads they love; the engine treats loved ads as the strongest "more like this" signal, and avoid-tags as the opposite.
- Main surfaces: landing page, signup + brief, beta page, Approvals (swipe), Control room (stats, profile strength), Calendar, History, Report, Account, Invite, What's new, legal pages, demo (`/demo`), and shareable proposal / calendar / review links for sales outreach.
- Sales happen face to face and in Instagram DMs; the demo and proposal links are shown to owners on the spot, often on a phone.
- Ad engine: Claude API writes the ads, Higgsfield API renders images. Ads are never made by hand. API keys are not bought yet, so the engine runs in practice mode until the domain is bought.

## Capabilities and Constraints

- **Beta-only until public launch (planned 1 February 2027).** Applying means signing up with the full brief; the team switches the Beta plan on in the portal. Seats are limited because every tester costs real generation money. Beta testing starts in early November 2026 — copy must say "starts soon / early November", never that it has started.
- **Plans (VAT included):** Free (3 ads/month, 1 channel — hidden during beta), Counter €59/month (4 ads/week, 2 channels), Storefront €149/month, Franchise €490/month (sold only after a conversation, never self-serve). 20% annual discount; public code ADRONIS20; FOUNDER30 only for beta venues. All billing goes through Paddle (sandbox until launch, deliberately).
- Publishing is manual during the beta (no Meta API yet); copy must not imply instant automatic publishing to every network until that exists.
- Domain: the live site is www.adronis.app (adronis.app redirects there; bought 2026-10-25). Still waiting on the domain setup: Resend sending, email confirmation back on, and the privacy@/legal@/ip@ mailboxes.
- Terms and Privacy still carry legal-entity placeholders until the founder decides with their partner who Adronis runs under. Do not fill them in.
- Referral invites are live with no reward promised; perks are undecided.
- No pause option and no retention offers at cancellation — only a neutral "why are you leaving?" question.
- Static site: plain HTML/CSS/JS, shared stylesheet `adronis.css`, React loaded from unpkg on the landing page, Supabase (auth, database, Edge Functions, cron), deployed on Vercel. Local preview: `npx http-server . -p 4321`.
- Terminology: "drop" (the weekly batch), "Approvals", "Control room", "brief", "engine", "channels".

## Brand Commitments

- Name: **Adronis**. Tagline in use: "Weekly ad drops for businesses with no marketing department." Footer credit: "Made by CreativesByAndrej".
- **English and Serbian are equal.** Every screen must work fully in both (`i18n.js`, `i18n-sr.js`); Serbian, Croatian, Bosnian and Montenegrin browsers get Serbian. Layouts must survive the longer Serbian strings.
- Voice: plain, direct, respectful of a busy owner's time; no begging, no pressure tactics.
- Team is described only as "a small team", with no claims about backgrounds. (The About page's old "engineers and former agency creative directors" line was removed on 2026-10-18.)
- Logo and icons: `logo.png`, `logo-128.png`, `icon-256.png`, `icon-512.png`; Instagram avatar in `instagram/`.

## Evidence on Hand

- Example ad images: `examples/` (bakery, café, car wash, fitness, pizza, salon) — illustrative examples, not real customer work.
- Product screenshots: `shots/`. Link-preview image: `og-image.jpg` (English only, by choice).
- **No real customers, testimonials, case studies, reviews, press or usage numbers exist yet.** No owner has used the product. Never invent any of these, or present example ads as a client's results.
- Stats such as "52 drops per year" and "0 briefs you write" are product facts; channel counts must match the plan actually on offer.

## Product Principles

1. **The owner never makes anything.** Every flow should reduce the owner's job to approve, reject or love. If a feature asks them to create, it needs a strong reason.
2. **Two minutes a week.** Approvals is the heart of the product; it must be fast, obvious and comfortable one-handed on a phone.
3. **Local and timely beats generic.** Weather, town events, holidays and closed days are what make a drop feel like it was made for this venue this week.
4. **Honest at every step.** Say what is true today (beta not started, manual publishing, no customers yet); no fabricated proof, no retention tricks.
5. **Two languages, one product.** Serbian and English are first-class; neither is an afterthought.
