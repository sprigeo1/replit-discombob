import { NextResponse } from "next/server";
import {
  Assumptions,
  ExpenseBucket,
  AccountConfig,
  projectPlan,
  buildJosephScenario,
} from "@/lib/projection";

type ProjectionPayload = Partial<{
  assumptions: Assumptions;
  expenseBuckets: ExpenseBucket[];
  accounts: AccountConfig[];
}>;

function coercePayload(data: ProjectionPayload) {
  const base = buildJosephScenario();
  return {
    assumptions: data.assumptions ?? base.assumptions,
    expenseBuckets: data.expenseBuckets ?? base.expenseBuckets,
    accounts: data.accounts ?? base.accounts,
  };
}

export async function GET() {
  const base = buildJosephScenario();
  const result = projectPlan(base.assumptions, base.expenseBuckets, base.accounts);
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ProjectionPayload;
    const payload = coercePayload(body ?? {});
    const result = projectPlan(
      payload.assumptions,
      payload.expenseBuckets,
      payload.accounts
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid projection payload", details: `${error}` },
      { status: 400 }
    );
  }
}
