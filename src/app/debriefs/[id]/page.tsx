import { notFound } from "next/navigation";
import Link from "next/link";
import { getAccount, getBroker, getCall, synthesizeDebrief } from "@/lib/store";

export default async function DebriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const call = await getCall(id);
  if (!call) notFound();
  const account = await getAccount(call.accountId);
  const broker = await getBroker(call.brokerId);
  const debrief = synthesizeDebrief(call, account);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/debriefs" className="text-xs text-muted uppercase tracking-[0.2em]">
        Debriefs
      </Link>
      <h1 className="font-serif text-4xl mt-4">
        {account?.name ?? call.accountId}
      </h1>
      <p className="text-muted mt-2">
        {broker?.name} · {call.startedAt.slice(0, 10)}
        {call.synthetic ? " · synthetic transcript" : ""}
      </p>

      <section className="mt-10 space-y-6">
        <Block k="What happened" v={debrief.whatHappened} />
        <Block k="Outcome" v={debrief.outcome.replace(/_/g, " ")} />
        <Block k="Worked" v={debrief.whatWorked} />
        <Block k="Didn't" v={debrief.whatDidnt} />
        <Block k="One thing to improve" v={debrief.oneThingToImprove} />
      </section>

      {broker && (
        <section className="mt-10 rounded-2xl border border-line p-5">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
            Broker profile
          </p>
          <p className="mt-2">Strength: {broker.strength}</p>
          <p className="text-muted">Weakness: {broker.weakness}</p>
          <p className="text-muted">Common mistake: {broker.commonMistake}</p>
        </section>
      )}

      <section className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
          Transcript
        </p>
        <ol className="mt-4 space-y-3">
          {call.turns.map((t, i) => (
            <li key={i} className="text-sm">
              <span className="text-muted uppercase tracking-wider text-[10px] mr-2">
                {t.speaker.replace(/_/g, " ")}
              </span>
              {t.text}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Block({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <h2 className="text-[11px] uppercase tracking-[0.22em] text-muted">{k}</h2>
      <p className="mt-1 text-lg">{v}</p>
    </div>
  );
}
