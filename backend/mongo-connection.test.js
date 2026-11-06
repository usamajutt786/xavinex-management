import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atlasConnectionUri } from './mongo-connection.js';

const srv = [{ name: 'cluster-shard-00.example.mongodb.net', port: 27017 }];
const native = { resolveSrv: async () => srv, resolveTxt: async () => [['authSource=admin&replicaSet=atlas-test']] };
const uri = 'mongodb+srv://user:encoded%40password@cluster.example.mongodb.net/company?retryWrites=true';

test('Atlas resolution preserves credentials, database, options and TLS without repeating driver TXT queries', async () => {
  const resolved = new URL(await atlasConnectionUri(uri, { resolver: native, fetchDns: () => assert.fail('Unexpected external DNS call') }));
  assert.equal(resolved.protocol, 'mongodb:');
  assert.equal(resolved.hostname, srv[0].name);
  assert.equal(resolved.port, '27017');
  assert.equal(resolved.username, 'user'); assert.equal(resolved.password, 'encoded%40password');
  assert.equal(resolved.pathname, '/company');
  assert.equal(resolved.searchParams.get('tls'), 'true');
  assert.equal(resolved.searchParams.get('authSource'), 'admin');
  assert.equal(resolved.searchParams.get('replicaSet'), 'atlas-test');
  assert.equal(resolved.searchParams.get('retryWrites'), 'true');
});

test('TXT timeout uses bounded HTTPS DNS, sends only the public hostname and respects explicit options', async () => {
  let requests = 0;
  const resolver = { ...native, resolveTxt: async () => { throw Object.assign(new Error('Timed out'), { code: 'ETIMEOUT' }); } };
  const fetchDns = async (url, options) => {
    requests++;
    assert.equal(url.searchParams.get('name'), 'cluster.example.mongodb.net');
    assert.equal(url.searchParams.get('type'), 'TXT');
    assert.equal(url.toString().includes('password'), false);
    assert.ok(options.signal);
    return { ok: true, json: async () => ({ Status: 0, Answer: [{ type: 16, data: '"authSource=admin&" "replicaSet=atlas-test"' }] }) };
  };
  const resolved = new URL(await atlasConnectionUri(uri + '&authSource=custom', { resolver, fetchDns }));
  assert.equal(resolved.searchParams.get('authSource'), 'custom');
  assert.equal(resolved.searchParams.get('replicaSet'), 'atlas-test');
  assert.equal(requests, 1);
});

test('direct and private MongoDB addresses never trigger public DNS fallbacks', async () => {
  const resolver = { resolveSrv: () => assert.fail('Unexpected lookup'), resolveTxt: () => assert.fail('Unexpected lookup') };
  for (const value of ['mongodb://127.0.0.1:27018/app', 'mongodb+srv://user:secret@private.internal/app']) assert.equal(await atlasConnectionUri(value, { resolver }), value);
});

test('invalid DNS targets and failed DNS providers do not expose credentials or silently change clusters', async () => {
  await assert.rejects(atlasConnectionUri(uri, { resolver: { ...native, resolveSrv: async () => [{ name: 'untrusted.example.org', port: 27017 }] } }), /Invalid Atlas DNS server/);
  const resolver = { ...native, resolveTxt: async () => { throw Object.assign(new Error('Timed out'), { code: 'ETIMEOUT' }); } };
  await assert.rejects(atlasConnectionUri(uri, { resolver, fetchDns: async () => ({ ok: false }) }), error => /Atlas DNS lookup failed/.test(error.message) && !error.message.includes('password'));
});
