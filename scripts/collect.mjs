import fs from 'node:fs';
import path from 'node:path';

const SYMBOLS = [
  { sym: 'BTCUSDT', usdc: 'BTCUSDC', coin: 'BTC', okxSwap: 'BTC-USDT-SWAP', okxUsd: 'BTC-USD-SWAP', coinMult: 100 },
  { sym: 'ETHUSDT', usdc: 'ETHUSDC', coin: 'ETH', okxSwap: 'ETH-USDT-SWAP', okxUsd: 'ETH-USD-SWAP', coinMult: 10 }
];

async function fetchJson(url, opts = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getWhaleSummary(coin, price) {
  const lb = await fetchJson('https://stats-data.hyperliquid.xyz/Mainnet/leaderboard', {}, 15000);
  const rows = lb && Array.isArray(lb.leaderboardRows) ? lb.leaderboardRows : [];
  const topAddrs = rows
    .map(r => ({ addr: r.ethAddress, val: Number(r.accountValue) || 0 }))
    .filter(x => x.addr)
    .sort((a, b) => b.val - a.val)
    .slice(0, 40)
    .map(x => x.addr);

  let longUsd = 0, shortUsd = 0, mL = 0, mS = 0, pL = 0, pS = 0, liqL = 0, liqS = 0, nLiq = 0, wallets = 0;

  for (let i = 0; i < topAddrs.length; i += 8) {
    const batch = topAddrs.slice(i, i + 8);
    await Promise.all(batch.map(async (user) => {
      const state = await fetchJson('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'clearinghouseState', user })
      }, 8000);
      const positions = state && Array.isArray(state.assetPositions) ? state.assetPositions : [];
      for (const item of positions) {
        const p = item && item.position;
        if (!p || p.coin !== coin) continue;
        const szi = Number(p.szi) || 0;
        const val = Math.abs(Number(p.positionValue) || 0);
        if (!szi || !val) continue;
        wallets++;
        const lq = Number(p.liquidationPx) || 0;
        const nearLiq = price > 0 && lq > 0 && Math.abs(lq - price) / price <= 0.05;
        if (szi > 0) {
          longUsd += val;
          mL += Number(p.marginUsed) || 0;
          pL += Number(p.unrealizedPnl) || 0;
          if (nearLiq) { liqL += val; nLiq++; }
        } else {
          shortUsd += val;
          mS += Number(p.marginUsed) || 0;
          pS += Number(p.unrealizedPnl) || 0;
          if (nearLiq) { liqS += val; nLiq++; }
        }
      }
    }));
  }

  return {
    long: Math.round(longUsd),
    short: Math.round(shortUsd),
    total: Math.round(longUsd + shortUsd),
    mL: Math.round(mL),
    mS: Math.round(mS),
    pL: Math.round(pL),
    pS: Math.round(pS),
    liqL: Math.round(liqL),
    liqS: Math.round(liqS),
    nLiq,
    wallets,
    n: topAddrs.length
  };
}

async function main() {
  const nowIso = new Date().toISOString();
  const out = { updatedAt: nowIso, coins: {} };

  for (const cfg of SYMBOLS) {
    const [binPrem, binOi, binUsdcOi, binCoinOi, okxSwapOi, okxUsdOi] = await Promise.all([
      fetchJson(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${cfg.sym}`),
      fetchJson(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${cfg.sym}`),
      fetchJson(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${cfg.usdc}`),
      fetchJson(`https://dapi.binance.com/dapi/v1/openInterest?symbol=${cfg.coin}_USD_PERP`),
      fetchJson(`https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=${cfg.okxSwap}`),
      fetchJson(`https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=${cfg.okxUsd}`)
    ]);

    const price = Number(binPrem && binPrem.markPrice) || 0;
    const binanceTotalOi =
      (Number(binOi && binOi.openInterest) || 0) * price +
      (Number(binUsdcOi && binUsdcOi.openInterest) || 0) * price +
      (Number(binCoinOi && binCoinOi.openInterest) || 0) * cfg.coinMult;

    const okxTotalOi =
      (Number(okxSwapOi && okxSwapOi.data && okxSwapOi.data[0] && okxSwapOi.data[0].oiUsd) || 0) +
      (Number(okxUsdOi && okxUsdOi.data && okxUsdOi.data[0] && okxUsdOi.data[0].oiUsd) || 0);

    const whales = await getWhaleSummary(cfg.coin, price);

    out.coins[cfg.coin] = {
      symbol: cfg.sym,
      price,
      binanceOiUsd: Math.round(binanceTotalOi),
      okxOiUsd: Math.round(okxTotalOi),
      whales
    };
  }

  fs.writeFileSync('radar-snapshot.json', JSON.stringify(out, null, 2));

  const histDir = path.join('history', nowIso.slice(0, 10));
  fs.mkdirSync(histDir, { recursive: true });
  const stamp = nowIso.replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(histDir, `${stamp}.json`), JSON.stringify(out));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
