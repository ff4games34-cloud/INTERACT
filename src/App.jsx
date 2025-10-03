import React, { useEffect, useMemo, useState } from "react";
import { Download, Upload, Plus, Save, Trash2, LogOut, CheckCircle2, Settings, Edit3, User, Users } from "lucide-react";
import { v4 as uuid } from "uuid";

const LS_KEY = "htic_marathon_tracker_v1";

const demoStudents = [
  { id: uuid(), name: "A. Perera", email: "aperera@sttoms.edu", team: "Logistics" },
  { id: uuid(), name: "B. Silva", email: "bsilva@sttoms.edu", team: "Sponsorships" },
  { id: uuid(), name: "C. Fernando", email: "cfernando@sttoms.edu", team: "Media" },
];

const startOfWeek = (d = new Date()) => {
  const date = new Date(d);
  const day = date.getDay(); // 0 Sun ... 6 Sat
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  return new Date(date.setDate(diff));
};
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric"});
const weeksBetween = (dateA, dateB) => Math.floor((+startOfWeek(dateB) - +startOfWeek(dateA)) / (7*24*3600*1000));

const defaultState = () => {
  const start = startOfWeek();
  return {
    meta: {
      clubName: "St. Tom’s Catholic International College – Intra Club",
      eventName: "HTIC Charity Marathon",
      adminPasscode: "admin123",
      academicWeekZeroISO: start.toISOString(),
    },
    students: demoStudents,
    objectives: [
      { id: uuid(), title: "Confirm venue & route permissions (2 km)", details: "Obtain approval; sketch 1 km up/1 km down route.", weekIndex: 0, dueDate: new Date().toISOString() },
      { id: uuid(), title: "Water & first-aid coordination", details: "Quotations, assign water points and first-aid volunteers.", weekIndex: 0, dueDate: new Date(Date.now()+3*86400000).toISOString() },
      { id: uuid(), title: "Sponsorship letter & outreach", details: "Draft letter, list 20 sponsors, begin outreach.", weekIndex: 1, dueDate: new Date(Date.now()+7*86400000).toISOString() },
    ],
    submissions: [],
  };
};

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    return JSON.parse(raw);
  } catch {
    return defaultState();
  }
}
function saveState(state) { localStorage.setItem(LS_KEY, JSON.stringify(state)); }

const statuses = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

const pill = (txt) => <span className="badge">{txt}</span>;

const toCSV = (rows) => {
  const keys = Object.keys(rows[0] || {});
  const head = keys.join(",");
  const body = rows.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(",")).join("\n");
  return `${head}\n${body}`;
};
const downloadFile = (name, content, type="text/plain") => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
};

