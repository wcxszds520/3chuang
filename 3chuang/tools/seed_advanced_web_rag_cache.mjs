import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(process.cwd());
const CACHE_DIR = path.join(ROOT, 'docs', 'advanced_optimization', 'rag-cache');

fs.mkdirSync(CACHE_DIR, { recursive: true });

function expandQuery(query) {
  const rules = [
    [/VGM|SOLAS/i, 'SOLAS verified gross mass container shipping'],
    [/CTU|装载规范/i, 'CTU Code cargo transport unit packing guideline'],
    [/IPPC|木包装|熏蒸/i, 'IPPC ISPM 15 wood packaging mark'],
    [/重心|偏载|weight distribution/i, 'container weight distribution center of gravity'],
    [/危险品|dangerous/i, 'container packing dangerous goods declaration'],
    [/单证|一致性|document/i, 'shipping documents packing list consistency']
  ];
  const additions = rules
    .filter(([pattern]) => pattern.test(query))
    .map(([, addition]) => addition);
  return [...new Set([query, ...additions])].join(' ');
}

function cacheKey(query) {
  return crypto.createHash('sha1').update(query).digest('hex');
}

const references = {
  imoVgm: {
    title: 'Verification of the gross mass of a packed container',
    url: 'https://www.imo.org/en/OurWork/Safety/Pages/Verification-of-the-gross-mass.aspx',
    domain: 'imo.org',
    snippet: 'IMO explains the SOLAS amendment requiring mandatory verification of the gross mass of packed containers before vessel loading.',
    score: 0.96,
    credibility: 'official'
  },
  imoCtu: {
    title: 'IMO/ILO/UNECE Code of Practice for Packing of Cargo Transport Units',
    url: 'https://www.imo.org/en/ourwork/safety/pages/ctu-code.aspx',
    domain: 'imo.org',
    snippet: 'The CTU Code covers packing and securing cargo across intermodal transport and includes training and dangerous goods considerations.',
    score: 0.94,
    credibility: 'official'
  },
  uneceCtu: {
    title: 'IMO/ILO/UNECE Code of Practice for Packing of Cargo Transport Units',
    url: 'https://unece.org/transport/intermodal-transport/imoilounece-code-practice-packing-cargo-transport-units-ctu-code',
    domain: 'unece.org',
    snippet: 'UNECE describes the CTU Code as an update of earlier packing guidelines endorsed by the IMO Maritime Safety Committee.',
    score: 0.92,
    credibility: 'official'
  },
  ippcIspm15: {
    title: 'Explanatory document for ISPM 15',
    url: 'https://www.ippc.int/static/media/files/publication/en/2017/02/ISPM_15_ED_En_2017-02-10.pdf',
    domain: 'ippc.int',
    snippet: 'IPPC explains ISPM 15 measures for wood packaging, including treatment and the internationally recognized compliance mark.',
    score: 0.95,
    credibility: 'official'
  },
  cbpWood: {
    title: 'Import and Export Requirements for Wood Packaging Material',
    url: 'https://www.help.cbp.gov/s/article/Article-1200?language=en_US',
    domain: 'help.cbp.gov',
    snippet: 'U.S. CBP references ISPM 15 marking requirements for wood packaging material used in international trade.',
    score: 0.84,
    credibility: 'official'
  },
  uneceCog: {
    title: 'CTU Code - Principles of packing',
    url: 'https://wiki.unece.org/spaces/TransportSustainableCTUCode/pages/23102046/3%2BPrinciples%2Bof%2Bpacking',
    domain: 'wiki.unece.org',
    snippet: 'UNECE CTU Code guidance says cargo centre of gravity should generally stay close to the container centre, with eccentricity normally within plus or minus 5%.',
    score: 0.93,
    credibility: 'official'
  },
  cmaStuffing: {
    title: 'Best Practices Packing Container',
    url: 'https://www.cma-cgm.com/assets/public/pdf/Lashing.pdf',
    domain: 'cma-cgm.com',
    snippet: 'CMA CGM stuffing guidance discusses lashing, blocking and keeping cargo centre of gravity near the centre of the container.',
    score: 0.75,
    credibility: 'industry'
  },
  ttClubCtu: {
    title: 'CTU Code - a quick guide',
    url: 'https://www.ttclub.com/news-and-resources/publications/article/ctu-code-a-quick-guide/',
    domain: 'ttclub.com',
    snippet: 'TT Club provides CTU Code quick guide materials for safer cargo transport unit packing.',
    score: 0.74,
    credibility: 'industry'
  }
};

const queryMap = {
  'SOLAS VGM': [references.imoVgm],
  'VGM': [references.imoVgm],
  'VGM 申报 误差': [references.imoVgm],
  'CTU Code container packing': [references.imoCtu, references.uneceCtu, references.ttClubCtu],
  'CTU': [references.imoCtu, references.uneceCtu],
  'IPPC wood packaging ISPM 15': [references.ippcIspm15, references.cbpWood],
  'IPPC': [references.ippcIspm15, references.cbpWood],
  '木包装 IPPC 熏蒸 标识': [references.ippcIspm15, references.cbpWood],
  'container weight distribution center of gravity': [references.uneceCog, references.cmaStuffing],
  '集装箱 偏载 重心': [references.uneceCog, references.cmaStuffing],
  'container packing dangerous goods': [references.imoCtu, references.uneceCtu],
  '危险品': [references.imoCtu],
  '集装箱 装箱 单证 一致性': [references.imoVgm, references.imoCtu],
  'IPPC 木包装 ISPM 15 SOLAS VGM CTU Code 单证一致性': [
    references.ippcIspm15,
    references.imoVgm,
    references.imoCtu,
    references.uneceCog,
    references.cbpWood
  ]
};

const generatedAt = new Date().toISOString();
const records = [];

for (const [query, results] of Object.entries(queryMap)) {
  const expanded = expandQuery(query);
  const key = cacheKey(expanded);
  const payload = {
    web_available: true,
    cache_used: false,
    source: 'curated_public_web_cache',
    query,
    expanded_query: expanded,
    generatedAt,
    results,
    source_summary: results.reduce((summary, item) => {
      summary[item.credibility] = (summary[item.credibility] || 0) + 1;
      return summary;
    }, {})
  };
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  records.push({
    query,
    expanded,
    cacheFile: path.relative(ROOT, filePath).replaceAll('\\', '/'),
    resultCount: results.length,
    urls: results.map((item) => item.url)
  });
}

fs.writeFileSync(
  path.join(CACHE_DIR, 'CACHE_SOURCES.md'),
  [
    '# Advanced Web RAG Cache Sources',
    '',
    `生成时间：${generatedAt}`,
    '',
    '说明：这些缓存来自本轮在线检索到的公开网页，用于无 Tavily key 时的录屏稳定参考。它们是缓存快照，不是实时联网检索结果。',
    '',
    '| Query | Cache File | Sources |',
    '| --- | --- | --- |',
    ...records.map((record) => `| ${record.query} | ${record.cacheFile} | ${record.urls.join('<br>')} |`)
  ].join('\n'),
  'utf-8'
);

console.log(JSON.stringify({ cacheFiles: records.length, cacheDir: path.relative(ROOT, CACHE_DIR).replaceAll('\\', '/') }, null, 2));
