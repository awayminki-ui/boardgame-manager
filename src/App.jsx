import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const S = {
  wrap: { maxWidth: 480, margin: "0 auto", padding: "2rem 1rem", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  card: { background: "#1e1e1e", border: "1px solid #333", borderRadius: 12, padding: "1.5rem", marginBottom: 12 },
  input: { width: "100%", boxSizing: "border-box", background: "#252525", border: "1px solid #383838", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#e8e8e8", marginBottom: 10, outline: "none" },
  btn: { width: "100%", background: "transparent", border: "1px solid #555", borderRadius: 8, padding: "10px", cursor: "pointer", color: "#e8e8e8", fontSize: 14, marginBottom: 8 },
  btnPrimary: { width: "100%", background: "#2563eb", border: "none", borderRadius: 8, padding: "10px", cursor: "pointer", color: "#fff", fontSize: 14, marginBottom: 8, fontWeight: 500 },
  h1: { fontSize: 22, fontWeight: 500, color: "#f0f0f0", marginBottom: 6 },
  h2: { fontSize: 16, fontWeight: 500, color: "#f0f0f0", marginBottom: 16 },
  muted: { fontSize: 13, color: "#666" },
  error: { fontSize: 13, color: "#f87171", marginBottom: 10 },
  success: { fontSize: 13, color: "#4ade80", marginBottom: 10 },
  badge: (color) => ({ display: "inline-block", fontSize: 11, padding: "2px 8px", borderRadius: 6, background: color || "#2a2a2a", color: color ? "#fff" : "#aaa", marginLeft: 6 }),
  select: { width: "100%", boxSizing: "border-box", background: "#252525", border: "1px solid #383838", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#e8e8e8", marginBottom: 10, outline: "none" },
};

export default function App() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authView, setAuthView] = useState("login");
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 로그인 폼
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");

  // 회원가입 폼
  const [regEmail, setRegEmail] = useState("");
  const [regPw, setRegPw] = useState("");
  const [regName, setRegName] = useState("");
  const [regStore, setRegStore] = useState("");
  const [stores, setStores] = useState([]);

  // 관리자
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [adminTab, setAdminTab] = useState("pending");

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

  useEffect(() => {
    if (userProfile?.role === "master" || userProfile?.role === "supervisor") {
      loadPendingUsers();
      loadAllUsers();
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

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  // 로딩
  if (loading) return (
    <div style={{ ...S.wrap, textAlign: "center", paddingTop: "4rem" }}>
      <p style={S.muted}>불러오는 중...</p>
    </div>
  );

  // 미로그인
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
          <button onClick={handleLogin} style={S.btnPrimary} disabled={authLoading}>{authLoading ? "로그인 중..." : "로그인"}</button>
          <button onClick={() => { setAuthView("register"); setError(""); setSuccess(""); }} style={S.btn}>계정이 없으신가요? 가입 신청</button>
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
          <button onClick={handleRegister} style={S.btnPrimary} disabled={authLoading}>{authLoading ? "신청 중..." : "가입 신청"}</button>
          <button onClick={() => { setAuthView("login"); setError(""); }} style={S.btn}>이미 계정이 있으신가요? 로그인</button>
        </div>
      )}
    </div>
  );

  // 승인 대기 중
  if (userProfile.status === "pending") return (
    <div style={{ ...S.wrap, textAlign: "center", paddingTop: "4rem" }}>
      <div style={S.card}>
        <p style={{ fontSize: 15, color: "#f0f0f0", marginBottom: 8 }}>승인 대기 중</p>
        <p style={S.muted}>관리자 승인 후 이용 가능합니다.</p>
        <button onClick={handleLogout} style={{ ...S.btn, marginTop: 16 }}>로그아웃</button>
      </div>
    </div>
  );

  // 승인 거부
  if (userProfile.status === "rejected") return (
    <div style={{ ...S.wrap, textAlign: "center", paddingTop: "4rem" }}>
      <div style={S.card}>
        <p style={{ fontSize: 15, color: "#f87171", marginBottom: 8 }}>가입이 거부됐습니다.</p>
        <p style={S.muted}>관리자에게 문의해주세요.</p>
        <button onClick={handleLogout} style={{ ...S.btn, marginTop: 16 }}>로그아웃</button>
      </div>
    </div>
  );

  // 관리자 화면 (master)
  if (userProfile.role === "master") return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "1.5rem 1rem", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ ...S.h1, marginBottom: 2 }}>마스터 관리자</h1>
          <p style={S.muted}>{userProfile.name}</p>
        </div>
        <button onClick={handleLogout} style={{ ...S.btn, width: "auto", padding: "6px 14px", fontSize: 13 }}>로그아웃</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
        {["pending", "users"].map(t => (
          <button key={t} onClick={() => setAdminTab(t)} style={{ ...S.btn, width: "auto", padding: "6px 14px", fontSize: 13, background: adminTab === t ? "#2a2a2a" : "transparent", fontWeight: adminTab === t ? 500 : 400 }}>
            {t === "pending" ? `승인 대기 (${pendingUsers.length})` : `전체 계정 (${allUsers.length})`}
          </button>
        ))}
      </div>

      {adminTab === "pending" && (
        pendingUsers.length === 0
          ? <div style={{ ...S.card, textAlign: "center" }}><p style={S.muted}>대기 중인 가입 신청이 없습니다.</p></div>
          : pendingUsers.map(u => (
            <div key={u.id} style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 500, color: "#f0f0f0" }}>{u.name}</p>
                  <p style={S.muted}>{u.email}</p>
                  <p style={{ ...S.muted, marginTop: 2 }}>매장: {u.stores?.name || "-"}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => approveUser(u.id)} style={{ ...S.btn, width: "auto", padding: "5px 12px", fontSize: 12, color: "#4ade80", borderColor: "#4ade80" }}>승인</button>
                  <button onClick={() => rejectUser(u.id)} style={{ ...S.btn, width: "auto", padding: "5px 12px", fontSize: 12, color: "#f87171", borderColor: "#f87171" }}>거부</button>
                </div>
              </div>
            </div>
          ))
      )}

      {adminTab === "users" && (
        allUsers.map(u => (
          <div key={u.id} style={S.card}>
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
        ))
      )}
    </div>
  );

  // 일반 매장 사용자 화면
  return (
    <div style={S.wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={S.h1}>보드게임 관리</h1>
          <p style={S.muted}>{userProfile.name} · {userProfile.stores?.name || "-"}</p>
        </div>
        <button onClick={handleLogout} style={{ ...S.btn, width: "auto", padding: "6px 14px", fontSize: 13 }}>로그아웃</button>
      </div>
      <div style={S.card}>
        <p style={{ color: "#aaa", fontSize: 14 }}>게임 관리 기능은 다음 단계에서 추가됩니다.</p>
      </div>
    </div>
  );
}