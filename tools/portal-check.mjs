#!/usr/bin/env node
/**
 * Browser check of the web portal against a running API and portal: signs in as throwaway users of a throwaway
 * clinic, opens every page, checks what it shows and that nothing errors, saves screenshots, then deletes it all.
 *
 *   node --env-file=.env tools/portal-check.mjs [screenshot dir]
 *
 * Needs the API (API_URL, default http://localhost:3333/api), the portal (PORTAL_URL, default
 * http://localhost:3000), the model service, and Google Chrome installed (driven by playwright-core).
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { chromium } from 'playwright-core';

const API = (process.env.API_URL ?? 'http://localhost:3333/api').replace(/\/+$/, '');
const PORTAL = (process.env.PORTAL_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const shots = process.argv[2] ?? 'portal-screenshots';
mkdirSync(shots, { recursive: true });
const photo = readFileSync('tools/fixtures/synthetic-wound-sticker.jpg');

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = new pg.Client({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const results = [];
const check = (name, ok, extra = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  — ${extra}` : ''}`);
};
const users = [];
let clinicId;

async function user(tag) {
  const email = `portal-${tag}-${Date.now()}@example.com`;
  const password = `${crypto.randomUUID()}Aa1!`;
  const { data, error } = await supa.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { firstName: 'Test', lastName: tag } });
  if (error) throw error;
  users.push(data.user.id);
  const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: s } = await anon.auth.signInWithPassword({ email, password });
  return { id: data.user.id, email, password, token: s.session.access_token };
}

const call = async (who, path, init = {}) => {
  const res = await fetch(API + path, {
    ...init,
    headers: { ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${who.token}`, ...init.headers },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

async function seed(admin) {
  const consent = { care: true, photos: true, aiTraining: false, noticeVersion: 'dpdp-1' };
  const p = await call(admin, '/patients', { method: 'POST', body: JSON.stringify({ firstName: 'Asha', lastName: 'Verma', sex: 'F', ageYears: 61, mobile: '98765 43210', location: 'Pune', consent }) });
  await call(admin, '/patients', { method: 'POST', body: JSON.stringify({ firstName: 'Ravi', lastName: 'Kumar', sex: 'M', ageYears: 54, consent }) });
  const c = await call(admin, '/cases', { method: 'POST', body: JSON.stringify({ patientId: p.body.id, location: 'Left heel', onset: '2026-09-01', comorbidities: ['Diabetes'] }) });
  const form = new FormData();
  form.append('photo', new Blob([photo], { type: 'image/jpeg' }), 'w.jpg');
  form.append('intake', JSON.stringify({ diabetes: 'yes', cause: 'pressure_lying_or_sitting', body_location: 'heel' }));
  const v = await call(admin, `/cases/${c.body.id}/visits`, { method: 'POST', body: form });
  for (let i = 0; i < 60; i++) {
    const r = await call(admin, `/visits/${v.body.id}`);
    if (r.body?.status !== 'processing') break;
    await new Promise((res) => setTimeout(res, 1500));
  }
  return { patientId: p.body.id, caseId: c.body.id, visitId: v.body.id };
}

async function main() {
  await db.connect();
  const [admin, front] = await Promise.all([user('admin'), user('front')]);
  clinicId = (await db.query(`INSERT INTO "Clinic" (id, name, "updatedAt") VALUES (gen_random_uuid(), 'Portal check clinic', now()) RETURNING id`)).rows[0].id;
  for (const [u, role] of [[admin, 'ADMIN'], [front, 'FRONT_DESK']]) {
    await db.query(`INSERT INTO "User" (id, email, "firstName", "lastName", "updatedAt") VALUES ($1, $2, 'Test', $3, now())`, [u.id, u.email, role === 'ADMIN' ? 'Admin' : 'Desk']);
    await db.query(`INSERT INTO "Membership" (id, "userId", "clinicId", role, "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, now())`, [u.id, clinicId, role]);
  }
  const { patientId, caseId } = await seed(admin);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource.*404/.test(m.text()) && errors.push(m.text()));

    const signIn = async (who) => {
      await page.goto(`${PORTAL}/login`);
      await page.getByLabel('Email').fill(who.email);
      await page.getByLabel('Password').fill(who.password);
      await page.getByRole('button', { name: 'Sign in' }).click();
    };
    const visit = async (path, text, shot) => {
      const t0 = Date.now();
      await page.goto(PORTAL + path);
      const ok = await page.getByText(text).filter({ visible: true }).first().waitFor({ timeout: 15_000 }).then(() => true, () => false);
      const ms = Date.now() - t0;
      await page.screenshot({ path: `${shots}/${shot}.png`, fullPage: true });
      check(`${path} shows "${text}"`, ok, `${ms} ms`);
    };

    await signIn(admin);
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    check('admin lands on the dashboard after signing in', page.url().endsWith('/dashboard'));
    await visit('/dashboard', 'Clinic overview', 'dashboard');
    await visit('/patients', 'Asha Verma', 'patients');
    await page.getByPlaceholder('Search name or patient ID').fill('ravi');
    check('search narrows the list', await page.locator('table').getByText('Asha Verma').waitFor({ state: 'hidden', timeout: 8000 }).then(async () => page.locator('table').getByText('Ravi Kumar').isVisible(), () => false));
    await visit(`/patients/${patientId}`, 'Left heel', 'patient');
    await visit(`/cases/${caseId}`, 'Area over time', 'case');
    check('case page shows the analysed visit', await page.getByText('T1 ·').filter({ visible: true }).first().waitFor({ timeout: 8000 }).then(() => true, () => false));
    await visit('/review-queue', 'AI drafts', 'queue');
    check('queue lists the draft', await page.getByText('Asha Verma').filter({ visible: true }).first().waitFor({ timeout: 8000 }).then(() => true, () => false));
    await visit('/registration', 'Consent (DPDP)', 'register');
    await visit('/export', 'De-identify export', 'export');
    await visit('/settings/members', 'Users & roles', 'members');
    await visit('/audit', 'Audit log', 'audit');
    check('audit shows the visit', await page.getByText('Added a visit photo').filter({ visible: true }).first().waitFor({ timeout: 8000 }).then(() => true, () => false));

    // A client-side navigation after the first load is served from the cache.
    await page.goto(`${PORTAL}/patients`);
    await page.getByText('Asha Verma').filter({ visible: true }).first().waitFor();
    const t0 = Date.now();
    await page.getByRole('link', { name: 'Dashboard' }).first().click();
    await page.getByText('Clinic overview').waitFor();
    check('navigating back to a visited page is instant', Date.now() - t0 < 1500, `${Date.now() - t0} ms`);

    // Mark the wound reviewed from the case page (optimistic) — only when it is flagged.
    await page.goto(`${PORTAL}/cases/${caseId}`);
    await page.getByText('Area over time').waitFor();
    const markBtn = page.getByRole('button', { name: 'Mark reviewed' });
    if (await markBtn.isVisible()) {
      await markBtn.click();
      check('mark reviewed flips at once', await page.getByRole('button', { name: /^Reviewed/ }).waitFor({ timeout: 3000 }).then(() => true, () => false));
    }

    // Approve the AI draft.
    const approve = page.getByRole('button', { name: 'Approve draft' });
    if (await approve.isVisible()) {
      await approve.click();
      check('approving the draft shows the decision', await page.getByText('Approved').filter({ visible: true }).first().waitFor({ timeout: 8000 }).then(() => true, () => false));
    }

    await page.screenshot({ path: `${shots}/case-after.png`, fullPage: true });

    // Phone width
    await page.setViewportSize({ width: 390, height: 844 });
    await visit('/patients', 'Asha Verma', 'patients-phone');

    // Front desk: no clinical pages
    await page.context().clearCookies();
    await page.setViewportSize({ width: 1360, height: 900 });
    await signIn(front);
    await page.waitForURL(/\/(dashboard|patients)/, { timeout: 15_000 });
    await page.waitForURL(/\/patients/, { timeout: 15_000 }).catch(() => undefined);
    check('front desk is sent to patients, not the dashboard', page.url().includes('/patients'), page.url());
    await visit(`/patients/${patientId}`, 'Clinical details are for doctors', 'patient-front-desk');
    check('front desk has no review queue in the menu', !(await page.getByRole('link', { name: 'Review queue' }).isVisible()));

    check('no errors in the browser console', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
  }
}

try {
  await main();
} catch (e) {
  check('ran to the end', false, e.message);
} finally {
  if (clinicId) {
    const photos = await supa.storage.from('images').list(`${clinicId}/treatments`, { limit: 1000 });
    for (const dir of photos.data ?? []) {
      const files = await supa.storage.from('images').list(`${clinicId}/treatments/${dir.name}`);
      await supa.storage.from('images').remove((files.data ?? []).map((f) => `${clinicId}/treatments/${dir.name}/${f.name}`));
    }
    await db.query(`DELETE FROM "Clinic" WHERE id = $1`, [clinicId]);
  }
  for (const id of users) {
    await db.query(`DELETE FROM "User" WHERE id = $1`, [id]).catch(() => undefined);
    await supa.auth.admin.deleteUser(id);
  }
  await db.end();
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
}
