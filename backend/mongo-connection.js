import { Resolver } from 'node:dns/promises';

const transientDnsErrors = new Set(['ETIMEOUT', 'ESERVFAIL', 'ECONNREFUSED', 'EREFUSED']);
const providers = ['https://dns.google/resolve', 'https://cloudflare-dns.com/dns-query'];

// Resolve only public Atlas hosts. No credentials or database contents are sent
// to DNS providers; the configured URI stays unchanged and TLS stays enabled.
export async function atlasConnectionUri(uri, { resolver = new Resolver({ timeout: 2000, tries: 1 }), fetchDns = fetch } = {}) {
  if (!uri.startsWith('mongodb+srv://')) return uri;
  const parsed = new URL(uri);
  if (!parsed.hostname.endsWith('.mongodb.net')) return uri;
  const lookup = async (name, type) => {
    try {
      return type === 'SRV' ? await resolver.resolveSrv(name) : (await resolver.resolveTxt(name)).map(chunks => chunks.join(''));
    } catch (error) {
      if (type === 'TXT' && error.code === 'ENODATA') return [];
      if (!transientDnsErrors.has(error.code)) throw error;
      for (const provider of providers) {
        try {
          const url = new URL(provider); url.searchParams.set('name', name); url.searchParams.set('type', type);
          const response = await fetchDns(url, { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(7000) });
          if (!response.ok) continue;
          const data = await response.json();
          if (data.Status !== 0) continue;
          const answers = (data.Answer || []).filter(answer => answer.type === (type === 'SRV' ? 33 : 16));
          if (type === 'TXT') return answers.map(answer => {
            const chunks = answer.data.match(/"(?:[^"\\]|\\.)*"/g);
            return chunks ? chunks.map(chunk => JSON.parse(chunk)).join('') : answer.data;
          });
          return answers.map(answer => { const parts = answer.data.trim().split(/\s+/); return { port: Number(parts[2]), name: parts[3]?.replace(/\.$/, '') }; });
        } catch { /* Try the other HTTPS DNS provider. */ }
      }
      throw new Error('Atlas DNS lookup failed. Check the network connection and retry.');
    }
  };
  const service = parsed.searchParams.get('srvServiceName') || 'mongodb';
  const [servers, records] = await Promise.all([lookup(`_${service}._tcp.${parsed.hostname}`, 'SRV'), lookup(parsed.hostname, 'TXT')]);
  if (!servers.length || records.length > 1) throw new Error('Invalid Atlas DNS records');
  const parentDomain = parsed.hostname.split('.').slice(1).join('.');
  for (const server of servers) {
    if (!server.name?.endsWith('.' + parentDomain) || !Number.isInteger(server.port) || server.port < 1 || server.port > 65535) throw new Error('Invalid Atlas DNS server');
  }
  const query = new URLSearchParams(records[0] || '');
  for (const key of query.keys()) if (!['authSource', 'replicaSet', 'loadBalanced'].includes(key)) throw new Error('Invalid Atlas DNS configuration');
  for (const [key, value] of parsed.searchParams) query.set(key, value);
  const maxHosts = Number(query.get('srvMaxHosts') || 0);
  query.delete('srvMaxHosts'); query.delete('srvServiceName');
  if (!query.has('tls') && !query.has('ssl')) query.set('tls', 'true');
  const hosts = (maxHosts > 0 ? servers.slice(0, maxHosts) : servers).map(server => `${server.name}:${server.port}`).join(',');
  const credentials = parsed.username ? `${parsed.username}${parsed.password ? ':' + parsed.password : ''}@` : '';
  return `mongodb://${credentials}${hosts}${parsed.pathname || '/'}?${query}`;
}
