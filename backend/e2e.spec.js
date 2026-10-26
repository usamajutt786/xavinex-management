import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { MongoClient } from 'mongodb';
import { testUri } from './test-database.js';

async function verifyMongoDocuments(snapshot) {
  const { databaseName } = JSON.parse(await readFile(new URL('./.e2e-database.json', import.meta.url), 'utf8'));
  if (!/^xavinex_e2e_[a-f0-9]{24}$/.test(databaseName)) throw new Error('Expected an isolated browser-test database');
  // This is a fresh, independent MongoDB client, not the API or the React cache.
  const client = new MongoClient(testUri);
  const stripStorageFields = ({ _id, _order, ...record }) => record;
  const sorted = rows => [...rows].sort((a, b) => a.id.localeCompare(b.id));
  try {
    await client.connect();
    const db = client.db(databaseName);
    for (const name of ['accounts', 'clients', 'projects', 'payments', 'transfers', 'expenses', 'adjustments', 'transactions']) {
      const documents = await db.collection(name).find({}).toArray();
      expect(sorted(documents.map(stripStorageFields)), `MongoDB ${name} documents match the API snapshot`).toEqual(sorted(snapshot[name]));
      expect(documents.every(record => record._id === record.id)).toBe(true);
    }
    expect(stripStorageFields(await db.collection('settings').findOne({ _id: 'app' }))).toEqual(snapshot.settings);
  } finally { await client.close(); }
}

async function signIn(page) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('browser@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Browser-test-password-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Executive Financial Dashboard' })).toBeVisible();
}

