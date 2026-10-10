"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, CalendarDays, Check, ChevronRight, CircleDollarSign, Compass, ExternalLink, Flag, Hammer, History, LayoutDashboard, LoaderCircle, LogOut, Menu, Plus, Search, Send, ShieldCheck, Trophy, Users, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CONTRACT_ADDRESS, ensureBotchain, formatEther, getWalletClient, parseEther, publicClient, Quest, questForgeAbi, userError } from "@/lib/questforge";

type View = "discover" | "dashboard" | "history";
type Submission = { participant: `0x${string}`; proof: string; approved: boolean };
type Participation = { questId: bigint; approved: boolean };

function shortAddress(address?: string) { return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ""; }
function dateLabel(timestamp: number) { return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(timestamp * 1000)); }
function questStatus(q: Quest) {
  if (q.cancelled) return "Cancelled";
  if (q.winners >= q.maxWinners) return "Completed";
  if (q.deadline * 1000 < Date.now()) return "Ended";
  return "Open";
}

export default function Home() {
  const [account, setAccount] = useState<`0x${string}`>();
  const [enteredApp, setEnteredApp] = useState(false);
  const [view, setView] = useState<View>("discover");
  const [quests, setQuests] = useState<Quest[]>([]);
  const [selected, setSelected] = useState<Quest>();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string }>();

  const loadQuests = useCallback(async () => {
    if (!CONTRACT_ADDRESS) { setLoading(false); return; }
    try {
      const count = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: questForgeAbi, functionName: "questCount" });
      const rows = await Promise.all(Array.from({ length: Number(count) }, (_, index) => publicClient.readContract({ address: CONTRACT_ADDRESS, abi: questForgeAbi, functionName: "getQuest", args: [BigInt(index + 1)] })));
      setQuests(rows.map((r, index) => ({ id: BigInt(index + 1), creator: r[0], title: r[1], description: r[2], requirements: r[3], deadline: Number(r[4]), reward: r[5], maxWinners: Number(r[6]), winners: Number(r[7]), cancelled: r[8] })).reverse());
    } catch (error) { setNotice({ tone: "bad", text: userError(error) }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadQuests(); }, [loadQuests]);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccounts = (...args: unknown[]) => {
      const addresses = (args[0] as `0x${string}`[] | undefined) ?? [];
      setAccount(addresses[0]);
      if (!addresses[0]) { setEnteredApp(false); setView("discover"); setSelected(undefined); }
    };
    const handleChain = (...args: unknown[]) => {
      if (args[0] !== "0x2a5") setNotice({ tone: "bad", text: "Switch your wallet to BOT Chain Mainnet to continue." });
    };
    void window.ethereum.request({ method: "eth_accounts" }).then(value => handleAccounts(value)).catch(() => undefined);
    window.ethereum.on?.("accountsChanged", handleAccounts);
    window.ethereum.on?.("chainChanged", handleChain);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccounts);
      window.ethereum?.removeListener?.("chainChanged", handleChain);
    };
  }, []);

  useEffect(() => {
    if (!CONTRACT_ADDRESS || !account) { setParticipations([]); return; }
    let active = true;
    const loadActivity = async () => {
      try {
        const logs = await publicClient.getContractEvents({ address: CONTRACT_ADDRESS, abi: questForgeAbi, eventName: "ProofSubmitted", args: { participant: account }, fromBlock: 0n });
        const ids = [...new Set(logs.map(log => log.args.questId).filter((id): id is bigint => typeof id === "bigint"))];
        const rows = await Promise.all(ids.map(async questId => {
          const result = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: questForgeAbi, functionName: "getSubmission", args: [questId, account] });
          return { questId, approved: result[2] };
        }));
        if (active) setParticipations(rows);
      } catch (error) {
        if (active) setNotice({ tone: "bad", text: userError(error) });
      }
    };
    void loadActivity();
    return () => { active = false; };
  }, [account, quests]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool({
        name: "search_quests", title: "Search quests", description: "Filter the visible QuestForge board by a title, description, or requirement keyword.",
        inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute(input: unknown) { const value = (input as { query?: unknown }).query; if (typeof value !== "string") throw new Error("query must be a string"); setView("discover"); setQuery(value); return { query: value, visibleQuestCount: quests.filter(q => `${q.title} ${q.description} ${q.requirements}`.toLowerCase().includes(value.toLowerCase())).length }; }
      }, { signal: lifecycle.signal });
      await context.registerTool({
        name: "start_quest_creation", title: "Start quest creation", description: "Open the funded quest creation form for the connected wallet.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute() { if (!account) throw new Error("Connect a wallet before creating a quest."); setCreateOpen(true); return { form: "open", network: "BOT Chain Mainnet" }; }
      }, { signal: lifecycle.signal });
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [account, quests]);

  async function connect() {
    try {
      if (!window.ethereum) throw new Error("Install an EVM wallet to continue.");
      await ensureBotchain();
      const addresses = await window.ethereum.request({ method: "eth_requestAccounts" }) as `0x${string}`[];
      setAccount(addresses[0]); setNotice(undefined);
    } catch (error) { setNotice({ tone: "bad", text: userError(error) }); }
  }

  function disconnect() { setAccount(undefined); setEnteredApp(false); setView("discover"); setSelected(undefined); setNotice({ tone: "good", text: "Wallet disconnected from QuestForge." }); }

  async function runTransaction(action: () => Promise<`0x${string}`>, success: string) {
    try {
      setWorking(true); setNotice(undefined);
      const hash = await action();
      await publicClient.waitForTransactionReceipt({ hash });
      setNotice({ tone: "good", text: success }); await loadQuests();
    } catch (error) { setNotice({ tone: "bad", text: userError(error) }); }
    finally { setWorking(false); }
  }

  async function createQuest(form: FormData) {
    if (!account || !CONTRACT_ADDRESS) return;
    const reward = parseEther(String(form.get("reward")));
    const winners = Number(form.get("winners"));
    const deadline = Math.floor(new Date(String(form.get("deadline"))).getTime() / 1000);
    await runTransaction(async () => getWalletClient(account).writeContract({ address: CONTRACT_ADDRESS, abi: questForgeAbi, functionName: "createQuest", args: [String(form.get("title")), String(form.get("description")), String(form.get("requirements")), BigInt(deadline), reward, winners], value: reward * BigInt(winners) }), "Quest funded and published on BOT Chain.");
    setCreateOpen(false);
  }

  async function submitProof(form: FormData) {
    if (!account || !selected || !CONTRACT_ADDRESS) return;
    await runTransaction(async () => getWalletClient(account).writeContract({ address: CONTRACT_ADDRESS, abi: questForgeAbi, functionName: "submitProof", args: [selected.id, String(form.get("proof"))] }), "Proof submitted. The creator can now review it.");
    setSelected(undefined);
  }

  const openQuest = async (quest: Quest) => {
    setSelected(quest); setSubmissions([]);
    if (!CONTRACT_ADDRESS || !account || account.toLowerCase() !== quest.creator.toLowerCase()) return;
    try {
      const logs = await publicClient.getContractEvents({ address: CONTRACT_ADDRESS, abi: questForgeAbi, eventName: "ProofSubmitted", args: { questId: quest.id }, fromBlock: 0n });
      const rows = await Promise.all(logs.map(async log => {
        const participant = log.args.participant!;
        const details = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: questForgeAbi, functionName: "getSubmission", args: [quest.id, participant] });
        return { participant, proof: details[0], approved: details[2] };
      }));
      setSubmissions(rows);
    } catch (error) { setNotice({ tone: "bad", text: userError(error) }); }
  };

  async function approve(participant: `0x${string}`) {
    if (!account || !selected || !CONTRACT_ADDRESS) return;
    await runTransaction(async () => getWalletClient(account).writeContract({ address: CONTRACT_ADDRESS, abi: questForgeAbi, functionName: "approveSubmission", args: [selected.id, participant] }), "Submission approved and BOT reward released.");
    setSelected(undefined);
  }

  const filtered = useMemo(() => quests.filter(q => `${q.title} ${q.description} ${q.requirements}`.toLowerCase().includes(query.toLowerCase())), [quests, query]);
  const mine = quests.filter(q => q.creator.toLowerCase() === account?.toLowerCase());
  const submitted = quests.filter(q => participations.some(item => item.questId === q.id));
  const completed = quests.filter(q => participations.some(item => item.questId === q.id && item.approved));
  const globallyCompleted = quests.filter(q => questStatus(q) === "Completed");
  const openRewards = quests.filter(q => questStatus(q) === "Open").reduce((sum, q) => sum + q.reward * BigInt(q.maxWinners - q.winners), 0n);

  const nav = (target: View) => { if (!account || !enteredApp) { setNotice({ tone: "bad", text: "Connect your wallet and open the app to continue." }); return; } setView(target); setMobileOpen(false); };
  const openApp = async () => {
    if (!account) { await connect(); return; }
    setEnteredApp(true); setView("discover"); setNotice(undefined);
  };

  if (!enteredApp || !account) {
    return <main className="min-h-screen landing">
      <header className="topbar landing-bar">
        <a className="brand" href="#top" aria-label="QuestForge home"><span className="brand-mark"><Hammer /></span><span>Quest<span>Forge</span></span></a>
        <nav className="landing-nav" aria-label="Landing page"><a href="#how">How it works</a><a href="#network">BOT Chain</a></nav>
        <div className="wallet-actions">
          {account ? <span className="address-pill"><Wallet /> {shortAddress(account)}</span> : <Button variant="ghost" onClick={connect}><Wallet /> Connect wallet</Button>}
          <Button className="connect-button" onClick={openApp}>{account ? "Open app" : "Connect to enter"}</Button>
        </div>
      </header>
      {notice && <div role="status" className={`notice ${notice.tone}`}><span>{notice.tone === "good" ? <Check /> : <Flag />}</span>{notice.text}<button onClick={() => setNotice(undefined)} aria-label="Dismiss"><X /></button></div>}
      <section id="top" className="landing-hero">
        <div className="landing-copy"><span className="kicker">QUESTS, FUNDED ON-CHAIN</span><h1>Create the mission.<br/>Reward the work.</h1><p>QuestForge gives BOT Chain communities one place to publish funded quests, submit proof, and pay approved contributors directly from a smart contract.</p><div className="landing-actions"><Button size="lg" className="create-button" onClick={openApp}>{account ? "Open QuestForge" : "Connect wallet"}</Button><a href="#how">See how it works</a></div><small>{account ? `${shortAddress(account)} connected · Open the app when you are ready.` : "A BOT Chain Mainnet wallet is required to enter the app."}</small></div>
        <div className="forge-emblem" aria-hidden="true"><span>QF</span><i>BOT CHAIN</i></div>
      </section>
      <section id="how" className="how-section"><div className="section-label">THE FLOW</div><div className="steps"><article><b>01</b><h2>Fund a quest</h2><p>Set the mission, proof requirements, deadline, reward, and winner slots. The full pool is locked when you publish.</p></article><article><b>02</b><h2>Submit proof</h2><p>Participants complete the work and submit a public URL or a short text record from their connected wallet.</p></article><article><b>03</b><h2>Approve and pay</h2><p>The creator reviews each submission. Approval releases the promised BOT reward to that participant.</p></article></div></section>
      <section id="network" className="network-section"><div><span className="section-label">BUILT ON BOT CHAIN</span><h2>No off-chain reward ledger.</h2></div><p>Quest funding, submissions, approvals, payouts, cancellations, and refunds are handled by the deployed QuestForge contract on BOT Chain Mainnet.</p><a href="https://scan.botchain.ai" target="_blank" rel="noreferrer">Explore BOT Chain <ExternalLink /></a></section>
      <SiteFooter />
    </main>;
  }

  return (
    <main className="min-h-screen">
      <header className="topbar">
        <button className="brand" onClick={() => nav("discover")} aria-label="QuestForge home"><span className="brand-mark"><Hammer /></span><span>Quest<span>Forge</span></span></button>
        <nav className="desktop-nav" aria-label="Primary">
          <button className={view === "discover" ? "active" : ""} onClick={() => nav("discover")}>Discover</button>
          <button className={view === "dashboard" ? "active" : ""} onClick={() => nav("dashboard")}>Dashboard</button>
          <button className={view === "history" ? "active" : ""} onClick={() => nav("history")}>History</button>
        </nav>
        <div className="wallet-actions">
          <span className="network-pill"><i /> BOT Mainnet</span>
          {account ? <><span className="address-pill"><Wallet /> {shortAddress(account)}</span><Button variant="ghost" size="icon" onClick={disconnect} aria-label="Disconnect wallet"><LogOut /></Button></> : <Button className="connect-button" onClick={connect}><Wallet /> Connect wallet</Button>}
          <Button variant="ghost" size="icon" className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open menu">{mobileOpen ? <X /> : <Menu />}</Button>
        </div>
      </header>

      {mobileOpen && <nav className="mobile-nav"><button onClick={() => nav("discover")}>Discover</button><button onClick={() => nav("dashboard")}>Dashboard</button><button onClick={() => nav("history")}>History</button></nav>}

      {notice && <div role="status" className={`notice ${notice.tone}`}><span>{notice.tone === "good" ? <Check /> : <Flag />}</span>{notice.text}<button onClick={() => setNotice(undefined)} aria-label="Dismiss"><X /></button></div>}

      <section className="shell">
        {view === "discover" && <>
          <div className="quest-hero">
            <div><span className="eyebrow"><ShieldCheck /> Live on BOT Chain</span><h1>Pick a mission.<br/><em>Forge your proof.</em></h1><p>Explore funded quests, ship the work, and earn BOT when your submission is approved.</p></div>
            <div className="hero-actions"><Button className="create-button" size="lg" onClick={() => account ? setCreateOpen(true) : connect()}><Plus /> Create a quest</Button><a href="https://scan.botchain.ai" target="_blank" rel="noreferrer">View explorer <ExternalLink /></a></div>
          </div>

          <div className="stat-ribbon">
            <div><span>Open quests</span><strong>{quests.filter(q => questStatus(q) === "Open").length}</strong></div>
            <div><span>Available rewards</span><strong>{Number(formatEther(openRewards)).toLocaleString(undefined, { maximumFractionDigits: 3 })} BOT</strong></div>
            <div><span>Rewards released</span><strong>{globallyCompleted.reduce((sum, q) => sum + q.winners, 0)} wins</strong></div>
          </div>

          <div className="board-head"><div><h2>Quest board</h2><p>Every reward below is held by the smart contract.</p></div><label className="search-box"><Search /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search quests" /></label></div>

          {loading ? <div className="empty-board"><LoaderCircle className="spin"/><h3>Reading the quest board</h3></div> : !CONTRACT_ADDRESS ? <div className="empty-board contract-pending"><ShieldCheck/><h3>Contract setup is ready</h3><p>Deploy the included QuestForge contract to BOT Chain Mainnet, then add its address to the frontend environment to open the live board.</p></div> : filtered.length === 0 ? <div className="empty-board"><Compass/><h3>{query ? "No quests match that search" : "The board is clear"}</h3><p>{query ? "Try a different keyword." : "Be the first to fund a mission for the community."}</p>{!query && <Button onClick={() => account ? setCreateOpen(true) : connect()}><Plus/> Create the first quest</Button>}</div> : <div className="quest-grid">{filtered.map(q => <QuestCard key={String(q.id)} quest={q} onOpen={() => openQuest(q)} />)}</div>}
        </>}

        {view === "dashboard" && <Dashboard account={account} quests={mine} submitted={submitted} paidCount={completed.length} onCreate={() => setCreateOpen(true)} onOpen={openQuest} />}
        {view === "history" && <HistoryView quests={completed} onOpen={openQuest} />}
      </section>

      <SiteFooter />

      <CreateDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={createQuest} working={working} contractReady={Boolean(CONTRACT_ADDRESS)} />
      <QuestDialog quest={selected} account={account} submissions={submissions} onOpenChange={open => !open && setSelected(undefined)} onSubmit={submitProof} onApprove={approve} working={working} />
    </main>
  );
}

