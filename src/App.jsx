import React, { useEffect, useMemo, useState } from "react";
import { Download, Upload, Plus, Trash2, LogOut, CheckCircle2, Settings, Edit3, User, Users } from "lucide-react";
import { v4 as uuid } from "uuid";

const LS_KEY = "htic_marathon_tracker_v1";

// --- Demo Data ---
const demoStudents = [
  { id: uuid(), name: "A. Perera", email: "aperera@sttoms.edu", team: "Logistics" },
  { id: uuid(), name: "B. Silva", email: "bsilva@sttoms.edu", team: "Sponsorships" },
  { id: uuid(), name: "C. Fernando", email: "cfernando@sttoms.edu", team: "Media" },
];

// --- Helpers ---
const startOfWeek = (d = new Date()) => {
  const date = new Date(d);
  const day = date.getDay(); // 0 Sun ... 6 Sat
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  return new Date(date.setDate(diff));
};
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
const weeksBetween = (dateA, dateB) => Math.floor((+startOfWeek(dateB) - +startOfWeek(dateA)) / (7 * 24 * 3600 * 1000));
const pill = (txt) => <span className="badge">{txt}</span>;

const toCSV = (rows) => {
  if (!rows || rows.length === 0) return "";
  const keys = Object.keys(rows[0]);
  const head = keys.join(",");
  const body = rows
    .map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))
    .join("\n");
  return `${head}\n${body}`;
};
const downloadFile = (name, content, type = "text/plain") => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

// --- Default State ---
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
      {
        id: uuid(),
        title: "Confirm venue & route permissions (2 km)",
        details: "Obtain approval; sketch 1 km up/1 km down route.",
        weekIndex: 0,
        dueDate: new Date().toISOString(),
      },
      {
        id: uuid(),
        title: "Water & first-aid coordination",
        details: "Quotations, assign water points and first-aid volunteers.",
        weekIndex: 0,
        dueDate: new Date(Date.now() + 3 * 86400000).toISOString(),
      },
      {
        id: uuid(),
        title: "Sponsorship letter & outreach",
        details: "Draft letter, list 20 sponsors, begin outreach.",
        weekIndex: 1,
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      },
    ],
    // submissions: [{ id, studentId, objectiveId, status, notes, evidenceUrl, extra:[{id,title,desc,impact,verified}] }]
    submissions: [],
  };
};

// --- Storage ---
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    return JSON.parse(raw);
  } catch {
    return defaultState();
  }
}
function saveState(state) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

const statuses = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

