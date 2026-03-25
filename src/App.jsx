import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const SHEET_ID = "1ag_qUTZ97Dj0RPsjG1G8BnJe5HDPRFZd05QEUwiy4ps";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

const S = {
  wrap: { maxWidth: 480, margin: "0 auto", padding: "2rem 1rem", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  wrapWide: { maxWidth: 700, margin: "0 auto", padding: "1.5rem 1rem", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  card: { background: "#1e1e1e", border: "1px solid #333", borderRadius: 12, padding: "1.5rem", marginBottom: 12 },
  cardSm: { background: "#1e1e1e", border: "1px solid #333", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: 10 },
  input: { width: "100%", boxSizing: "border-box", background: "#252525", border: "1px solid #383838", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#e8e8e8", marginBottom: 10, outline: "none" },
  btn: { background: "transparent", border: "1px solid #555", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: "#e8e8e8", fontSize: 13 },
  btnPrimary: { background: "#2563eb", border: "none", borderRadius: 8, padding: "10px 16px", cursor: "pointer", color: "#fff", fontSize: 14, fontWeight: 500 },
  btnFull: { width: "100%", background: "transparent", border: "1px solid #555", borderRadius: 8, padding: "10px", cursor: "pointer", color: "#e8e8e8", fontSize: 14, marginBottom: 8 },
  btnPrimaryFull: { width: "100%", background: "#2563eb", border: "none", borderRadius: 8, padding: "10px", cursor: "pointer", color: "#fff", fontSize: 14, marginBottom: 8, fontWeight: 500 },
  h1: { fontSize: 22, fontWeight: 500, color: "#f0f0f0", marginBottom: 6 },
  h2: { fontSize: 16, fontWeight: 500, color: "#f0f0f0", marginBottom: 16 },
  muted: { fontSize: 13, color: "#666" },
  error: { fontSize: 13, color: "#f87171", marginBottom: 10 },
  success: { fontSize: 13, color: "#4ade80", marginBottom: 10 },
  badge: (color) => ({ display: "inline-block", fontSize: 11, padding: "2px 8px", borderRadius: 6, background: color || "#2a2a2a", color: color ? "#fff" : "#aaa", marginLeft: 6 }),
  select: { width: "100%", boxSizing: "border-box", background: "#252525", border: "1px solid #383838", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#e8e8e8", marginBottom: 10, outline: "none" },
};

const CYCLE_LABEL = { daily: "매일", weekly: "매주", monthly: "매월" };

function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
  return lines.slice(1).map(line => {
    const vals = line.match(/(".*?"|[^,]+)(?=,|$)/g) || [];
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (vals[i] || "").replace(/"/g, "").trim();
    });
    return obj;
  }).filter(r => r.name);
}

export default function App() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPw, setRegPw] = useState("");
  const [regName, setRegName] = useState("");
  const [regStore, setRegStore] = useState("");
  const [stores, setStores] = useState([]);

  const [adminTab, setAdminTab] = useState("pending");
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // 게임 DB
  const [games, setGames] = useState([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetPreview, setSheetPreview] = useState([]);
  const [sheetMsg, setSheetMsg] = useState("");
  const [gameTab, setGameTab] = useState("list");
  const [editGame, setEditGame] = useState(null);
  const [addMode, setAddMode] = useState(false);
  const [newGame, setNewGame] = useState({ name: "", category: "", min_players: "", max_players: "", play_time: "", difficulty: "", cycle: "weekly", description: "", note: "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else setLoading(false);
    });
    supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else { setUserProfile(null); setLoading(false); }
    });
    loadStores();
  }, []);

  async function loadStores() {
    const { data } = await supabase.from("stores").select("*").order("name");
    if (data) setStores(data);
  }

  async function loadProfile(uid) {
    setLoading(true);
    const { data } = await supabase.from("users").select("*, stores(name)").eq("id", uid).single();
    setUserProfile(data);
    setLoading(false);
  }

  async function loadPendingUsers() {
    const { data } = await supabase.from("users").select("*, stores(name)").eq("status", "pending").order("created_at");
    if (data) setPendingUsers(data);
  }

  async function loadAllUsers() {
    const { data } = await supabase.from("users").select("*, stores(name)").order("created_at", { ascending: false });
    if (data) setAllUsers(data);
  }

  async function loadGames() {
    setGamesLoading(true);
    const { data } = await supabase.from("games").select("*").order("name");
    if (data) setGames(data);
    setGamesLoading(false);
  }

  useEffect(() => {
    if (userProfile?.role === "master" || userProfile?.role === "supervisor") {
      loadPendingUsers();
      loadAllUsers();
      loadGames();
    }
    if (userProfile?.role === "store" && userProfile?.status === "approved") {
      loadGames();
    }
  }, [userProfile]);

  async function handleLogin() {
    setError(""); setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPw });
    if (error) setError("이메일 또는 비밀번호가 올바르지 않습니다.");
    setAuthLoading(false);
  }

  async function handleRegister() {
    setError(""); setSuccess("");
    if (!regEmail || !regPw || !regName || !regStore) { setError("모든 항목을 입력해주세요."); return; }
    if (regPw.length < 6) { setError("비밀번호는 6자 이상이어야 합니다."); return; }
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: regEmail, password: regPw });
    if (error) { setError(error.message); setAuthLoading(false); return; }
    if (data.user) {
      await supabase.from("users").insert({ id: data.user.id, email: regEmail, name: regName, store_id: regStore, role: "store", status: "pending" });
      await supabase.auth.signOut();
      setSuccess("가입 신청이 완료됐습니다. 관리자 승인 후 이용 가능합니다.");
      setAuthView("login");
    }
    setAuthLoading(false);
  }

  async function approveUser(uid) {
    await supabase.from("users").update({ status: "approved" }).eq("id", uid);
    loadPendingUsers(); loadAllUsers();
  }

  async function rejectUser(uid) {
    await supabase.from("users").update({ status: "rejected" }).eq("id", uid);
    loadPendingUsers(); loadAllUsers();
  }

  async function changeRole(uid, role) {
    await supabase.from("users").update({ role }).eq("id", uid);
    loadAllUsers();
  }

  async function fetchSheetPreview() {
    setSheetLoading(true); setSheetMsg("");
    try {
      const res = await fetch(SHEET_URL);
      const text = await res.text();
      const rows = parseCSV(text);
      setSheetPreview(rows);
      setSheetMsg(`${rows.length}개 게임을 불러왔습니다. 업로드 버튼을 눌러 DB에 저장하세요.`);
    } catch {
      setSheetMsg("구글 시트를 불러오지 못했습니다. 공개 설정을 확인해주세요.");
    }
    setSheetLoading(false);
  }

  async function uploadSheetData() {
    if (!sheetPreview.length) return;
    setSheetLoading(true); setSheetMsg("");
    try {
      const rows = sheetPreview.map(r => ({
        name: r.name || "",
        category: r.category || "",
        min_players: r.min_players ? parseInt(r.min_players) : null,
        max_players: r.max_players ? parseInt(r.max_players) : null,
        play_time: r.play_time || "",
        difficulty: r.difficulty || "",
        cycle: r.cycle || "weekly",
        description: r.description || "",
        note: r.note || "",
      }));
      const { error } = await supabase.from("games").upsert(rows, { onConflict: "name" });
      if (error) throw error;
      setSheetMsg(`${rows.length}개 게임이 DB에 저장됐습니다!`);
      setSheetPreview([]);
      loadGames();
    } catch (e) {
      setSheetMsg("업로드 중 오류가 발생했습니다: " + e.message);
    }
    setSheetLoading(false);
  }

  async function saveNewGame() {
    if (!newGame.name.trim()) return;
    await supabase.from("games").insert({ ...newGame, min_players: newGame.min_players ? parseInt(newGame.min_players) : null, max_players: newGame.max_players ? parseInt(newGame.max_players) : null });
    setNewGame({ name: "", category: "", min_players: "", max_players: "", play_time: "", difficulty: "", cycle: "weekly", description: "", note: "" });
    setAddMode(false);
    loadGames();
  }

  async function saveEditGame() {
    await supabase.from("games").update({ ...editGame, min_players: editGame.min_players ? parseInt(editGame.min_players) : null, max_players: editGame.max_players ? parseInt(editGame.max_players) : null }).eq("id", editGame.id);
    setEditGame(null);
    loadGames();
  }

  async function deleteGame(id) {
    if (!window.confirm("정말 삭제할까요?")) return;
    await supabase.from("games").delete().eq("id", id);
    loadGames();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (loading) return <div style={{ textAlign: "center", padding: "4rem", color: "#666", fontFamily: "sans-serif" }}>불러오는 중...</div>;

  if (!session || !userProfile) return (
    <div style={S.wrap}>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 style={S.h1}>🎲 레드버튼</h1>
        <p style={S.muted}>보드게임 관리 시스템</p>
      </div>
      {authView === "login" && (
        <div style={S.card}>
          <h2 style={S.h2}>로그인</h2>
          {error && <p style={S.error}>{error}</p>}
          {success && <p style={S.success}>{success}</p>}
          <input placeholder="이메일" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} style={S.input} />
          <input placeholder="비밀번호" type="password" value={loginPw} onChange={e => setLoginPw(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} style={S.input} />
          <button onClick={handleLogin} style={S.btnPrimaryFull} disabled={authLoading}>{authLoading ? "로그인 중..." : "로그인"}</button>
          <button onClick={() => { setAuthView("register"); setError(""); setSuccess(""); }} style={S.btnFull}>계정이 없으신가요? 가입 신청</button>
        </div>
      )}
      {authView === "register" && (
        <div style={S.card}>
          <h2 style={S.h2}>가입 신청</h2>
          {error && <p style={S.error}>{error}</p>}
          <input placeholder="이름" value={regName} onChange={e => setRegName(e.target.value)} style={S.input} />
          <input placeholder="이메일" value={regEmail} onChange={e => setRegEmail(e.target.value)} style={S.input} />
          <input placeholder="비밀번호 (6자 이상)" type="password" value={regPw} onChange={e => setRegPw(e.target.value)} style={S.input} />
          <select value={regStore} onChange={e => setRegStore(e.target.value)} style={S.select}>
            <option value="">근무 매장 선택</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={handleRegister} style={S.btnPrimaryFull} disabled={authLoading}>{authLoading ? "신청 중..." : "가입 신청"}</button>
          <button onClick={() => { setAuthView("login"); setError(""); }} style={S.btnFull}>이미 계정이 있으신가요? 로그인</button>
        </div>
      )}
    </div>
  );

  if (userProfile.status === "pending") return (
    <div style={{ ...S.wrap, textAlign: "center", paddingTop: "4rem" }}>
      <div style={S.card}>
        <p style={{ fontSize: 15, color: "#f0f0f0", marginBottom: 8 }}>승인 대기 중</p>
        <p style={S.muted}>관리자 승인 후 이용 가능합니다.</p>
        <button onClick={handleLogout} style={{ ...S.btnFull, marginTop: 16 }}>로그아웃</button>
      </div>
    </div>
  );

  if (userProfile.status === "rejected") return (
    <div style={{ ...S.wrap, textAlign: "center", paddingTop: "4rem" }}>
      <div style={S.card}>
        <p style={{ fontSize: 15, color: "#f87171", marginBottom: 8 }}>가입이 거부됐습니다.</p>
        <p style={S.muted}>관리자에게 문의해주세요.</p>
        <button onClick={handleLogout} style={{ ...S.btnFull, marginTop: 16 }}>로그아웃</button>
      </div>
    </div>
  );

  const GameForm = ({ game, setGame, onSave, onCancel }) => (
    <div style={{ ...S.card, background: "#181818" }}>
      <input placeholder="게임 이름 *" value={game.name} onChange={e => setGame(g => ({ ...g, name: e.target.value }))} style={S.input} />
      <input placeholder="카테고리 (예: 전략, 파티)" value={game.category} onChange={e => setGame(g => ({ ...g, category: e.target.value }))} style={S.input} />
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="최소 인원" value={game.min_players} onChange={e => setGame(g => ({ ...g, min_players: e.target.value }))} style={{ ...S.input, flex: 1 }} />
        <input placeholder="최대 인원" value={game.max_players} onChange={e => setGame(g => ({ ...g, max_players: e.target.value }))} style={{ ...S.input, flex: 1 }} />
      </div>
      <input placeholder="플레이 시간 (예: 30-60분)" value={game.play_time} onChange={e => setGame(g => ({ ...g, play_time: e.target.value }))} style={S.input} />
      <input placeholder="난이도 (예: 하, 중, 상)" value={game.difficulty} onChange={e => setGame(g => ({ ...g, difficulty: e.target.value }))} style={S.input} />
      <select value={game.cycle} onChange={e => setGame(g => ({ ...g, cycle: e.target.value }))} style={S.select}>
        <option value="daily">매일</option>
        <option value="weekly">매주</option>
        <option value="monthly">매월</option>
      </select>
      <input placeholder="게임 설명" value={game.description} onChange={e => setGame(g => ({ ...g, description: e.target.value }))} style={S.input} />
      <input placeholder="참고 메모" value={game.note} onChange={e => setGame(g => ({ ...g, note: e.target.value }))} style={S.input} />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} style={{ ...S.btnPrimary, flex: 1 }}>저장</button>
        <button onClick={onCancel} style={{ ...S.btn, flex: 1 }}>취소</button>
      </div>
    </div>
  );

  // 마스터 관리자 화면
  if (userProfile.role === "master") return (
    <div style={S.wrapWide}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ ...S.h1, marginBottom: 2 }}>마스터 관리자</h1>
          <p style={S.muted}>{userProfile.name}</p>
        </div>
        <button onClick={handleLogout} style={S.btn}>로그아웃</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" }}>
        {["pending", "users", "games", "sheet"].map(t => (
          <button key={t} onClick={() => setAdminTab(t)} style={{ ...S.btn, background: adminTab === t ? "#2a2a2a" : "transparent", fontWeight: adminTab === t ? 500 : 400 }}>
            {t === "pending" ? `승인 대기 (${pendingUsers.length})` : t === "users" ? `전체 계정 (${allUsers.length})` : t === "games" ? `게임 DB (${games.length})` : "구글 시트 연동"}
          </button>
        ))}
      </div>

      {adminTab === "pending" && (
        pendingUsers.length === 0
          ? <div style={{ ...S.card, textAlign: "center" }}><p style={S.muted}>대기 중인 가입 신청이 없습니다.</p></div>
          : pendingUsers.map(u => (
            <div key={u.id} style={S.cardSm}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 500, color: "#f0f0f0" }}>{u.name}</p>
                  <p style={S.muted}>{u.email} · {u.stores?.name || "-"}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => approveUser(u.id)} style={{ ...S.btn, color: "#4ade80", borderColor: "#4ade80" }}>승인</button>
                  <button onClick={() => rejectUser(u.id)} style={{ ...S.btn, color: "#f87171", borderColor: "#f87171" }}>거부</button>
                </div>
              </div>
            </div>
          ))
      )}

      {adminTab === "users" && allUsers.map(u => (
        <div key={u.id} style={S.cardSm}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontSize: 15, fontWeight: 500, color: "#f0f0f0" }}>{u.name}</span>
              <span style={S.badge(u.status === "approved" ? "#16a34a" : u.status === "pending" ? "#b45309" : "#991b1b")}>
                {u.status === "approved" ? "승인" : u.status === "pending" ? "대기" : "거부"}
              </span>
              <p style={{ ...S.muted, marginTop: 2 }}>{u.email} · {u.stores?.name || "-"}</p>
            </div>
            <select value={u.role} onChange={e => changeRole(u.id, e.target.value)} style={{ ...S.select, width: "auto", marginBottom: 0, fontSize: 12, padding: "4px 8px" }}>
              <option value="store">매장</option>
              <option value="supervisor">슈퍼바이저</option>
              <option value="master">마스터</option>
            </select>
          </div>
        </div>
      ))}

      {adminTab === "games" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p style={S.muted}>총 {games.length}개 게임</p>
            <button onClick={() => setAddMode(true)} style={S.btnPrimary}>+ 게임 추가</button>
          </div>
          {addMode && <GameForm game={newGame} setGame={setNewGame} onSave={saveNewGame} onCancel={() => setAddMode(false)} />}
          {gamesLoading ? <p style={S.muted}>불러오는 중...</p> : games.map(g => (
            <div key={g.id} style={S.cardSm}>
              {editGame?.id === g.id ? (
                <GameForm game={editGame} setGame={setEditGame} onSave={saveEditGame} onCancel={() => setEditGame(null)} />
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 15, fontWeight: 500, color: "#f0f0f0" }}>{g.name}</span>
                    {g.category && <span style={S.badge()}>{g.category}</span>}
                    <span style={S.badge()}>{CYCLE_LABEL[g.cycle] || g.cycle}</span>
                    <p style={{ ...S.muted, marginTop: 2 }}>{[g.min_players && `${g.min_players}-${g.max_players}인`, g.play_time, g.difficulty].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setEditGame(g)} style={S.btn}>수정</button>
                    <button onClick={() => deleteGame(g.id)} style={{ ...S.btn, color: "#f87171" }}>삭제</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {adminTab === "sheet" && (
        <div>
          <div style={S.card}>
            <h2 style={{ ...S.h2, marginBottom: 8 }}>구글 시트 연동</h2>
            <p style={{ ...S.muted, marginBottom: 16, lineHeight: 1.6 }}>
              구글 시트 1행에 아래 헤더가 있어야 합니다:<br />
              <code style={{ color: "#7dd3fc", fontSize: 12 }}>name, category, min_players, max_players, play_time, difficulty, cycle, description, note</code>
            </p>
            {sheetMsg && <p style={{ ...S.muted, color: sheetMsg.includes("오류") ? "#f87171" : "#4ade80", marginBottom: 12 }}>{sheetMsg}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={fetchSheetPreview} style={S.btnPrimary} disabled={sheetLoading}>
                {sheetLoading ? "불러오는 중..." : "시트 미리보기"}
              </button>
              {sheetPreview.length > 0 && (
                <button onClick={uploadSheetData} style={{ ...S.btnPrimary, background: "#16a34a" }} disabled={sheetLoading}>
                  DB에 업로드 ({sheetPreview.length}개)
                </button>
              )}
            </div>
          </div>
          {sheetPreview.length > 0 && (
            <div style={S.card}>
              <p style={{ ...S.muted, marginBottom: 12 }}>미리보기 (최대 5개)</p>
              {sheetPreview.slice(0, 5).map((g, i) => (
                <div key={i} style={{ borderBottom: "1px solid #2a2a2a", paddingBottom: 8, marginBottom: 8 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "#f0f0f0" }}>{g.name}</p>
                  <p style={S.muted}>{[g.category, g.play_time, g.difficulty].filter(Boolean).join(" · ")}</p>
                </div>
              ))}
              {sheetPreview.length > 5 && <p style={S.muted}>외 {sheetPreview.length - 5}개...</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // 일반 매장 사용자 화면
  return (
    <div style={S.wrapWide}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ ...S.h1, marginBottom: 2 }}>보드게임 관리</h1>
          <p style={S.muted}>{userProfile.name} · {userProfile.stores?.name || "-"}</p>
        </div>
        <button onClick={handleLogout} style={S.btn}>로그아웃</button>
      </div>
      <div style={S.card}>
        <p style={{ color: "#aaa", fontSize: 14 }}>총 {games.length}개 게임이 등록되어 있습니다. 게임 관리 기능은 다음 단계에서 추가됩니다.</p>
      </div>
    </div>
  );
}