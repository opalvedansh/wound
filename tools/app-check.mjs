#!/usr/bin/env node
/**
 * Browser check of the mobile app's web build against a running API: a throwaway doctor signs in, sees a patient
 * registered in the portal (pull), registers one in the app (push), and the server gets it. Then cleans up.
 *
 *   node --env-file=.env tools/app-check.mjs [screenshot dir]
 *
 * Needs the API (API_URL, default http://localhost:3333/api), the app's web build (APP_URL, default
 * http://localhost:19000) and Google Chrome (driven by playwright-core).
 */
import { mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { chromium } from 'playwright-core';

const API = (process.env.API_URL ?? 'http://localhost:3333/api').replace(/\/+$/, '');
const APP = (process.env.APP_URL ?? 'http://localhost:19000').replace(/\/+$/, '');
const shots = process.argv[2] ?? 'portal-screenshots';
mkdirSync(shots, { recursive: true });
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = new pg.Client({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const results = [];
const check = (name, ok, extra = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  — ${extra}` : ''}`);
};
let userId;
let clinicId;

async function main() {
  await db.connect();
  const email = `app-check-${Date.now()}@example.com`;
  const password = `${crypto.randomUUID()}Aa1!`;
  const { data } = await supa.auth.admin.createUser({ email, password, email_confirm: true });
  userId = data.user.id;
  clinicId = (await db.query(`INSERT INTO "Clinic" (id, name, "updatedAt") VALUES (gen_random_uuid(), 'App check clinic', now()) RETURNING id`)).rows[0].id;
  await db.query(`INSERT INTO "User" (id, email, "firstName", "lastName", "updatedAt") VALUES ($1, $2, 'App', 'Doctor', now())`, [userId, email]);
  await db.query(`INSERT INTO "Membership" (id, "userId", "clinicId", role, "updatedAt") VALUES (gen_random_uuid(), $1, $2, 'DOCTOR', now())`, [userId, clinicId]);
  const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const token = (await anon.auth.signInWithPassword({ email, password })).data.session.access_token;
  const call = async (path, init = {}) => {
    const r = await fetch(API + path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  await call('/patients', { method: 'POST', body: JSON.stringify({ firstName: 'Portal', lastName: 'Registered', sex: 'M', ageYears: 70, consent: { care: true, photos: true, noticeVersion: 'dpdp-1' } }) });

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(APP);
    await page.getByLabel('Email').waitFor({ timeout: 60_000 });
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByText('Sign in', { exact: true }).last().click();
    const pulled = await page.getByText('Portal Registered').first().waitFor({ timeout: 30_000 }).then(() => true, () => false);
    await page.screenshot({ path: `${shots}/app-list.png` });
    check('after signing in, the app shows the patient registered in the portal', pulled);

    await page.getByText('Add patient').first().click();
    await page.getByLabel('First name').fill('Phone');
    await page.getByLabel('Last name').fill('Registered');
    await page.getByLabel('Patient ID').fill('APP-1');
    await page.getByLabel('Day of birth').fill('02');
    await page.getByLabel('Month of birth').fill('03');
    await page.getByLabel('Year of birth').fill('1961');
    await page.getByRole('radio', { name: 'Female' }).click();
    await page.getByRole('checkbox', { name: 'Care records and wound photos' }).click();
    await page.screenshot({ path: `${shots}/app-intake.png` });
    await page.getByText('Create patient').last().click();

    let onServer = null;
    for (let i = 0; i < 20 && !onServer; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      onServer = (await call('/patients?q=phone')).body?.items?.find((p) => p.patientId === 'APP-1') ?? null;
    }
    check('a patient registered in the app reaches the server', !!onServer, onServer ? `${onServer.firstName} ${onServer.lastName}` : 'not found');
    await page.goBack().catch(() => undefined);
    await page.screenshot({ path: `${shots}/app-after.png` });
    check('no errors in the app', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
  }
}

try {
  await main();
} catch (e) {
  check('ran to the end', false, e.message);
} finally {
  if (clinicId) await db.query(`DELETE FROM "Clinic" WHERE id = $1`, [clinicId]);
  if (userId) {
    await db.query(`DELETE FROM "User" WHERE id = $1`, [userId]).catch(() => undefined);
    await supa.auth.admin.deleteUser(userId);
  }
  await db.end();
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
}