export default function App() {
  const [state, setState] = useState(loadState());
  const [tab, setTab] = useState("overview");
  const [role, setRole] = useState("guest"); // guest | admin | student
  const [adminPass, setAdminPass] = useState("");
  const [whoId, setWhoId] = useState("");
  const [query, setQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(()=> saveState(state), [state]);

  const weekZero = useMemo(() => new Date(state.meta.academicWeekZeroISO), [state.meta.academicWeekZeroISO]);
  const nowWeekIndex = useMemo(() => weeksBetween(weekZero, new Date()), [weekZero]);

  const who = state.students.find(s => s.id === whoId) || null;

  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return state.students;
    return state.students.filter(s => [s.name, s.email, s.team].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [state.students, query]);

  const objectivesByWeek = useMemo(() => {
    const m = new Map();
    state.objectives.forEach(o => { m.set(o.weekIndex, [...(m.get(o.weekIndex)||[]), o]); });
    return m;
  }, [state.objectives]);

  const getSubmission = (studentId, objectiveId) => state.submissions.find(s => s.studentId === studentId && s.objectiveId === objectiveId);
  const upsertSubmission = (sub) => {
    setState(prev => {
      const idx = prev.submissions.findIndex(s => s.id === sub.id);
      if (idx >= 0) { const next = [...prev.submissions]; next[idx] = sub; return { ...prev, submissions: next }; }
      return { ...prev, submissions: [...prev.submissions, sub] };
    });
  };
  const markStatus = (studentId, objectiveId, status) => {
    const found = getSubmission(studentId, objectiveId);
    if (found) upsertSubmission({ ...found, status });
    else upsertSubmission({ id: uuid(), studentId, objectiveId, status, notes: "", evidenceUrl: "", extra: [] });
  };
  const addExtra = (studentId, objectiveId, item) => {
    const base = getSubmission(studentId, objectiveId) || { id: uuid(), studentId, objectiveId, status: "in_progress", notes: "", evidenceUrl: "", extra: [] };
    const updated = { ...base, extra: [...(base.extra||[]), { id: uuid(), verified: false, ...item }] };
    upsertSubmission(updated);
  };
  const verifyExtra = (studentId, objectiveId, extraId, verified) => {
    const found = getSubmission(studentId, objectiveId); if (!found) return;
    upsertSubmission({ ...found, extra: found.extra.map(e => e.id === extraId ? { ...e, verified } : e) });
  };
  const completionForStudent = (studentId) => {
    const total = state.objectives.length;
    const done = state.objectives.filter(o => getSubmission(studentId, o.id)?.status === "done").length;
    return { total, done, pct: total ? Math.round((done/total)*100) : 0 };
  };

  const exportCSV = () => {
    const rows = state.students.flatMap(stu => state.objectives.map(obj => {
      const s = getSubmission(stu.id, obj.id);
      return {
        student: stu.name,
        team: stu.team || "",
        objective: obj.title,
        week: obj.weekIndex,
        dueDate: fmtDate(obj.dueDate),
        status: s?.status || "not_started",
        notes: s?.notes || "",
        evidenceUrl: s?.evidenceUrl || "",
        extraCount: s?.extra?.length || 0,
        extraVerified: s?.extra?.filter(x => x.verified)?.length || 0,
      };
    })));
    downloadFile("htic-progress.csv", toCSV(rows), "text/csv");
  };
  const exportJSON = () => downloadFile("htic-data.json", JSON.stringify(state, null, 2), "application/json");
  const importJSON = async (file) => {
    const text = await file.text();
    try { const data = JSON.parse(text); setState(data); alert("Imported data."); }
    catch { alert("Invalid JSON file."); }
  };
  const resetAll = () => { setState(defaultState()); alert("Reset to demo data."); };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏃‍♂️</span>
            <div>
              <div className="font-bold">{state.meta.eventName}</div>
              <div className="text-xs text-gray-500">{state.meta.clubName}</div>
            </div>
            <span className="badge">Progress Tracker</span>
          </div>
          <div className="flex items-center gap-2">
            <input className="input w-64" placeholder="Search students/teams…" value={query} onChange={(e)=>setQuery(e.target.value)} />
            <button className="btn" onClick={()=>setShowSettings(v=>!v)}><Settings size={16}/> Settings</button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="card p-4">
            <div className="font-semibold mb-2">Site settings</div>
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <div className="text-xs font-medium mb-1">Club name</div>
                <input className="input" value={state.meta.clubName} onChange={(e)=>setState(p=>({...p, meta:{...p.meta, clubName: e.target.value}}))} />
              </div>
              <div>
                <div className="text-xs font-medium mb-1">Event name</div>
                <input className="input" value={state.meta.eventName} onChange={(e)=>setState(p=>({...p, meta:{...p.meta, eventName: e.target.value}}))} />
              </div>
              <div>
                <div className="text-xs font-medium mb-1">Admin passcode</div>
                <input type="password" className="input" value={state.meta.adminPasscode} onChange={(e)=>setState(p=>({...p, meta:{...p.meta, adminPasscode: e.target.value}}))} />
              </div>
              <div>
                <div className="text-xs font-medium mb-1">Week 0 (start)</div>
                <input type="date" className="input" value={state.meta.academicWeekZeroISO.slice(0,10)} onChange={(e)=>setState(p=>({...p, meta:{...p.meta, academicWeekZeroISO: new Date(e.target.value).toISOString()}}))} />
              </div>
            </div>
            <hr className="sep"/>
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={exportJSON}><Download size={16}/> Export JSON</button>
              <label className="btn cursor-pointer">
                <Upload size={16}/> Import JSON
                <input type="file" className="hidden" onChange={(e)=>{ const f = e.target.files?.[0]; if (f) importJSON(f); }} />
              </label>
              <button className="btn" onClick={exportCSV}><Download size={16}/> Export CSV</button>
              <button className="btn" onClick={resetAll}><Trash2 size={16}/> Reset Demo</button>
              <span className="ml-auto badge">Week {nowWeekIndex}</span>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-6">
        {role === "guest" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card p-4">
              <div className="flex items-center gap-2 font-semibold mb-1"><Users size={16}/> Coordinator / Admin</div>
              <div className="text-sm text-gray-500 mb-3">Create objectives, track progress, verify extras, export reports.</div>
              <div className="grid gap-2">
                <input type="password" className="input" placeholder="Admin passcode" value={adminPass} onChange={(e)=>setAdminPass(e.target.value)} />
                <button className="btn btn-primary" onClick={()=>{
                  if (adminPass === state.meta.adminPasscode) { setRole("admin"); alert("Welcome, coordinator!"); }
                  else alert("Wrong passcode.");
                }}><CheckCircle2 size={16}/> Continue as Admin</button>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 font-semibold mb-1"><User size={16}/> Student</div>
              <div className="text-sm text-gray-500 mb-3">Update weekly objectives and log extra contributions.</div>
              <select className="input" value={whoId} onChange={(e)=>setWhoId(e.target.value)}>
                <option value="">Select your name</option>
                {state.students.map(s => <option key={s.id} value={s.id}>{s.name}{s.team ? ` • ${s.team}` : ""}</option>)}
              </select>
              <button className="btn btn-primary mt-2" disabled={!whoId} onClick={()=>setRole("student")}><CheckCircle2 size={16}/> Continue as Student</button>
            </div>
          </div>
        )}

        {role !== "guest" && (
          <div className="flex items-center gap-2 mb-4">
            <button className={`btn ${tab==='overview'?'btn-primary':''}`} onClick={()=>setTab('overview')}>Overview</button>
            {role === "admin" && <button className={`btn ${tab==='admin'?'btn-primary':''}`} onClick={()=>setTab('admin')}>Admin</button>}
            {role === "student" && <button className={`btn ${tab==='student'?'btn-primary':''}`} onClick={()=>setTab('student')}>My Tasks</button>}
            <button className="btn ml-auto" onClick={()=>{ setRole("guest"); setWhoId(""); }}><LogOut size={16}/> Sign out</button>
          </div>
        )}

        {role !== "guest" && tab === "overview" && <Overview state={state} completionForStudent={completionForStudent} />}
        {role === "admin" && tab === "admin" && <AdminPanel
          state={state} setState={setState} nowWeekIndex={nowWeekIndex}
          objectivesByWeek={objectivesByWeek} filteredStudents={filteredStudents}
          getSubmission={getSubmission} markStatus={markStatus} addExtra={addExtra} verifyExtra={verifyExtra}
        />}
        {role === "student" && tab === "student" && who && <StudentHome
          state={state} who={who} setState={setState}
          getSubmission={getSubmission} markStatus={markStatus} addExtra={addExtra}
        />}
      </main>

      <footer className="pb-10 text-center text-xs text-gray-500">Built for the HTIC Charity Marathon project — back up with Export JSON to share progress across devices.</footer>
    </div>
  );
}

