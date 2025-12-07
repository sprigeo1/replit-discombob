/**
 * Financial Projection Engine
 *
 * Joseph's retirement projection logic packaged as a reusable module.
 */

export type AccountType =
  | "DEFINED_BENEFIT"
  | "K401"
  | "SEP_IRA"
  | "LIONSCOVE";

export type TaxTreatment = "ORDINARY" | "QUALIFIED" | "MIXED";

export interface AccountConfig {
  id: string;
  type: AccountType;
  name: string;
  initialBalance: number;
  annualContribution: number; // applied from contributionStartAge to contributionEndAge inclusive
  contributionStartAge: number;
  contributionEndAge: number;
  growthRate: number; // annual growth rate; for Lionscove, principal growth is normally 0 in Joseph's model
  yieldRate: number; // annual yield as a fraction, for income calculations (e.g., 0.09 for 9%)
  taxTreatment: TaxTreatment;
}

export interface ExpenseBucket {
  name: string;
  annualAmountToday: number; // in today's dollars at currentAge
}

export interface Assumptions {
  currentAge: number;
  projectionEndAge: number;
  retirementAge: number;

  inflationRate: number; // e.g., 0.03
  portfolioReturnRate: number; // used for DB/401k/SEP
  withdrawalRate: number; // e.g., 0.04

  // Tax assumptions
  ordinaryIncomeRate: number; // e.g., 0.22
  qualifiedDividendRate: number; // e.g., 0.15

  // Wife's income (assumed ordinary)
  wifeIncomeAnnual: number; // e.g., 36000

  // Whether Lionscove principal grows or is flat
  lionscovePrincipalGrows: boolean;
}

export interface ProjectionYear {
  age: number;
  yearIndex: number; // 0 = currentAge
  spendingNominal: number;

  // Income by source
  incomeWife: number;
  incomeLionscove: number;
  incomePortfolioWithdrawals: number;

  // Taxes by source
  taxWife: number;
  taxLionscove: number;
  taxPortfolio: number;

  totalTax: number;
  afterTaxIncome: number;
  surplus: number; // afterTaxIncome - spendingNominal

  // Account balances at end of year
  balances: Record<string, number>;
}

export interface ProjectionResult {
  assumptions: Assumptions;
  expenseBuckets: ExpenseBucket[];
  accounts: AccountConfig[];
  years: ProjectionYear[];
}

function inflate(amount: number, rate: number, years: number): number {
  return amount * Math.pow(1 + rate, years);
}

export function projectPlan(
  assumptions: Assumptions,
  expenseBuckets: ExpenseBucket[],
  accounts: AccountConfig[]
): ProjectionResult {
  const {
    currentAge,
    projectionEndAge,
    inflationRate,
    withdrawalRate,
    ordinaryIncomeRate,
    qualifiedDividendRate,
    wifeIncomeAnnual,
    lionscovePrincipalGrows,
  } = assumptions;

  const years: ProjectionYear[] = [];

  const annualSpendingToday = expenseBuckets.reduce(
    (sum, b) => sum + b.annualAmountToday,
    0
  );

  const balances: Record<string, number> = {};
  for (const acc of accounts) {
    balances[acc.id] = acc.initialBalance;
  }

  for (
    let age = currentAge, yearIndex = 0;
    age <= projectionEndAge;
    age++, yearIndex++
  ) {
    const yearsFromToday = age - currentAge;
    const spendingNominal = inflate(
      annualSpendingToday,
      inflationRate,
      yearsFromToday
    );

    const incomeWife = wifeIncomeAnnual;

    for (const acc of accounts) {
      const bal = balances[acc.id];
      let growthRate = acc.growthRate;
      if (acc.type === "LIONSCOVE" && !lionscovePrincipalGrows) {
        growthRate = 0;
      }

      const inContributionWindow =
        age >= acc.contributionStartAge && age <= acc.contributionEndAge;

      const contribution = inContributionWindow ? acc.annualContribution : 0;

      const newBalance = bal * (1 + growthRate) + contribution;
      balances[acc.id] = newBalance;
    }

    let incomeLionscove = 0;
    let incomePortfolioWithdrawals = 0;

    for (const acc of accounts) {
      const bal = balances[acc.id];
      if (acc.type === "LIONSCOVE") {
        incomeLionscove += bal * acc.yieldRate;
      }
    }

    let portfolioBaseForWithdrawal = 0;
    for (const acc of accounts) {
      if (acc.type === "DEFINED_BENEFIT" || acc.type === "K401" || acc.type === "SEP_IRA") {
        portfolioBaseForWithdrawal += balances[acc.id];
      }
    }
    incomePortfolioWithdrawals = portfolioBaseForWithdrawal * withdrawalRate;

    const taxWife = incomeWife * ordinaryIncomeRate;
    const taxLionscove = incomeLionscove * qualifiedDividendRate;
    const taxPortfolio = incomePortfolioWithdrawals * ordinaryIncomeRate;

    const totalTax = taxWife + taxLionscove + taxPortfolio;

    const totalIncome =
      incomeWife + incomeLionscove + incomePortfolioWithdrawals;
    const afterTaxIncome = totalIncome - totalTax;
    const surplus = afterTaxIncome - spendingNominal;

    years.push({
      age,
      yearIndex,
      spendingNominal,
      incomeWife,
      incomeLionscove,
      incomePortfolioWithdrawals,
      taxWife,
      taxLionscove,
      taxPortfolio,
      totalTax,
      afterTaxIncome,
      surplus,
      balances: { ...balances },
    });
  }

  return {
    assumptions,
    expenseBuckets,
    accounts,
    years,
  };
}

