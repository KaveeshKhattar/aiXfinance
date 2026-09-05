import { notFound } from "next/navigation";
import { getAccount, getCalls } from "@/lib/store";
import Link from "next/link";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();
  const calls = (await getCalls()).filter((c) => c.accountId === id);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/accounts" className="text-xs text-muted uppercase tracking-[0.2em]">
        Accounts
      </Link>
      <h1 className="font-serif text-4xl mt-4">{account.name}</h1>
      <p className="mt-2 text-muted">{account.industry}</p>

      <div className="mt-8 rounded-2xl border border-amber/30 bg-amber/5 p-5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-amber">
          Before you dial
        </p>
        <ul className="mt-3 space-y-2 text-lg">
          <li>
            {account.decisionMaker
              ? `${account.decisionMaker}, ${account.decisionMakerTitle}`
              : "Decision maker unknown — ask, don’t guess."}
          </li>
          <li>
            Renewal: {account.renewalMonth ?? "unknown. Ask. Do not invent a date."}
          </li>
          {account.lastObjection && (
            <li>
              They already said “{account.lastObjection.replace(/_/g, " ")}”
              {account.lastCallAt ? ` on ${account.lastCallAt}` : ""}.
            </li>
          )}
          {account.lastApproach && <li>Previous approach: {account.lastApproach}</li>}
        </ul>
        {account.doNotRepeat.length > 0 && (
          <p className="mt-4 text-sm text-muted">
            Do not repeat: {account.doNotRepeat.join(" · ")}
          </p>
        )}
      </div>

      <p className="mt-6 text-sm text-muted">{account.notes}</p>

      <h2 className="mt-12 text-[11px] uppercase tracking-[0.22em] text-muted">
        Call history
      </h2>
      <ul className="mt-4 space-y-3">
        {calls.map((c) => (
          <li key={c.id} className="border border-line rounded-xl px-4 py-3">
            <div className="flex justify-between text-sm">
              <span>{c.startedAt.slice(0, 10)}</span>
              <span className="text-muted">
                {c.outcome.replace(/_/g, " ")}
                {c.synthetic ? " · synthetic" : ""}
              </span>
            </div>
            <p className="text-xs text-muted mt-1">
              Reached {c.stageReached} · opener {c.openerVariant}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