export default function App() {
  const [state, setState] = useState(loadState());
  const [tab, setTab] = useState("overview"); // overview | admin | student
  const [role, setRole] = useState("guest"); // guest | admin | student
  const [adminPass, setAdminPass] = useState("");
  const [whoId, setWhoId] = useState("");
  const [query, setQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => saveState(state), [state]);

  const weekZero = useMemo(() => new Date(state.meta.academicWeekZeroISO), [state.meta.academicWeekZeroISO]);
  const nowWeekIndex = useMemo(() => weeksBetween(weekZero, new Date()), [weekZero]);

  const who = state.students.find((s) => s.id === whoId) || null;

  // --- Derived ---
  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return state.students;
    return state.students.filter((s) => [s.name, s.email, s.team].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [state.students, query]);

  const objectivesByWeek = useMemo(() => {
    const m = new Map();
    state.objectives.forEach((o) => {
      const arr = m.get(o.weekIndex) || [];
      arr.push(o);
      m.set(o.weekIndex, arr);
    });
    return m;
  }, [state.objectives]);

  // --- Submission utilities ---
  const getSubmission = (studentId, objectiveId) =>
    state.submissions.find((s) => s.studentId === studentId && s.objectiveId === objectiveId);

  const upsertSubmission = (sub) => {
    setState((prev) => {
      const idx = prev.submissions.findIndex((s) => s.id === sub.id);
      if (idx >= 0) {
        const next = [...prev.submissions];
        next[idx] = sub;
        return { ...prev, submissions: next };
      }
      return { ...prev, submissions: [...prev.submissions, sub] };
    });
  };

  const updateSubmission = (studentId, objectiveId, patch) => {
    const base =
      getSubmission(studentId, objectiveId) || {
        id: uuid(),
        studentId,
        objectiveId,
        status: "in_progress",
        notes: "",
        evidenceUrl: "",
        extra: [],
      };
    upsertSubmission({ ...base, ...patch });
  };

  const markStatus = (studentId, objectiveId, status) => {
    updateSubmission(studentId, objectiveId, { status });
  };

  const addExtra = (studentId, objectiveId, item) => {
    const base =
      getSubmission(studentId, objectiveId) || {
        id: uuid(),
        studentId,
        objectiveId,
        status: "in_progress",
        notes: "",
        evidenceUrl: "",
        extra: [],
      };
    const updated = { ...base, extra: [...(base.extra || []), { id: uuid(), verified: false, ...item }] };
    upsertSubmission(updated);
  };

  const verifyExtra = (studentId, objectiveId, extraId, verified) => {
    const found = getSubmission(studentId, objectiveId);
    if (!found) return;
    const updated = { ...found, extra: found.extra.map((e) => (e.id === extraId ? { ...e, verified } : e)) };
    upsertSubmission(updated);
  };

  const completionForStudent = (studentId) => {
    const total = state.objectives.length;
    const done = state.objectives.filter((o) => {
      const s = getSubmission(studentId, o.id);
      return s && s.status === "done";
    }).length;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  };

  // --- UI ---
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
            <input
              className="input w-64"
              placeholder="Search students/teams…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn" onClick={() => setShowSettings((v) => !v)}>
              <Settings size={16} /> Settings
            </button>
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
                <input
                  className="input"
                  value={state.meta.clubName}
                  onChange={(e) => setState((p) => ({ ...p, meta: { ...p.meta, clubName: e.target.value } }))}
                />
              </div>
              <div>
                <div className="text-xs font-medium mb-1">Event name</div>
                <input
                  className="input"
                  value={state.meta.eventName}
                  onChange={(e) => setState((p) => ({ ...p, meta: { ...p.meta, eventName: e.target.value } }))}
                />
              </div>
              <div>
                <div className="text-xs font-medium mb-1">Admin passcode</div>
                <input
                  type="password"
                  className="input"
                  value={state.meta.adminPasscode}
                  onChange={(e) => setState((p) => ({ ...p, meta: { ...p.meta, adminPasscode: e.target.value } }))}
                />
              </div>
              <div>
                <div className="text-xs font-medium mb-1">Week 0 (start)</div>
                <input
                  type="date"
                  className="input"
                  value={state.meta.academicWeekZeroISO.slice(0, 10)}
                  onChange={(e) =>
                    setState((p) => ({
                      ...p,
                      meta: { ...p.meta, academicWeekZeroISO: new Date(e.target.value).toISOString() },
                    }))
                  }
                />
              </div>
            </div>
            <hr className="sep" />
            <div className="flex flex-wrap gap-2">
              <button
                className="btn"
                onClick={() => downloadFile("htic-data.json", JSON.stringify(state, null, 2), "application/json")}
              >
                <Download size={16} /> Export JSON
              </button>
              <label className="btn cursor-pointer">
                <Upload size={16} /> Import JSON
                <input
                  type="file"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files && e.target.files[0];
                    if (!f) return;
                    try {
                      const text = await f.text();
                      const data = JSON.parse(text);
                      setState(data);
                      alert("Imported data.");
                    } catch {
                      alert("Invalid JSON file.");
                    }
                  }}
                />
              </label>
              <button
                className="btn"
                onClick={() => {
                  const rows = state.students.flatMap((stu) =>
                    state.objectives.map((obj) => {
                      const s = state.submissions.find(
                        (x) => x.studentId === stu.id && x.objectiveId === obj.id
                      );
                      return {
                        student: stu.name,
                        team: stu.team || "",
                        objective: obj.title,