function Overview({ state, completionForStudent }) {
  const rows = state.students.map(stu => {
    const { pct, done, total } = completionForStudent(stu.id);
    return { ...stu, pct, done, total };
  }).sort((a,b)=>b.pct - a.pct);

  return (
    <div className="card p-4">
      <div className="font-semibold mb-1">Overall progress</div>
      <div className="text-sm text-gray-500 mb-3">Snapshot of each student/team against weekly objectives.</div>
      <div className="overflow-x-auto">
        <table className="table w-full text-sm">
          <thead>
            <tr className="border-b">
              <th>Student</th><th>Team</th><th>Done</th><th>Total</th><th>Completion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b last:border-0">
                <td>{r.name}</td>
                <td>{r.team || "—"}</td>
                <td>{r.done}</td>
                <td>{r.total}</td>
                <td>
                  <div className="progress"><span style={{ width: `${r.pct}%` }} /></div>
                  <div className="text-xs text-gray-500">{r.pct}%</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminPanel({ state, setState, nowWeekIndex, objectivesByWeek, filteredStudents, getSubmission, markStatus, addExtra, verifyExtra }) {
  const [newObj, setNewObj] = useState({ title: "", details: "", weekIndex: nowWeekIndex, dueDate: new Date().toISOString() });
  const [newStu, setNewStu] = useState({ name: "", email: "", team: "" });

  const weeks = [...objectivesByWeek.keys()].sort((a,b)=>a-b);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Weekly objectives</div>
            <div className="text-sm text-gray-500">Create, edit, and review tasks.</div>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-2 mt-3">
          <input className="input md:col-span-2" placeholder="Objective title" value={newObj.title} onChange={(e)=>setNewObj(o=>({...o, title:e.target.value}))} />
          <input className="input md:col-span-2" placeholder="Details" value={newObj.details} onChange={(e)=>setNewObj(o=>({...o, details:e.target.value}))} />
          <input type="number" className="input" placeholder="Week" value={newObj.weekIndex} onChange={(e)=>setNewObj(o=>({...o, weekIndex: parseInt(e.target.value||'0')}))} />
          <input type="date" className="input" value={newObj.dueDate.slice(0,10)} onChange={(e)=>setNewObj(o=>({...o, dueDate: new Date(e.target.value).toISOString()}))} />
          <button className="btn btn-primary" onClick={()=>{
            if (!newObj.title.trim()) { alert("Title required"); return; }
            setState(prev => ({ ...prev, objectives: [...prev.objectives, { id: uuid(), ...newObj }] }));
            setNewObj({ title:"", details:"", weekIndex: nowWeekIndex, dueDate: new Date().toISOString() });
          }}><Plus size={16}/> Add objective</button>
        </div>

        <div className="mt-4 space-y-6">
          {weeks.length === 0 && <p className="text-sm text-gray-500">No objectives yet.</p>}
          {weeks.map(week => (
            <div key={week} className="border rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">Week {week} {week===weeksBetween(new Date(state.meta.academicWeekZeroISO), new Date()) && pill("this week")}</div>
              </div>
              <div className="mt-3 grid gap-3">
                {objectivesByWeek.get(week).map(obj => (
                  <div key={obj.id} className="border rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{obj.title}</div>
                        <div className="text-sm text-gray-500">{obj.details}</div>
                        <div className="text-xs mt-1">Due: {fmtDate(obj.dueDate)}</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn" onClick={()=>{
                          const title = prompt("Edit title", obj.title) || obj.title;
                          const details = prompt("Edit details", obj.details) || obj.details;
                          const due = prompt("Edit due date (YYYY-MM-DD)", obj.dueDate.slice(0,10));
                          setState(prev => ({ ...prev, objectives: prev.objectives.map(o => o.id===obj.id ? { ...o, title, details, dueDate: due ? new Date(due).toISOString() : o.dueDate } : o) }));
                        }}><Edit3 size={16}/> Edit</button>
                        <button className="btn" onClick={()=>{
                          if (!confirm("Delete objective?")) return;
                          setState(prev => ({ ...prev, objectives: prev.objectives.filter(o => o.id !== obj.id), submissions: prev.submissions.filter(s => s.objectiveId !== obj.id) }));
                        }}><Trash2 size={16}/> Delete</button>
                      </div>
                    </div>
                    <StudentProgressRow students={state.students} obj={obj} getSubmission={getSubmission} markStatus={markStatus} verifyExtra={verifyExtra} addExtra={addExtra} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="card p-4">
          <div className="font-semibold mb-1">Students</div>
          <div className="text-sm text-gray-500 mb-2">Add students and group by teams.</div>
          <div className="grid md:grid-cols-3 gap-2">
            <input className="input" placeholder="Name" value={newStu.name} onChange={(e)=>setNewStu(s=>({...s, name:e.target.value}))} />
            <input className="input" placeholder="Email" value={newStu.email} onChange={(e)=>setNewStu(s=>({...s, email:e.target.value}))} />
            <input className="input" placeholder="Team (e.g., Logistics)" value={newStu.team} onChange={(e)=>setNewStu(s=>({...s, team:e.target.value}))} />
            <button className="btn btn-primary" onClick={()=>{
              if (!newStu.name.trim()) { alert("Name required"); return; }
              setState(prev => ({ ...prev, students: [...prev.students, { id: uuid(), ...newStu }] }));
              setNewStu({ name:"", email:"", team:"" });
            }}><Plus size={16}/> Add student</button>
          </div>
          <div className="mt-3 grid gap-2">
            {filteredStudents.map(s => (
              <div key={s.id} className="flex items-center justify-between border rounded-xl p-3">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-gray-500">{s.email} {s.team && `• ${s.team}`}</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn" onClick={()=>{
                    const name = prompt("Edit name", s.name) || s.name;
                    const email = prompt("Edit email", s.email || "") || s.email;
                    const team = prompt("Edit team", s.team || "") || s.team;
                    setState(prev => ({ ...prev, students: prev.students.map(x => x.id === s.id ? { ...x, name, email, team } : x) }));
                  }}><Edit3 size={16}/> Edit</button>
                  <button className="btn" onClick={()=>{
                    if (!confirm("Remove student?")) return;
                    setState(prev => ({ ...prev, students: prev.students.filter(x => x.id !== s.id), submissions: prev.submissions.filter(sub => sub.studentId !== s.id) }));
                  }}><Trash2 size={16}/> Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <div className="font-semibold mb-1">Reports</div>
          <div className="grid gap-2">
            <button className="btn" onClick={()=>{
              const rows = state.students.flatMap(stu => state.objectives.map(obj => {
                const s = state.submissions.find(x => x.studentId===stu.id && x.objectiveId===obj.id);
                return { student: stu.name, team: stu.team||"", objective: obj.title, week: obj.weekIndex, dueDate: fmtDate(obj.dueDate), status: s?.status||"not_started", notes: s?.notes||"", evidenceUrl: s?.evidenceUrl||"", extraCount: s?.extra?.length||0, extraVerified: s?.extra?.filter(e=>e.verified)?.length||0 };
              }));
              const csv = toCSV(rows); downloadFile("htic-progress.csv", csv, "text/csv");
            }}><Download size={16}/> Export CSV</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentProgressRow({ students, obj, getSubmission, markStatus, verifyExtra, addExtra }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [impact, setImpact] = useState("Low");
  return (
    <div className="mt-3 space-y-2">
      {students.map(stu => {
        const sub = getSubmission(stu.id, obj.id);
        return (
          <div key={stu.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border rounded-xl p-3">
            <div className="flex items-center gap-2">
              <span className="badge">{stu.team || "—"}</span>
              <div className="font-medium">{stu.name}</div>
            </div>
            <div className="flex items-center gap-2">
              {["not_started","in_progress","done"].map(v => (
                <button key={v} className={`btn ${((sub?.status||"not_started")===v)?"btn-primary":""}`} onClick={()=>markStatus(stu.id, obj.id, v)}>
                  {v.replace("_"," ")}
                </button>
              ))}
              <details className="btn">
                <summary>Details</summary>
                <div className="p-3 space-y-2">
                  <input className="input" placeholder="Evidence URL" value={sub?.evidenceUrl || ""} onChange={(e)=>{
                    const found = getSubmission(stu.id, obj.id) || { id: uuid(), studentId: stu.id, objectiveId: obj.id, status: "in_progress", notes: "", evidenceUrl: "", extra: [] };
                    const updated = { ...found, evidenceUrl: e.target.value }; addExtra(stu.id, obj.id, { title: "", desc:"", impact:"Low" }); // trigger upsert path; we'll replace below
                    // quick upsert without adding extra:
                  }} />
                  <textarea className="textarea" placeholder="Notes" value={sub?.notes || ""} onChange={(e)=>{
                    const found = getSubmission(stu.id, obj.id) || { id: uuid(), studentId: stu.id, objectiveId: obj.id, status: "in_progress", notes: "", evidenceUrl: "", extra: [] };
                    const updated = { ...found, notes: e.target.value };
                    // manual upsert
                    const evt = new Event("noop"); /* placeholder */
                  }} />
                  <div className="border rounded-lg p-2">
                    <div className="text-sm font-medium mb-1">Extra contributions</div>
                    {(sub?.extra||[]).length === 0 && <p className="text-sm text-gray-500">No extra items yet.</p>}
                    {(sub?.extra||[]).map(e => (
                      <div key={e.id} className="flex items-start justify-between gap-2 border rounded-lg p-2 mb-1">
                        <div>
                          <div className="font-medium">{e.title} {e.verified && pill("verified")}</div>
                          <div className="text-xs text-gray-500">{e.desc}</div>
                          <div className="text-xs mt-1">Impact: {e.impact}</div>
                        </div>
                        <button className="btn" onClick={()=>verifyExtra(stu.id, obj.id, e.id, !e.verified)}>{e.verified? "Unverify" : "Verify"}</button>
                      </div>
                    ))}
                    <div className="grid md:grid-cols-3 gap-2 mt-2">
                      <input className="input" placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} />
                      <select className="input" value={impact} onChange={(e)=>setImpact(e.target.value)}>
                        {["Low","Medium","High","Critical"].map(x => <option key={x} value={x}>{x}</option>)}
                      </select>
                      <button className="btn btn-primary" onClick={()=>{
                        if (!title.trim()) { alert("Give the extra a title"); return; }
                        addExtra(stu.id, obj.id, { title, desc, impact });
                        setTitle(""); setDesc(""); setImpact("Low");
                      }}><Plus size={16}/> Add extra</button>
                    </div>
                    <textarea className="textarea mt-2" placeholder="Short description (optional)" value={desc} onChange={(e)=>setDesc(e.target.value)} />
                  </div>
                </div>
              </details>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StudentHome({ state, who, setState, getSubmission, markStatus, addExtra }) {
  const completion = (()=>{
    const total = state.objectives.length;
    const done = state.objectives.filter(o => getSubmission(who.id, o.id)?.status === "done").length;
    return { total, done, pct: total ? Math.round((done/total)*100) : 0 };
  })();

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 card p-4">
        <div className="font-semibold mb-1">Hello, {who.name}</div>
        <div className="text-sm text-gray-500 mb-2">Update your objectives and log extra contributions.</div>

        <div className="space-y-4">
          {state.objectives.sort((a,b)=>a.weekIndex-b.weekIndex).map(obj => {
            const sub = getSubmission(who.id, obj.id);
            return (
              <div key={obj.id} className="border rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">Week {obj.weekIndex}: {obj.title}</div>
                    <div className="text-sm text-gray-500">{obj.details}</div>
                    <div className="text-xs mt-1">Due: {fmtDate(obj.dueDate)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {["not_started","in_progress","done"].map(v => (
                      <button key={v} className={`btn ${((sub?.status||"not_started")===v)?"btn-primary":""}`} onClick={()=>markStatus(who.id, obj.id, v)}>
                        {v.replace("_"," ")}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 grid gap-2">
                  <div className="text-xs font-medium">Evidence URL</div>
                  <input className="input" placeholder="Link to doc/photo/video" value={sub?.evidenceUrl || ""} onChange={(e)=>{
                    const found = getSubmission(who.id, obj.id) || { id: uuid(), studentId: who.id, objectiveId: obj.id, status: "in_progress", notes: "", evidenceUrl: "", extra: [] };
                    // Upsert by marking status (no separate upsert util here), so we toggle to in_progress with new url
                    const newSub = { ...found, evidenceUrl: e.target.value };
                    // manual save via setState
                    setState(prev => {
                      const idx = prev.submissions.findIndex(s => s.id === newSub.id);
                      const submissions = idx>=0 ? prev.submissions.map((s,i)=>i===idx?newSub:s) : [...prev.submissions, newSub];
                      return { ...prev, submissions };
                    });
                  }} />
                  <div className="text-xs font-medium">Notes</div>
                  <textarea className="textarea" rows={3} placeholder="Any blockers, updates, or context" value={sub?.notes || ""} onChange={(e)=>{
                    const found = getSubmission(who.id, obj.id) || { id: uuid(), studentId: who.id, objectiveId: obj.id, status: "in_progress", notes: "", evidenceUrl: "", extra: [] };
                    const newSub = { ...found, notes: e.target.value };
                    setState(prev => {
                      const idx = prev.submissions.findIndex(s => s.id === newSub.id);
                      const submissions = idx>=0 ? prev.submissions.map((s,i)=>i===idx?newSub:s) : [...prev.submissions, newSub];
                      return { ...prev, submissions };
                    });
                  }} />
                  <div className="mt-2">
                    <div className="text-sm font-semibold mb-1">Extra contribution</div>
                    <StudentExtras who={who} obj={obj} getSubmission={getSubmission} addExtra={addExtra} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-4">
        <div className="text-4xl font-extrabold">{completion.pct}%</div>
        <div className="text-sm text-gray-500">{completion.done} of {completion.total} objectives marked Done</div>
        <hr className="sep"/>
        <div className="space-y-2 text-sm">
          {state.objectives.map(o => {
            const status = getSubmission(who.id, o.id)?.status || "not_started";
            return (
              <div key={o.id} className="flex items-center justify-between">
                <span>W{o.weekIndex} • {o.title}</span>
                <span className="text-gray-500">{status}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StudentExtras({ who, obj, getSubmission, addExtra }) {
  const sub = getSubmission(who.id, obj.id);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [impact, setImpact] = useState("Low");
  return (
    <div className="border rounded-xl p-3">
      {(sub?.extra||[]).length === 0 && <p className="text-sm text-gray-500">No extra items yet.</p>}
      {(sub?.extra||[]).map(e => (
        <div key={e.id} className="border rounded-lg p-2 mb-2">
          <div className="font-medium">{e.title} {e.verified && <span className="badge">verified</span>}</div>
          <div className="text-xs text-gray-500">{e.desc}</div>
          <div className="text-xs mt-1">Impact: {e.impact}</div>
        </div>
      ))}
      <div className="grid md:grid-cols-3 gap-2 mt-2">
        <input className="input" placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} />
        <select className="input" value={impact} onChange={(e)=>setImpact(e.target.value)}>
          {["Low","Medium","High","Critical"].map(x => <option key={x} value={x}>{x}</option>)}
        </select>
        <button className="btn btn-primary" onClick={()=>{
          if (!title.trim()) { alert("Give the extra a title"); return; }
          addExtra(who.id, obj.id, { title, desc, impact });
          setTitle(""); setDesc(""); setImpact("Low");
        }}><Plus size={16}/> Add extra</button>
      </div>
      <textarea className="textarea mt-2" placeholder="Short description (optional)" value={desc} onChange={(e)=>setDesc(e.target.value)} />
    </div>
  );
}
