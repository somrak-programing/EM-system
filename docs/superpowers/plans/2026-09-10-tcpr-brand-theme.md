# TCPR Brand Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the official TCPR logo and colors across the repair system.

**Architecture:** Keep brand tokens in global CSS and consume them through small semantic utility classes. Use one optimized public logo asset in the shared header and login page.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS 4, Vitest

## Global Constraints

- Primary brand color is exactly `#333464`.
- Accent brand color is exactly `#00A99C`.
- Preserve all existing workflow behavior.
- Header and login layout must remain responsive.

---

### Task 1: Brand contract

**Files:**
- Create: `src/lib/brand.test.ts`

- [x] Write a test that requires both color tokens and logo references.
- [x] Run `npm test -- src/lib/brand.test.ts` and confirm it fails because the theme is absent.

### Task 2: Logo and theme

**Files:**
- Create: `public/tcpr-logo.png`
- Modify: `src/app/globals.css`
- Modify: `src/components/Nav.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: screens containing orange accent utilities

- [x] Copy the supplied official wide logo into `public/tcpr-logo.png`.
- [x] Define semantic brand tokens and reusable button, link, card, and input styles.
- [x] Add the logo to the shared header and login page.
- [x] Replace orange accents with TCPR navy and teal styles.
- [x] Run the brand test and all tests.

### Task 3: Verification

**Files:**
- No production changes expected.

- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Review login and authenticated pages in the browser at desktop and mobile widths.