export function buildJosephScenario(): {
  assumptions: Assumptions;
  expenseBuckets: ExpenseBucket[];
  accounts: AccountConfig[];
} {
  const currentAge = 55;

  const expenseBuckets: ExpenseBucket[] = [
    { name: "Housing", annualAmountToday: 1699.51 * 12 },
    { name: "Food & Dining", annualAmountToday: 1000 * 12 },
    { name: "Transportation", annualAmountToday: 300 * 12 },
    { name: "Insurance & Health", annualAmountToday: 2000 * 12 },
    { name: "Miscellaneous", annualAmountToday: 300 * 12 },
    { name: "Cleaning & Household Supplies", annualAmountToday: 200 * 12 },
    { name: "Travel", annualAmountToday: 1000 * 12 },
  ];

  const assumptions: Assumptions = {
    currentAge,
    projectionEndAge: 82,
    retirementAge: 62,

    inflationRate: 0.03,
    portfolioReturnRate: 0.05,
    withdrawalRate: 0.04,

    ordinaryIncomeRate: 0.22,
    qualifiedDividendRate: 0.15,

    wifeIncomeAnnual: 36000,

    lionscovePrincipalGrows: false,
  };

  const accounts: AccountConfig[] = [
    {
      id: "DB",
      type: "DEFINED_BENEFIT",
      name: "Defined Benefit Plan",
      initialBalance: 687000,
      annualContribution: 120000,
      contributionStartAge: 55,
      contributionEndAge: 61,
      growthRate: assumptions.portfolioReturnRate,
      yieldRate: 0,
      taxTreatment: "ORDINARY",
    },
    {
      id: "401K",
      type: "K401",
      name: "401(k)",
      initialBalance: 27800,
      annualContribution: 40000,
      contributionStartAge: 55,
      contributionEndAge: 61,
      growthRate: assumptions.portfolioReturnRate,
      yieldRate: 0,
      taxTreatment: "ORDINARY",
    },
    {
      id: "SEP",
      type: "SEP_IRA",
      name: "SEP IRA",
      initialBalance: 143000,
      annualContribution: 0,
      contributionStartAge: 55,
      contributionEndAge: 61,
      growthRate: assumptions.portfolioReturnRate,
      yieldRate: 0,
      taxTreatment: "ORDINARY",
    },
    {
      id: "LIONSCOVE",
      type: "LIONSCOVE",
      name: "Lionscove Income Account",
      initialBalance: 230000,
      annualContribution: 80000,
      contributionStartAge: 55,
      contributionEndAge: 61,
      growthRate: 0,
      yieldRate: 0.09,
      taxTreatment: "QUALIFIED",
    },
  ];

  return { assumptions, expenseBuckets, accounts };
}

export function summarizeScenario(result: ProjectionResult) {
  const terminalYear = result.years[result.years.length - 1];
  const retirementYear = result.years.find(
    (y) => y.age === result.assumptions.retirementAge
  );

  return {
    retirementSurplus: retirementYear?.surplus ?? 0,
    terminalBalances: terminalYear?.balances ?? {},
    peakSpending: Math.max(...result.years.map((y) => y.spendingNominal)),
  };
}