function QuestCard({ quest, onOpen }: { quest: Quest; onOpen: () => void }) {
  const status = questStatus(quest);
  return <article className="quest-card" onClick={onOpen} tabIndex={0} onKeyDown={e => e.key === "Enter" && onOpen()}>
    <div className="card-top"><span className={`status ${status.toLowerCase()}`}>{status}</span><span className="quest-id">QF-{String(quest.id).padStart(3, "0")}</span></div>
    <h3>{quest.title}</h3><p>{quest.description}</p>
    <div className="requirement"><Flag /> {quest.requirements}</div>
    <div className="card-meta"><span><CalendarDays /> {dateLabel(quest.deadline)}</span><span><Users /> {quest.winners}/{quest.maxWinners} claimed</span></div>
    <div className="reward-row"><div><small>Reward per winner</small><strong>{Number(formatEther(quest.reward)).toLocaleString()} <b>BOT</b></strong></div><button aria-label={`Open ${quest.title}`}><ChevronRight /></button></div>
  </article>;
}

function Dashboard({ account, quests, submitted, paidCount, onCreate, onOpen }: { account?: string; quests: Quest[]; submitted: Quest[]; paidCount: number; onCreate: () => void; onOpen: (q: Quest) => void }) {
  return <div className="page-view"><div className="page-title"><div><span className="eyebrow"><LayoutDashboard/> Creator workspace</span><h1>Your dashboard</h1><p>{shortAddress(account)} · Track funded quests and review submissions.</p></div><Button className="create-button" onClick={onCreate}><Plus/> New quest</Button></div>
    <div className="mini-stats"><div><span>Created</span><strong>{quests.length}</strong></div><div><span>Submitted</span><strong>{submitted.length}</strong></div><div><span>Rewards earned</span><strong>{paidCount}</strong></div></div>
    <div className="dashboard-lists"><div className="list-panel"><div className="list-head"><h2>Created quests</h2><span>{quests.length} total</span></div>{quests.length ? quests.map(q => <QuestRow key={String(q.id)} quest={q} onOpen={() => onOpen(q)} />) : <div className="empty-inline"><Hammer/><h3>No quests yet</h3><p>Your funded quests will appear here.</p><Button onClick={onCreate}>Create a quest</Button></div>}</div><div className="list-panel"><div className="list-head"><h2>Your submissions</h2><span>{submitted.length} total</span></div>{submitted.length ? submitted.map(q => <QuestRow key={String(q.id)} quest={q} onOpen={() => onOpen(q)} />) : <div className="empty-inline"><Send/><h3>No submissions yet</h3><p>Quests you enter will appear here.</p></div>}</div></div>
  </div>;
}