test('dashboard locks full project budgets by confirmation month independently of later payments', async ({ page }) => {
  await signIn(page);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const month = today.slice(0, 7);
  const year = Number(today.slice(0, 4));
  const prior = `${year - 1}-12-15`;
  const { csrfToken } = await (await page.request.get('/api/auth/me')).json();
  const write = async (path, data) => {
    const response = await page.request.post(`/api/${path}`, { data, headers: { 'X-CSRF-Token': csrfToken, Origin: 'http://127.0.0.1:4101' } });
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()).data;
  };
  const account = await write('accounts', { name: 'Locked business test account', type: 'fiverr', currency: 'USD', openingBalance: 0, status: 'active' });
  const client = await write('clients', { name: 'Repeat business client', linkedFiverrAccountId: account.id, status: 'active' });
  const old = await write('projects', { name: 'Earlier confirmed order', clientId: client.id, budget: 1000, currency: 'USD', bookingDate: prior, status: 'in_progress' });
  await write('projects', { name: 'New confirmed order', clientId: client.id, budget: 1000, currency: 'USD', bookingDate: today, status: 'queued' });
  await page.reload();
  const locked = page.getByTestId('current-month-business-locked');
  await expect(locked).toHaveText('$1,000.00');
  await expect(page.getByRole('heading', { name: 'Monthly Business Locked', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Monthly confirmed project value in USD' })).toBeVisible();
  await write('payments', { clientId: client.id, projectId: old.id, paymentAmount: 1000, currency: 'USD', paymentDate: today, receivingAccountId: account.id, paymentRoute: 'fiverr', actualCreditedAmount: 800 });
  await page.reload();
  await expect(locked).toHaveText('$1,000.00');
  const report = await (await page.request.get(`/api/reports?clientId=${client.id}`)).json();
  expect(report.monthly.find(row => row.month === prior.slice(0, 7))).toMatchObject({ bookedUSD: 1000, collectedUSD: 0 });
  expect(report.monthly.find(row => row.month === month)).toMatchObject({ bookedUSD: 1000, collectedUSD: 1000 });
  await verifyMongoDocuments(await (await page.request.get('/api/state')).json());
  // Keep the existing browser workflows independent of these records.
  const reset = await page.request.delete('/api/data', { data: { confirm: 'DELETE ALL BUSINESS DATA' }, headers: { 'X-CSRF-Token': csrfToken, Origin: 'http://127.0.0.1:4101' } });
  expect(reset.ok()).toBe(true);
});

test('real browser login, account creation, client/project booking, payments, reports, settings and logout', async ({ page }) => {
  test.setTimeout(180000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async d => { errors.push(d.message()); await d.dismiss(); });
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('browser@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Browser-test-password-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Executive Financial Dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Fiverr Accounts', exact: true }).click();
  await page.getByRole('button', { name: 'Add Fiverr Account', exact: true }).click();
  const form = page.locator('form').last();
  await form.locator('input[type="text"]').first().fill('Browser Fiverr');
  await form.getByRole('button', { name: /Create Account/ }).click();
  await expect(page.getByText('Browser Fiverr', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clients', exact: true }).click();
  await page.getByRole('button', { name: /Add.*Client|Create.*Client/ }).last().click();
  await form.locator('input[type="text"]').first().fill('Browser Client');
  await form.getByRole('button', { name: /Create Client/ }).click();
  await expect(page.getByText('Browser Client', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'Book Project', exact: true }).last().click();
  await form.locator('input[type="text"]').first().fill('Browser Project');
  await form.getByRole('button', { name: /Create Project|Book Project/ }).click();
  await expect(page.getByText('Browser Project', { exact: true }).first()).toBeVisible();
  const bookedState = await (await page.request.get('/api/state')).json();
  expect(bookedState.accounts[0].currentBalance).toBe(1000);
  expect(bookedState.payments).toHaveLength(0);
  await page.getByRole('button', { name: 'Record Payment', exact: true }).click();
  await form.locator('select').nth(0).selectOption({ label: 'Browser Client' });
  await form.locator('select').nth(1).selectOption({ index: 1 });
  await form.locator('input[value="fiverr"]').check();
  await form.locator('input[type="number"]').nth(0).fill('100');
  await form.locator('input[type="number"]').nth(1).fill('80');
  await form.locator('button[type="submit"]').click();
  await page.getByRole('button', { name: 'Confirm & Post Payment' }).click();
  await expect(page.getByRole('heading', { name: 'Record Client Payment' })).toHaveCount(0);
  const state = await (await page.request.get('/api/state')).json();
  expect(state.payments).toHaveLength(1);
  expect(state.accounts[0].currentBalance).toBe(980);
  await verifyMongoDocuments(state);
  // Create receiving accounts through the UI, then move the collected money to an expense account.
  await page.getByRole('button', { name: 'Payoneer Accounts', exact: true }).click();
  await page.getByRole('button', { name: 'Add Payoneer Account', exact: true }).click();
  await form.locator('input[type="text"]').first().fill('Browser Payoneer');
  await form.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(page.getByText('Browser Payoneer', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Bank & Cash', exact: true }).click();
  await page.getByRole('button', { name: 'Add Bank', exact: true }).click();
  await form.locator('input[type="text"]').first().fill('Browser Bank');
  await form.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(page.getByText('Browser Bank', { exact: true })).toBeVisible();
  for (const [source, destination, amount] of [['Browser Fiverr', 'Browser Payoneer', '60'], ['Browser Payoneer', 'Browser Bank', '50']]) {
    await page.getByRole('button', { name: 'Fund Transfer', exact: true }).click();
    const sourceOption = await form.locator('select').nth(0).locator('option').filter({ hasText: source }).getAttribute('value');
    await form.locator('select').nth(0).selectOption(sourceOption);
    const destinationOption = await form.locator('select').nth(1).locator('option').filter({ hasText: destination }).getAttribute('value');
    await form.locator('select').nth(1).selectOption(destinationOption);
    await form.locator('input[type="number"]').nth(0).fill(amount);
    await form.locator('input[type="number"]').nth(1).fill(amount);
    await form.locator('button[type="submit"]').click();
    await page.getByRole('button', { name: 'Confirm & Execute Transfer' }).click();
    await expect(page.getByRole('heading', { name: /Transfer.*Funds|Fund Transfer|Record.*Transfer/ })).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Record Expense', exact: true }).click();
  await form.locator('input[type="text"]').first().fill('Browser office expense');
  await form.locator('input[type="number"]').fill('10');
  await form.getByRole('button', { name: 'Record Expense', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Record.*Expense/ })).toHaveCount(0);
  const finalState = await (await page.request.get('/api/state')).json();
  expect(finalState.transfers).toHaveLength(2); expect(finalState.expenses).toHaveLength(1);
  expect(finalState.accounts.find(a => a.name === 'Browser Bank').currentBalance).toBe(40);
  await verifyMongoDocuments(finalState);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Executive Financial Dashboard' })).toBeVisible();
  await expect(page.getByText('Total Current Balance', { exact: true }).locator('..').locator('..').locator('..')).toContainText('$970.00');
  await verifyMongoDocuments(await (await page.request.get('/api/state')).json());
  for (const name of ['Clients', 'Projects', 'Business Pipeline', 'Fiverr Accounts', 'Payoneer Accounts', 'Bank & Cash', 'Fund Transfers', 'Expenses', 'Analytics & Graphs', 'Reports', 'Settings']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('main')).toBeVisible();
    if (name === 'Analytics & Graphs') {
      for (const tab of ['Revenue & Bookings', 'Cash Flow & Deductions', 'Account Balances & Funds', 'Expenses & Burn Rate', 'Clients & Fiverr Performance']) await page.getByRole('button', { name: tab, exact: true }).click();
    }
    if (name === 'Reports') {
      const reportSelect = page.locator('main select').first();
      for (const value of await reportSelect.locator('option').evaluateAll(options => options.map(o => o.value))) {
        await reportSelect.selectOption(value);
        await expect(page.locator('main')).toBeVisible();
      }
    }
  }
  await page.getByRole('button', { name: /Save.*Rate|Update.*Rate/ }).click();
  await page.getByRole('button', { name: 'Account & access', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workspace users' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Settings rates and categories persist; invalid files are rejected; backup restore synchronizes inputs', async ({ page }) => {
  test.setTimeout(180000);
  await signIn(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const storagePanel = page.getByRole('region', { name: 'MongoDB storage' });
  await expect(storagePanel.getByLabel('MongoDB Compass connection', { exact: true })).toHaveValue(/^mongodb:\/\/127\.0\.0\.1:27018\/xavinex_e2e_/);
  await expect(storagePanel.getByLabel('Stored record counts')).toBeVisible();
  const rates = page.locator('main input[type="number"]');
  await rates.nth(0).fill('280');
  await page.getByRole('button', { name: 'Save Exchange Rates' }).click();
  await expect(page.getByText('Rates Updated', { exact: true })).toBeVisible();
  const category = page.getByPlaceholder('Add new custom category (e.g. Legal & Compliance)...');
  await category.fill('Browser test category');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const categoryTag = page.locator('span').filter({ hasText: /^Browser test category/ });
  await expect(categoryTag).toBeVisible();
  await category.fill('browser TEST category');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Category already exists.' })).toBeVisible();
  await categoryTag.locator('button[title="Remove Category"]').click();
  await expect(categoryTag).toHaveCount(0);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Complete Backup (JSON)' }).click();
  const download = await downloadEvent;
  const contents = await readFile(await download.path());
  const backup = JSON.parse(contents.toString());
  expect(backup.settings.exchangeRates.PKR).toBe(280);
  const upload = page.locator('input[type="file"]');
  await upload.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect(page.getByRole('alert').filter({ hasText: 'Invalid JSON file:' })).toBeVisible();
  await rates.nth(0).fill('281');
  await page.getByRole('button', { name: 'Save Exchange Rates' }).click();
  await expect(page.getByText('Rates Updated', { exact: true })).toBeVisible();
  await upload.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: contents });
  await expect(page.getByText('Backup data successfully restored!', { exact: true })).toBeVisible();
  await expect(rates.nth(0)).toHaveValue('280');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Executive Financial Dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('main input[type="number"]').nth(0)).toHaveValue('280');
});

test('login reports backend unavailability and offers a working retry', async ({ page }) => {
  await page.route('**/api/auth/status', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'The backend is unavailable. Run npm run dev from the project folder, then retry.' } }) }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('backend is unavailable');
  await page.unroute('**/api/auth/status');
  await page.getByRole('button', { name: 'Retry connection' }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
});

test('account edits, balance corrections, ledger exports, client profile and project edits persist', async ({ page }) => {
  test.setTimeout(180000);
  await signIn(page);
  await page.getByRole('button', { name: 'Bank & Cash', exact: true }).click();
  await page.getByTitle('Edit Account Details', { exact: true }).click();
  const form = page.locator('form').last();
  await form.locator('input[type="text"]').first().fill('Browser Bank Updated');
  await form.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(page.getByText('Browser Bank Updated', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Balance', exact: true }).click();
  await form.locator('input[type="number"]').fill('60');
  await form.locator('input[type="text"]').fill('Browser cash count');
  await form.getByRole('button', { name: 'Review Changes', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm & Save Adjustment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit Account Balance' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Balance', exact: true }).click();
  await page.getByRole('button', { name: 'Correct Opening Balance', exact: true }).click();
  await form.locator('input[type="number"]').fill('5');
  await form.getByRole('button', { name: 'Review Changes', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm & Save Adjustment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit Account Balance' })).toHaveCount(0);
  const state = await (await page.request.get('/api/state')).json();
  expect(state.accounts.find(a => a.name === 'Browser Bank Updated').currentBalance).toBe(65);
  await page.getByRole('button', { name: /Ledger/ }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const csv = (await readFile(await (await downloadEvent).path())).toString();
  expect(csv).toContain('manual_balance_adjustment'); expect(csv).toContain('Browser Bank Updated');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Clients', exact: true }).click();
  await page.getByRole('button', { name: 'View Profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Browser Client', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByTitle('Edit Client', { exact: true }).click();
  await form.locator('input[type="text"]').first().fill('Browser Client Updated');
  await form.locator('button[type="submit"]').click();
  await expect(page.getByText('Browser Client Updated', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByTitle('Edit Project', { exact: true }).click();
  await form.locator('input[type="text"]').first().fill('Browser Project Updated');
  await form.getByRole('button', { name: 'Save Project', exact: true }).click();
  await expect(page.getByText('Browser Project Updated', { exact: true }).first()).toBeVisible();
});

test('signup creates a company with email and password; users can log out and sign back in', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await expect(page.locator('form input')).toHaveCount(3);
  await page.getByLabel('Company name', { exact: true }).fill('Registered Browser Company');
  const email = 'registered-browser@example.com';
  const password = 'Registered-browser-password-123!';
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const registration = page.waitForResponse(response => response.url().endsWith('/api/auth/register') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  const response = await registration;
  expect(response.status()).toBe(201);
  expect(Object.keys(response.request().postDataJSON()).sort()).toEqual(['companyName', 'email', 'password']);
  await expect(page.getByRole('heading', { name: 'Executive Financial Dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Incorrect-password-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Executive Financial Dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Company name', { exact: true }).fill('Duplicate Company');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Email already exists');
});

test('Bank payment dropdown includes other currencies and converts USD receipts into PKR automatically', async ({ page }) => {
  await signIn(page);
  const { csrfToken } = await (await page.request.get('/api/auth/me')).json();
  const create = async (path, data) => {
    const response = await page.request.post('/api/' + path, { data, headers: { 'X-CSRF-Token': csrfToken, Origin: 'http://127.0.0.1:4101' } });
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()).data;
  };
  const account = (name, type, currency = 'USD', status = 'active') => create('accounts', { name, type, currency, status, openingBalance: 0 });
  const fiverr = await account('Bank receipt origin', 'fiverr');
  const bank1 = await account('Client Receipt Bank One', 'bank');
  const bank2 = await account('Client Receipt Bank Two', 'bank', 'PKR');
  await account('Inactive Bank Hidden', 'bank', 'USD', 'inactive');
  await account('Other Currency Bank', 'bank', 'EUR');
  await account('Cash Hidden', 'petty_cash');
  const client = await create('clients', { name: 'Bank Browser Client', linkedFiverrAccountId: fiverr.id, status: 'active' });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const project = await create('projects', { name: 'Bank Browser Project', clientId: client.id, budget: 1000, currency: 'USD', bookingDate: today, status: 'in_progress' });
  await page.reload();
  await page.getByRole('button', { name: 'Record Payment', exact: true }).click();
  const form = page.locator('form').last();
  await form.locator('select').nth(0).selectOption(client.id);
  await form.locator('select').nth(1).selectOption(project.id);
  await form.locator('input[value="bank_direct"]').check();
  const receiving = form.locator('select').nth(2);
  const options = await receiving.locator('option').evaluateAll(rows => rows.map(row => row.value).filter(Boolean));
  expect(options).toEqual(expect.arrayContaining([bank1.id, bank2.id]));
  const stateBefore = await (await page.request.get('/api/state')).json();
  expect(options.sort()).toEqual(stateBefore.accounts.filter(a => a.type === 'bank' && a.status === 'active').map(a => a.id).sort());
  await receiving.selectOption(bank2.id);
  await form.locator('input[type="number"]').nth(0).fill('250');
  const convertedAmount = Math.round(250 * stateBefore.settings.exchangeRates.PKR * 100) / 100;
  await expect(form.locator('input[type="number"]').nth(1)).toHaveValue(convertedAmount.toFixed(2));
  await expect(form.locator('input[type="number"]').nth(1)).toHaveAttribute('readonly', '');
  await form.locator('button[type="submit"]').click();
  await expect(page.getByText('Direct Bank Credit', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm & Post Payment' }).click();
  await expect(page.getByRole('heading', { name: 'Record Client Payment' })).toHaveCount(0);
  await page.reload();
  const state = await (await page.request.get('/api/state')).json();
  expect(state.accounts.find(a => a.id === bank2.id).currentBalance).toBe(convertedAmount);
  expect(state.accounts.find(a => a.id === bank1.id).currentBalance).toBe(0);
  expect(state.accounts.find(a => a.id === fiverr.id).currentBalance).toBe(750);
  expect(state.payments.find(p => p.projectId === project.id)).toMatchObject({ paymentRoute: 'bank_direct', receivingAccountId: bank2.id, paymentAmount: 250, actualCreditedAmount: convertedAmount, receivingCurrency: 'PKR', exchangeRate: stateBefore.settings.exchangeRates.PKR, feeOrDeduction: 0 });
  await verifyMongoDocuments(state);
  await page.getByRole('button', { name: 'Bank & Cash', exact: true }).click();
  await expect(page.getByText('Client Receipt Bank Two', { exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText(`PKR ${convertedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await page.locator('main select').first().selectOption('monthly_collections');
  await expect(page.getByRole('columnheader', { name: /direct bank/i })).toBeVisible();
});

test('browser company signup, isolation, logout and account switching never retain another company’s data', async ({ browser }) => {
  test.setTimeout(120000);
  const contextA = await browser.newContext(), contextB = await browser.newContext();
  const a = await contextA.newPage(), b = await contextB.newPage();
  const password = 'Browser-company-password-123!';
  const signup = async (page, email, companyName) => {
    await page.goto('http://127.0.0.1:4101/');
    await page.getByRole('button', { name: 'Create an account', exact: true }).click();
    await page.getByLabel('Company name', { exact: true }).fill(companyName);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign up', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Executive Financial Dashboard' })).toBeVisible();
    await expect(page.getByText(companyName + ' ·', { exact: false })).toBeVisible();
  };
  const createAccount = async (page, name) => {
    await page.getByRole('button', { name: 'Fiverr Accounts', exact: true }).click();
    await page.getByRole('button', { name: 'Add Fiverr Account', exact: true }).click();
    const form = page.locator('form').last();
    await form.locator('input[type="text"]').first().fill(name);
    await form.getByRole('button', { name: /Create Account/ }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  };
  const login = async (page, email) => {
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Executive Financial Dashboard' })).toBeVisible();
  };
  try {
    await signup(a, 'company-a-browser@example.com', 'Browser Company A');
    await signup(b, 'company-b-browser@example.com', 'Browser Company B');
    await createAccount(a, 'Only Company A Fiverr');
    const stateA = await (await a.request.get('http://127.0.0.1:4101/api/state')).json();
    expect(stateA.accounts).toHaveLength(1);
    expect((await (await b.request.get('http://127.0.0.1:4101/api/state')).json()).accounts).toHaveLength(0);
    expect((await b.request.get('http://127.0.0.1:4101/api/accounts/' + stateA.accounts[0].id)).status()).toBe(404);
    await createAccount(b, 'Only Company B Fiverr');
    const oldTab = await contextA.newPage();
    await oldTab.goto('http://127.0.0.1:4101/');
    await expect(oldTab.getByRole('heading', { name: 'Executive Financial Dashboard' })).toBeVisible();
    await a.getByRole('button', { name: 'Sign out', exact: true }).click();
    await login(a, 'company-b-browser@example.com');
    await a.getByRole('button', { name: 'Fiverr Accounts', exact: true }).click();
    await expect(a.getByText('Only Company B Fiverr', { exact: true })).toBeVisible();
    await expect(a.getByText('Only Company A Fiverr', { exact: true })).toHaveCount(0);
    await oldTab.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(oldTab.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(oldTab.getByText('Only Company B Fiverr', { exact: true })).toHaveCount(0);
    await a.getByRole('button', { name: 'Sign out', exact: true }).click();
    await login(a, 'company-a-browser@example.com');
    await a.getByRole('button', { name: 'Fiverr Accounts', exact: true }).click();
    await expect(a.getByText('Only Company A Fiverr', { exact: true })).toBeVisible();
    await expect(a.getByText('Only Company B Fiverr', { exact: true })).toHaveCount(0);
  } finally { await contextA.close(); await contextB.close(); }
});
