"use client";

import { useEffect, useMemo, useState } from "react";
import type { Assumptions, ProjectionResult } from "@/lib/projection";
import { buildJosephScenario } from "@/lib/projection";

type ProjectionPayload = Partial<{ assumptions: Assumptions }>;

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function useProjection() {
  const [result, setResult] = useState<ProjectionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async (payload?: ProjectionPayload) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projection", {
        method: payload ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as ProjectionResult;
      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { result, loading, error, refresh };
}

function SurplusBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className="badge">
      <span className={positive ? "status-ok" : "status-risk"}>
        {positive ? "▲" : "▼"}
      </span>
      {positive ? "Surplus" : "Deficit"}: {currency.format(Math.abs(value))}
    </span>
  );
}

function ProjectionTable({ result }: { result: ProjectionResult }) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Age</th>
            <th>Spending</th>
            <th>After-tax income</th>
            <th>Surplus</th>
            <th>Lionscove</th>
            <th>DB + 401k + SEP</th>
          </tr>
        </thead>
        <tbody>
          {result.years.map((year) => {
            const taxAdvantaged =
              (year.balances["DB"] ?? 0) +
              (year.balances["401K"] ?? 0) +
              (year.balances["SEP"] ?? 0);
            return (
              <tr key={year.age}>
                <td>{year.age}</td>
                <td>{currency.format(year.spendingNominal)}</td>
                <td>{currency.format(year.afterTaxIncome)}</td>
                <td className={year.surplus >= 0 ? "status-ok" : "status-risk"}>
                  {currency.format(year.surplus)}
                </td>
                <td>{currency.format(year.balances["LIONSCOVE"] ?? 0)}</td>
                <td>{currency.format(taxAdvantaged)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function HomePage() {
  const { result, loading, error, refresh } = useProjection();
  const base = useMemo(() => buildJosephScenario(), []);
  const [assumptions, setAssumptions] = useState<Assumptions>(base.assumptions);

  const submit = (evt: React.FormEvent) => {
    evt.preventDefault();
    refresh({ assumptions });
  };

  const summary = useMemo(() => {
    if (!result) return null;
    const retirement = result.years.find(
      (y) => y.age === result.assumptions.retirementAge
    );
    const terminal = result.years[result.years.length - 1];
    return {
      retirementSurplus: retirement?.surplus ?? 0,
      terminalBalance: Object.values(terminal?.balances ?? {}).reduce(
        (sum, val) => sum + val,
        0
      ),
    };
  }, [result]);

  return (
    <div className="app-shell">
      <header>
        <div>
          <h1>Retirement Projection Dashboard</h1>
          <p className="lead">
            Wrapped Joseph's projection engine as a Next.js API with an interactive dashboard.
          </p>
        </div>
        {summary && <SurplusBadge value={summary.retirementSurplus} />}
      </header>

      <div className="grid">
        <div className="card">
          <h3>Assumptions</h3>
          <form className="input-grid" onSubmit={submit}>
            <label>
              Current age
              <input
                type="number"
                value={assumptions.currentAge}
                onChange={(e) =>
                  setAssumptions({ ...assumptions, currentAge: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Projection end age
              <input
                type="number"
                value={assumptions.projectionEndAge}
                onChange={(e) =>
                  setAssumptions({ ...assumptions, projectionEndAge: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Retirement age
              <input
                type="number"
                value={assumptions.retirementAge}
                onChange={(e) =>
                  setAssumptions({ ...assumptions, retirementAge: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Inflation rate
              <input
                type="number"
                step="0.001"
                value={assumptions.inflationRate}
                onChange={(e) =>
                  setAssumptions({ ...assumptions, inflationRate: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Portfolio return
              <input
                type="number"
                step="0.001"
                value={assumptions.portfolioReturnRate}
                onChange={(e) =>
                  setAssumptions({
                    ...assumptions,
                    portfolioReturnRate: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Withdrawal rate
              <input
                type="number"
                step="0.001"
                value={assumptions.withdrawalRate}
                onChange={(e) =>
                  setAssumptions({ ...assumptions, withdrawalRate: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Ordinary income tax rate
              <input
                type="number"
                step="0.001"
                value={assumptions.ordinaryIncomeRate}
                onChange={(e) =>
                  setAssumptions({
                    ...assumptions,
                    ordinaryIncomeRate: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Qualified dividend tax rate
              <input
                type="number"
                step="0.001"
                value={assumptions.qualifiedDividendRate}
                onChange={(e) =>
                  setAssumptions({
                    ...assumptions,
                    qualifiedDividendRate: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Wife income (annual)
              <input
                type="number"
                step="1000"
                value={assumptions.wifeIncomeAnnual}
                onChange={(e) =>
                  setAssumptions({ ...assumptions, wifeIncomeAnnual: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Lionscove principal grows
              <select
                value={assumptions.lionscovePrincipalGrows ? "yes" : "no"}
                onChange={(e) =>
                  setAssumptions({
                    ...assumptions,
                    lionscovePrincipalGrows: e.target.value === "yes",
                  })
                }
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
            <button type="submit">Recalculate</button>
          </form>
        </div>

        <div className="card">
          <h3>Snapshot</h3>
          {loading && <p>Loading projection...</p>}
          {error && <p className="status-risk">{error}</p>}
          {summary && (
            <div className="grid">
              <div>
                <p className="muted">Surplus at retirement</p>
                <strong>{currency.format(summary.retirementSurplus)}</strong>
              </div>
              <div>
                <p className="muted">Total assets at end</p>
                <strong>{currency.format(summary.terminalBalance)}</strong>
              </div>
            </div>
          )}
          <p className="footer-note">
            Adjust inputs and hit Recalculate to see how assumptions ripple through Joseph's plan.
          </p>
        </div>
      </div>

      {result && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Full Projection</h3>
          <ProjectionTable result={result} />
        </div>
      )}
    </div>
  );
}