function QuestRow({ quest, onOpen }: { quest: Quest; onOpen: () => void }) {
  return <button className="quest-row" onClick={onOpen}><span className="row-icon"><Trophy/></span><span><strong>{quest.title}</strong><small>{dateLabel(quest.deadline)} · {questStatus(quest)}</small></span><b>{Number(formatEther(quest.reward))} BOT</b><ChevronRight/></button>;
}

function HistoryView({ quests, onOpen }: { quests: Quest[]; onOpen: (q: Quest) => void }) {
  return <div className="page-view"><div className="page-title"><div><span className="eyebrow"><History/> Permanent record</span><h1>Completed quests</h1><p>Fully rewarded missions recorded on BOT Chain.</p></div></div><div className="quest-grid">{quests.length ? quests.map(q => <QuestCard key={String(q.id)} quest={q} onOpen={() => onOpen(q)} />) : <div className="empty-board wide"><Award/><h3>No completed quests yet</h3><p>Completed and fully paid missions will collect here.</p></div>}</div></div>;
}

function CreateDialog({ open, onOpenChange, onSubmit, working, contractReady }: { open: boolean; onOpenChange: (v: boolean) => void; onSubmit: (f: FormData) => void; working: boolean; contractReady: boolean }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="quest-dialog form-dialog"><DialogHeader><DialogTitle>Fund a new quest</DialogTitle><DialogDescription>Set the mission and lock the full reward pool in the contract.</DialogDescription></DialogHeader><form action={onSubmit} className="quest-form"><label>Quest title<Input name="title" placeholder="e.g. Ship a BOT Chain tutorial" required maxLength={80}/></label><label>Description<Textarea name="description" placeholder="What should participants create or complete?" required maxLength={500}/></label><label>Proof requirements<Textarea name="requirements" placeholder="A public URL, transaction hash, or short written proof" required maxLength={300}/></label><div className="field-grid"><label>Deadline<Input name="deadline" type="datetime-local" required/></label><label>Reward per winner<Input name="reward" type="number" min="0.0001" step="0.0001" placeholder="1.0" required/></label></div><label>Winner slots<Input name="winners" type="number" min="1" max="100" defaultValue="1" required/></label><div className="fund-note"><ShieldCheck/><span>The wallet transaction deposits reward × winner slots. QuestForge never holds funds off-chain.</span></div><Button className="create-button" size="lg" disabled={working || !contractReady}>{working ? <LoaderCircle className="spin"/> : <CircleDollarSign/>}{contractReady ? "Fund and publish quest" : "Deploy contract to create quests"}</Button></form></DialogContent></Dialog>;
}

