import { useEffect, useState } from 'react';
import { useDashboardStream } from './useDashboardStream.js';
import { fetchMe, logout } from './auth.js';
import { Login } from './Login.js';
import { SettingsView } from './Settings.js';
import type { BotRow, DashboardData } from './types.js';

const TABS = [
  { id: 'home', label: 'Resumen', section: 'General' },
  { id: 'settings', label: 'Configuración', section: 'General' },
  { id: 'cesta-topk', label: 'Cesta Top-K', section: 'Estrategias' },
  { id: 'liquidity-maker', label: 'Liquidity Maker', section: 'Estrategias' },
  { id: 'endgame-carry', label: 'Endgame Carry', section: 'Estrategias' },
  { id: 'espejo-smart', label: 'Espejo Smart', section: 'Estrategias' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function statusClass(status: string) {
  return status.toLowerCase().replace('_', '-');
}

function pnlClass(v: number) {
  if (v > 0) return 'pnl-pos';
  if (v < 0) return 'pnl-neg';
  return '';
}

function fmtUsd(v: number) {
  const sign = v >= 0 ? '+' : '';
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function StatusTag({ status }: { status: string }) {
  return (
    <span className={`status-tag ${statusClass(status)}`}>
      {status}
    </span>
  );
}

function BotMetrics({ bot }: { bot: BotRow }) {
  return (
    <dl className="bot-metrics">
      <div className="metric">
        <dt>PnL hoy</dt>
        <dd className={pnlClass(bot.pnl_today)}>{fmtUsd(bot.pnl_today)}</dd>
      </div>
      <div className="metric">
        <dt>PnL total</dt>
        <dd className={pnlClass(bot.pnl_total)}>{fmtUsd(bot.pnl_total)}</dd>
      </div>
      <div className="metric">
        <dt>Ops hoy</dt>
        <dd>{bot.ops_today}</dd>
      </div>
    </dl>
  );
}

function TradesTable({
  trades,
  empty = 'Sin operaciones',
}: {
  trades: DashboardData['trades'];
  empty?: string;
}) {
  if (trades.length === 0) {
    return (
      <div className="data-table-wrap">
        <table className="data-table">
          <tbody>
            <tr>
              <td colSpan={4} className="cell-empty">{empty}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Estrategia</th>
            <th>Acción</th>
            <th>Hora</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.id}>
              <td className="cell-strategy">{t.strategy_id}</td>
              <td className="cell-action">{t.action}</td>
              <td className="cell-time">{fmtTime(t.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HomeView({
  data,
  onSelectBot,
}: {
  data: DashboardData;
  onSelectBot: (id: TabId) => void;
}) {
  return (
    <>
      <div className="panel-grid cols-4">
        <div className="panel">
          <p className="panel-label">Exposición activa</p>
          <p className="panel-value">${data.exposure.toFixed(2)}</p>
        </div>
        <div className="panel">
          <p className="panel-label">PnL del día</p>
          <p className={`panel-value ${pnlClass(data.dailyPnl)}`}>
            {fmtUsd(data.dailyPnl)}
          </p>
        </div>
        <div className="panel">
          <p className="panel-label">Bots activos</p>
          <p className="panel-value sm">
            {data.bots.filter((b) => b.status === 'RUNNING').length}
            <span style={{ color: 'var(--text-dim)', fontSize: 13 }}> / {data.bots.length}</span>
          </p>
        </div>
        <div className="panel">
          <p className="panel-label">Operaciones hoy</p>
          <p className="panel-value sm">
            {data.bots.reduce((s, b) => s + b.ops_today, 0)}
          </p>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h2 className="section-title">Estrategias</h2>
        </div>
        <div className="bot-grid">
          {data.bots.map((b) => (
            <button
              key={b.strategy_id}
              type="button"
              className="bot-card"
              onClick={() => onSelectBot(b.strategy_id as TabId)}
            >
              <div className="bot-card-header">
                <div>
                  <p className="bot-card-name">
                    {data.strategies[b.strategy_id]?.label ?? b.strategy_id}
                  </p>
                  <p className="bot-card-id">{b.strategy_id}</p>
                </div>
                <StatusTag status={b.status} />
              </div>
              {b.message && (
                <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 0.75rem' }}>
                  {b.message}
                </p>
              )}
              <BotMetrics bot={b} />
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h2 className="section-title">Alertas</h2>
          <span className="section-count">{data.alerts.length}</span>
        </div>
        <div className="data-table-wrap">
          {data.alerts.length === 0 ? (
            <div className="alert-row">
              <span className="alert-body" style={{ color: 'var(--text-dim)' }}>
                Sin alertas activas
              </span>
            </div>
          ) : (
            data.alerts.map((a) => (
              <div key={a.id} className="alert-row">
                <span className={`alert-level ${a.level}`}>{a.level}</span>
                <span className="alert-body">
                  {a.strategy_id && <strong>{a.strategy_id} · </strong>}
                  {a.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h2 className="section-title">Actividad reciente</h2>
          <span className="section-count">{data.trades.length}</span>
        </div>
        <TradesTable trades={data.trades.slice(0, 20)} />
      </div>
    </>
  );
}

function BotDetailView({ data, tab }: { data: DashboardData; tab: TabId }) {
  const bot = data.bots.find((b) => b.strategy_id === tab)!;
  const stats = data.strategyStats?.[tab];
  const botTrades = data.trades.filter((t) => t.strategy_id === tab);

  return (
    <>
      <div className="detail-header">
        <div>
          <h2 className="detail-title">
            {data.strategies[tab]?.label ?? tab}
          </h2>
          <p className="detail-sub">{tab}</p>
        </div>
        <StatusTag status={bot.status} />
      </div>

      {bot.message && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 1rem' }}>
          {bot.message}
        </p>
      )}

      <div className="metrics-row">
        <div className="panel">
          <p className="panel-label">PnL hoy</p>
          <p className={`panel-value sm ${pnlClass(bot.pnl_today)}`}>
            {fmtUsd(bot.pnl_today)}
          </p>
        </div>
        <div className="panel">
          <p className="panel-label">PnL total</p>
          <p className={`panel-value sm ${pnlClass(bot.pnl_total)}`}>
            {fmtUsd(bot.pnl_total)}
          </p>
        </div>
        <div className="panel">
          <p className="panel-label">Operaciones hoy</p>
          <p className="panel-value sm">{bot.ops_today}</p>
        </div>
        {stats?.opportunities && (
          <>
            <div className="panel">
              <p className="panel-label">Oportunidades</p>
              <p className="panel-value sm">{stats.opportunities.total}</p>
            </div>
            <div className="panel">
              <p className="panel-label">Hit rate</p>
              <p className="panel-value sm">
                {(stats.opportunities.hitRate * 100).toFixed(1)}%
              </p>
            </div>
          </>
        )}
        {stats?.openPositions !== undefined && (
          <div className="panel">
            <p className="panel-label">Posiciones abiertas</p>
            <p className="panel-value sm">{stats.openPositions}</p>
          </div>
        )}
      </div>

      {stats?.watchlist && stats.watchlist.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h2 className="section-title">Watchlist</h2>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Wallet</th>
                  <th>Score</th>
                  <th>ROI</th>
                </tr>
              </thead>
              <tbody>
                {stats.watchlist.map((w) => (
                  <tr key={w.wallet_address}>
                    <td>{w.wallet_address.slice(0, 14)}…</td>
                    <td>{w.score?.toFixed(1)}</td>
                    <td className={pnlClass(w.roi ?? 0)}>{w.roi?.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats?.copiedTrades && stats.copiedTrades.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h2 className="section-title">Copies</h2>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Origen</th>
                  <th>Estado</th>
                  <th>Slippage</th>
                </tr>
              </thead>
              <tbody>
                {stats.copiedTrades.map((c, i) => (
                  <tr key={i}>
                    <td>{c.source_wallet.slice(0, 14)}…</td>
                    <td>{c.status}</td>
                    <td>{c.slippage_cents?.toFixed(1)}¢</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats?.rewards && stats.rewards.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h2 className="section-title">Rewards (7d)</h2>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Liquidity</th>
                </tr>
              </thead>
              <tbody>
                {stats.rewards.map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td className="pnl-pos">${r.liquidity_rewards?.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-head">
          <h2 className="section-title">Log de operaciones</h2>
          <span className="section-count">{botTrades.length}</span>
        </div>
        <TradesTable trades={botTrades} />
      </div>
    </>
  );
}

export function App() {
  const [authUser, setAuthUser] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<TabId>('home');

  const authenticated = authUser !== null;
  const { data, error, authError } = useDashboardStream(authenticated);

  useEffect(() => {
    fetchMe()
      .then((user) => setAuthUser(user?.username ?? null))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (authError) setAuthUser(null);
  }, [authError]);

  async function handleLogout() {
    await logout();
    setAuthUser(null);
  }

  if (!authChecked) {
    return (
      <div className="loading-screen">
        <div className="loading-bar" />
        <p className="loading-text">Verificando sesión</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <Login
        onSuccess={async () => {
          const user = await fetchMe();
          if (!user) {
            throw new Error('Sesión no establecida — inténtalo de nuevo');
          }
          setAuthUser(user.username);
        }}
      />
    );
  }

  if (!data) {
    return (
      <div className="loading-screen">
        <div className="loading-bar" />
        <p className="loading-text">Conectando con el desk</p>
        {error && <p className="error-strip">{error}</p>}
      </div>
    );
  }

  const currentTab = TABS.find((t) => t.id === tab)!;
  let lastSection = '';

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <p className="brand-mark">PM Desk</p>
          <p className="brand-sub">Polymarket · Bot Trading</p>
        </div>

        <nav className="sidebar-nav">
          {TABS.map((t) => {
            const showSection = t.section !== lastSection;
            lastSection = t.section;
            const bot = data.bots.find((b) => b.strategy_id === t.id);
            const dotClass = bot ? statusClass(bot.status) : '';

            return (
              <div key={t.id}>
                {showSection && t.id !== 'home' && (
                  <div className="nav-section">{t.section}</div>
                )}
                {t.id === 'home' && <div className="nav-section">{t.section}</div>}
                <button
                  type="button"
                  className={`nav-item ${tab === t.id ? 'active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.id !== 'home' && (
                    <span className={`nav-dot ${dotClass}`} />
                  )}
                  {t.label}
                </button>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className={error ? '' : 'conn-ok'}>
            {error ? 'SSE desconectado' : 'Stream activo'}
          </div>
          <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
            {fmtTime(data.updatedAt)}
          </div>
          <button type="button" className="logout-btn" onClick={() => void handleLogout()}>
            Cerrar sesión · {authUser}
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1 className="topbar-title">{currentTab.label}</h1>
          <div className="topbar-kpis">
            <span className={`mode-badge ${data.paperMode ? 'paper' : 'live'}`}>
              {data.paperMode ? 'PAPER' : 'LIVE'}
            </span>
            <div className="kpi">
              <span className="kpi-label">Exposición</span>
              <span className="kpi-value">${data.exposure.toFixed(2)}</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">PnL hoy</span>
              <span className={`kpi-value ${pnlClass(data.dailyPnl)}`}>
                {fmtUsd(data.dailyPnl)}
              </span>
            </div>
          </div>
        </header>

        <div className="content">
          {error && <div className="error-strip">{error}</div>}

          {tab === 'home' ? (
            <HomeView data={data} onSelectBot={setTab} />
          ) : tab === 'settings' ? (
            <SettingsView />
          ) : (
            <BotDetailView data={data} tab={tab} />
          )}
        </div>
      </div>
    </div>
  );
}