function QuestDialog({ quest, account, submissions, onOpenChange, onSubmit, onApprove, working }: { quest?: Quest; account?: `0x${string}`; submissions: Submission[]; onOpenChange: (v: boolean) => void; onSubmit: (f: FormData) => void; onApprove: (a: `0x${string}`) => void; working: boolean }) {
  if (!quest) return null;
  const creator = account?.toLowerCase() === quest.creator.toLowerCase();
  return <Dialog open={Boolean(quest)} onOpenChange={onOpenChange}><DialogContent className="quest-dialog detail-dialog"><DialogHeader><div className="card-top"><span className={`status ${questStatus(quest).toLowerCase()}`}>{questStatus(quest)}</span><span className="quest-id">QF-{String(quest.id).padStart(3, "0")}</span></div><DialogTitle>{quest.title}</DialogTitle><DialogDescription>Created by {shortAddress(quest.creator)}</DialogDescription></DialogHeader><p className="detail-copy">{quest.description}</p><div className="detail-reward"><span><Trophy/> Reward</span><strong>{Number(formatEther(quest.reward))} BOT <small>per winner</small></strong></div><section className="requirements"><h4>Completion requirements</h4><p>{quest.requirements}</p></section><div className="detail-meta"><span><CalendarDays/> Ends {dateLabel(quest.deadline)}</span><span><Users/> {quest.maxWinners - quest.winners} reward slots left</span></div>
    {creator ? <section className="submission-list"><h4>Submissions</h4>{submissions.length ? submissions.map(s => <div className="submission" key={s.participant}><div><strong>{shortAddress(s.participant)}</strong><a href={s.proof.startsWith("http") ? s.proof : undefined} target="_blank" rel="noreferrer">{s.proof}{s.proof.startsWith("http") && <ExternalLink/>}</a></div>{s.approved ? <span className="approved"><Check/> Paid</span> : <Button disabled={working} onClick={() => onApprove(s.participant)}>Approve & pay</Button>}</div>) : <div className="empty-submission">No proof submitted yet.</div>}</section> : <form action={onSubmit} className="proof-form"><label>Your proof<Textarea name="proof" placeholder="Paste a public URL or write a short proof note" required/></label><Button className="create-button" disabled={working || questStatus(quest) !== "Open"}>{working ? <LoaderCircle className="spin"/> : <Send/>} Submit proof</Button></form>}
  </DialogContent></Dialog>;
}

function SiteFooter() {
  return <footer><div className="brand mini"><span className="brand-mark"><Hammer /></span><span>QuestForge</span></div><p>On-chain missions, transparent rewards.</p><div><a href="https://botchain.ai" target="_blank" rel="noreferrer">BOT Chain</a><a href="https://scan.botchain.ai" target="_blank" rel="noreferrer">BOT Chain Explorer</a></div></footer>;
}
