import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const SHEET_ID = "1ag_qUTZ97Dj0RPsjG1G8BnJe5HDPRFZd05QEUwiy4ps";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

const S = {
  wrap: { maxWidth: 480, margin: "0 auto", padding: "2rem 1rem", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  wrapWide: { maxWidth: 760, margin: "0 auto", padding: "1.5rem 1rem", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  card: { background: "#1e1e1e", border: "1px solid #333", borderRadius: 12, padding: "1.5rem", marginBottom: 12 },
  cardSm: { background: "#1e1e1e", border: "1px solid #333", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: 10 },
  input: { width: "100%", boxSizing: "border-box", background: "#252525", border: "1px solid #383838", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#e8e8e8", marginBottom: 10, outline: "none" },
  btn: { background: "transparent", border: "1px solid #555", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: "#e8e8e8", fontSize: 13 },
  btnPrimary: { background: "#2563eb", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 500 },
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
    headers.forEach((h, i) => { obj[h] = (vals[i] || "").replace(/"/g, "").trim(); });
    return obj;
  }).filter(r => r.name);
}

// 구성물 관리 모달
function ComponentManager({ game, onClose }) {
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComp, setNewComp] = useState({ name: "", quantity: 1 });
  const [uploading, setUploading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editComp, setEditComp] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const fileRef = useRef();
  const editFileRef = useRef();

  useEffect(() => { loadComponents(); }, []);

  async function loadComponents() {
    setLoading(true);
    const { data } = await supabase.from("game_components").select("*").eq("game_id", game.id).order("order_num");
    if (data) setComponents(data);
    setLoading(false);
  }

  async function uploadImage(file) {
    const ext = file.name.split(".").pop();
    const path = `components/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("game-images").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("game-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function addComponent() {
    if (!newComp.name.trim()) return;
    setUploading(true);
    let image_url = null;
    if (fileRef.current?.files[0]) {
      try { image_url = await uploadImage(fileRef.current.files[0]); } catch {}
    }
    await supabase.from("game_components").insert({
      game_id: game.id, name: newComp.name, quantity: parseInt(newComp.quantity) || 1,
      image_url, order_num: components.length,
    });
    setNewComp({ name: "", quantity: 1 });
    if (fileRef.current) fileRef.current.value = "";
    setUploading(false);
    loadComponents();
  }

  async function saveEdit() {
    setUploading(true);
    let image_url = editComp.image_url;
    if (editFileRef.current?.files[0]) {
      try { image_url = await uploadImage(editFileRef.current.files[0]); } catch {}
    }
    await supabase.from("game_components").update({ name: editComp.name, quantity: parseInt(editComp.quantity) || 1, image_url }).eq("id", editId);
    setEditId(null); setEditComp(null);
    setUploading(false);
    loadComponents();
  }

  async function deleteComponent(id, imageUrl) {
    if (!window.confirm("삭제할까요?")) return;
    if (imageUrl) {
      const path = imageUrl.split("/game-images/")[1];
      if (path) await supabase.storage.from("game-images").remove([path]);
    }
    await supabase.from("game_components").delete().eq("id", id);
    loadComponents();
  }

  return (
    <>
      {/* 라이트박스 */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 300, cursor: "zoom-out",
          }}
        >
          <img
            src={lightbox}
            alt=""
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, objectFit: "contain" }}
            onClick={e => e.stopPropagation()}
          />
          <div
            onClick={() => setLightbox(null)}
            style={{ position: "absolute", top: 20, right: 24, color: "#fff", fontSize: 28, cursor: "pointer", lineHeight: 1 }}
          >✕</div>
        </div>
      )}

      {/* 모달 */}
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        zIndex: 100, overflowY: "auto", padding: "2rem 1rem",
      }}>
        <div style={{ background: "#1a1a1a", borderRadius: 16, padding: "1.5rem", width: "100%", maxWidth: 560, border: "1px solid #333" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: "#f0f0f0" }}>{game.name}</h2>
              <p style={S.muted}>구성물 관리</p>
            </div>
            <button onClick={onClose} style={S.btn}>닫기</button>
          </div>

          {/* 구성물 추가 */}
          <div style={{ background: "#252525", borderRadius: 12, padding: "1rem", marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#aaa", marginBottom: 10 }}>새 구성물 추가</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input placeholder="구성물 이름" value={newComp.name} onChange={e => setNewComp(c => ({ ...c, name: e.target.value }))} style={{ ...S.input, flex: 2, marginBottom: 0 }} />
              <input placeholder="수량" type="number" min="1" value={newComp.quantity} onChange={e => setNewComp(c => ({ ...c, quantity: e.target.value }))} style={{ ...S.input, flex: 1, marginBottom: 0 }} />
            </div>
            <div style={{ margin: "10px 0" }}>
              <input type="file" accept="image/*" ref={fileRef} style={{ fontSize: 13, color: "#aaa" }} />
            </div>
            <button onClick={addComponent} style={S.btnPrimary} disabled={uploading}>
              {uploading ? "저장 중..." : "+ 추가"}
            </button>
          </div>

          {/* 구성물 목록 */}
          {loading ? (
            <p style={S.muted}>불러오는 중...</p>
          ) : components.length === 0 ? (
            <p style={{ ...S.muted, textAlign: "center", padding: "1rem" }}>등록된 구성물이 없습니다.</p>
          ) : (
            components.map(c => (
              <div key={c.id} style={{ background: "#222", border: "1px solid #333", borderRadius: 12, padding: "1rem", marginBottom: 10 }}>
                {editId === c.id ? (
                  <div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input value={editComp.name} onChange={e => setEditComp(x => ({ ...x, name: e.target.value }))} style={{ ...S.input, flex: 2, marginBottom: 0 }} />
                      <input type="number" min="1" value={editComp.quantity} onChange={e => setEditComp(x => ({ ...x, quantity: e.target.value }))} style={{ ...S.input, flex: 1, marginBottom: 0 }} />
                    </div>
                    <div style={{ margin: "8px 0" }}>
                      {editComp.image_url && (
                        <img src={editComp.image_url} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6, marginRight: 10 }} />
                      )}
                      <input type="file" accept="image/*" ref={editFileRef} style={{ fontSize: 13, color: "#aaa" }} />
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={saveEdit} style={S.btnPrimary} disabled={uploading}>{uploading ? "저장 중..." : "저장"}</button>
                      <button onClick={() => { setEditId(null); setEditComp(null); }} style={S.btn}>취소</button>
                      <button onClick={() => setMethodGame(g)} style={{ ...S.btn, color: "#a78bfa", borderColor: "#a78bfa" }}>관리 방법</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {c.image_url ? (
                      <img
                        src={c.image_url}
                        alt={c.name}
                        onClick={() => setLightbox(c.image_url)}
                        style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0, cursor: "zoom-in" }}
                      />
                    ) : (
                      <div style={{ width: 56, height: 56, borderRadius: 8, background: "#333", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: "#555" }}>없음</span>
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: "#f0f0f0", margin: 0 }}>{c.name}</p>
                      <p style={{ ...S.muted, marginTop: 2 }}>수량: {c.quantity}개</p>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setEditId(c.id); setEditComp(c); }} style={S.btn}>수정</button>
                      <button onClick={() => deleteComponent(c.id, c.image_url)} style={{ ...S.btn, color: "#f87171" }}>삭제</button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
function MethodManager({ game, onClose }) {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMethod, setNewMethod] = useState({ content: "" });
  const [uploading, setUploading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editMethod, setEditMethod] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const fileRef = useRef();
  const editFileRef = useRef();

  useEffect(() => { loadMethods(); }, []);

  async function loadMethods() {
    setLoading(true);
    const { data } = await supabase.from("game_methods").select("*").eq("game_id", game.id).order("order_num");
    if (data) setMethods(data);
    setLoading(false);
  }

  async function uploadImage(file) {
    const ext = file.name.split(".").pop();
    const path = `methods/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("game-images").upload(path, file, {
      cacheControl: "3600", upsert: true,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("game-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function addMethod() {
    if (!newMethod.content.trim()) return;
    setUploading(true);
    let image_url = null;
    if (fileRef.current?.files[0]) {
      try { image_url = await uploadImage(fileRef.current.files[0]); } catch {}
    }
    await supabase.from("game_methods").insert({
      game_id: game.id, content: newMethod.content,
      image_url, order_num: methods.length,
    });
    setNewMethod({ content: "" });
    if (fileRef.current) fileRef.current.value = "";
    setUploading(false);
    loadMethods();
  }

  async function saveEdit() {
    setUploading(true);
    let image_url = editMethod.image_url;
    if (editFileRef.current?.files[0]) {
      try { image_url = await uploadImage(editFileRef.current.files[0]); } catch {}
    }
    await supabase.from("game_methods").update({ content: editMethod.content, image_url }).eq("id", editId);
    setEditId(null); setEditMethod(null);
    setUploading(false);
    loadMethods();
  }

  async function deleteMethod(id, imageUrl) {
    if (!window.confirm("삭제할까요?")) return;
    if (imageUrl) {
      const path = imageUrl.split("/game-images/")[1];
      if (path) await supabase.storage.from("game-images").remove([path]);
    }
    await supabase.from("game_methods").delete().eq("id", id);
    loadMethods();
  }

  return (
    <>
      {/* 라이트박스 */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 300, cursor: "zoom-out",
          }}
        >
          <img src={lightbox} alt="" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, objectFit: "contain" }} />
          <div onClick={() => setLightbox(null)} style={{ position: "absolute", top: 20, right: 24, color: "#fff", fontSize: 28, cursor: "pointer" }}>✕</div>
        </div>
      )}

      {/* 모달 */}
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        zIndex: 100, overflowY: "auto", padding: "2rem 1rem",
      }}>
        <div style={{ background: "#1a1a1a", borderRadius: 16, padding: "1.5rem", width: "100%", maxWidth: 560, border: "1px solid #333" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: "#f0f0f0" }}>{game.name}</h2>
              <p style={S.muted}>관리 방법</p>
            </div>
            <button onClick={onClose} style={S.btn}>닫기</button>
          </div>

          {/* 관리 방법 추가 */}
          <div style={{ background: "#252525", borderRadius: 12, padding: "1rem", marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#aaa", marginBottom: 10 }}>새 관리 방법 추가</p>
            <textarea
              placeholder="관리 방법 내용 입력"
              value={newMethod.content}
              onChange={e => setNewMethod(m => ({ ...m, content: e.target.value }))}
              style={{ ...S.input, minHeight: 80, resize: "vertical", marginBottom: 8 }}
            />
            <div style={{ margin: "0 0 10px" }}>
              <input type="file" accept="image/*" ref={fileRef} style={{ fontSize: 13, color: "#aaa" }} />
            </div>
            <button onClick={addMethod} style={S.btnPrimary} disabled={uploading}>
              {uploading ? "저장 중..." : "+ 추가"}
            </button>
          </div>

          {/* 관리 방법 목록 */}
          {loading ? (
            <p style={S.muted}>불러오는 중...</p>
          ) : methods.length === 0 ? (
            <p style={{ ...S.muted, textAlign: "center", padding: "1rem" }}>등록된 관리 방법이 없습니다.</p>
          ) : (
            methods.map((m, idx) => (
              <div key={m.id} style={{ background: "#222", border: "1px solid #333", borderRadius: 12, padding: "1rem", marginBottom: 10 }}>
                {editId === m.id ? (
                  <div>
                    <textarea
                      value={editMethod.content}
                      onChange={e => setEditMethod(x => ({ ...x, content: e.target.value }))}
                      style={{ ...S.input, minHeight: 80, resize: "vertical" }}
                    />
                    <div style={{ margin: "0 0 10px" }}>
                      {editMethod.image_url && (
                        <img src={editMethod.image_url} alt="" style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 6, marginBottom: 8, display: "block" }} />
                      )}
                      <input type="file" accept="image/*" ref={editFileRef} style={{ fontSize: 13, color: "#aaa" }} />
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={saveEdit} style={S.btnPrimary} disabled={uploading}>{uploading ? "저장 중..." : "저장"}</button>
                      <button onClick={() => { setEditId(null); setEditMethod(null); }} style={S.btn}>취소</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: m.image_url ? 10 : 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "#2563eb", minWidth: 20 }}>{idx + 1}.</span>
                      <p style={{ fontSize: 14, color: "#e8e8e8", margin: 0, flex: 1, lineHeight: 1.6 }}>{m.content}</p>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => { setEditId(m.id); setEditMethod(m); }} style={S.btn}>수정</button>
                        <button onClick={() => deleteMethod(m.id, m.image_url)} style={{ ...S.btn, color: "#f87171" }}>삭제</button>
                      </div>
                    </div>
                    {m.image_url && (
                      <img
                        src={m.image_url}
                        alt=""
                        onClick={() => setLightbox(m.image_url)}
                        style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8, cursor: "zoom-in", marginTop: 8 }}
                      />
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
function SupervisorDashboard({ userProfile, stores, onLogout }) {
  const [myStores, setMyStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [games, setGames] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [allUsers, setAllUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);

  useEffect(() => { loadMyStores(); }, []);

  async function loadMyStores() {
    setLoading(true);
    if (userProfile.role === "master") {
      setMyStores(stores);
      if (stores.length > 0) setSelectedStore(stores[0]);
    } else {
      const { data } = await supabase.from("supervisor_stores").select("*, stores(*)").eq("supervisor_id", userProfile.id);
      if (data) {
        const s = data.map(d => d.stores);
        setMyStores(s);
        if (s.length > 0) setSelectedStore(s[0]);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    if (selectedStore) { loadGames(); loadLogs(); }
  }, [selectedStore]);

  useEffect(() => {
    if (tab === "users") { loadAllUsers(); loadPendingUsers(); }
  }, [tab]);

  async function loadGames() {
    const { data } = await supabase.from("games").select("*").order("name");
    if (data) setGames(data);
  }

  async function loadLogs() {
    if (!selectedStore) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data } = await supabase.from("game_logs").select("*, games(name), users(name)")
      .eq("store_id", selectedStore.id)
      .gte("managed_at", today.toISOString());
    if (data) setLogs(data);
  }

  async function loadAllUsers() {
    const { data } = await supabase.from("users").select("*, stores(name)").order("created_at", { ascending: false });
    if (data) setAllUsers(data);
  }

  async function loadPendingUsers() {
    const { data } = await supabase.from("users").select("*, stores(name)").eq("status", "pending").order("created_at");
    if (data) setPendingUsers(data);
  }

  async function approveUser(uid) {
    await supabase.from("users").update({ status: "approved" }).eq("id", uid);
    loadPendingUsers(); loadAllUsers();
  }

  async function rejectUser(uid) {
    await supabase.from("users").update({ status: "rejected" }).eq("id", uid);
    loadPendingUsers(); loadAllUsers();
  }

  // 오늘 관리된 게임 ID 목록
  const managedGameIds = new Set(logs.map(l => l.game_id));

  // 주기별 오늘 관리 필요한 게임
  function isDue(game) {
    const cycleDays = { daily: 1, weekly: 7, monthly: 30 };
    // 대시보드에서는 단순히 오늘 관리됐는지 여부만 체크
    return !managedGameIds.has(game.id);
  }

  const dueGames = games.filter(g => !managedGameIds.has(g.id));
  const doneGames = games.filter(g => managedGameIds.has(g.id));
  const progress = games.length > 0 ? Math.round((doneGames.length / games.length) * 100) : 0;

  if (loading) return <div style={{ textAlign: "center", padding: "4rem", color: "#666", fontFamily: "sans-serif" }}>불러오는 중...</div>;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "1.5rem 1rem", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 500, color: "#f0f0f0" }}>
            {userProfile.role === "master" ? "마스터 관리자" : "슈퍼바이저"}
          </h1>
          <p style={S.muted}>{userProfile.name}</p>
        </div>
        <button onClick={onLogout} style={S.btn}>로그아웃</button>
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" }}>
        {["dashboard", "users"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ ...S.btn, background: tab === t ? "#2a2a2a" : "transparent", fontWeight: tab === t ? 500 : 400 }}>
            {t === "dashboard" ? "대시보드" : `계정 관리 ${pendingUsers.length > 0 ? `(대기 ${pendingUsers.length})` : ""}`}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (<>
        {/* 매장 선택 */}
        {myStores.length > 1 && (
          <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" }}>
            {myStores.map(s => (
              <button key={s.id} onClick={() => setSelectedStore(s)} style={{ ...S.btn, background: selectedStore?.id === s.id ? "#2563eb" : "transparent", borderColor: selectedStore?.id === s.id ? "#2563eb" : "#555", color: selectedStore?.id === s.id ? "#fff" : "#e8e8e8" }}>
                {s.name}
              </button>
            ))}
          </div>
        )}

        {myStores.length === 0 ? (
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={S.muted}>담당 매장이 없습니다. 마스터 관리자에게 문의하세요.</p>
          </div>
        ) : (<>
          {/* 진행률 카드 */}
          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "#f0f0f0" }}>{selectedStore?.name} — 오늘 관리 현황</p>
                <p style={S.muted}>{new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 28, fontWeight: 500, color: progress === 100 ? "#4ade80" : "#f0f0f0" }}>{progress}%</p>
                <p style={S.muted}>{doneGames.length} / {games.length}개</p>
              </div>
            </div>
            {/* 진행률 바 */}
            <div style={{ background: "#2a2a2a", borderRadius: 8, height: 8, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: progress === 100 ? "#16a34a" : "#2563eb", borderRadius: 8, transition: "width 0.3s" }} />
            </div>
          </div>

          {/* 요약 카드 3개 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { label: "전체 게임", value: games.length, color: "#f0f0f0" },
              { label: "완료", value: doneGames.length, color: "#4ade80" },
              { label: "미완료", value: dueGames.length, color: "#f87171" },
            ].map(item => (
              <div key={item.label} style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 12, padding: "1rem", textAlign: "center" }}>
                <p style={{ margin: "0 0 4px", fontSize: 13, color: "#666" }}>{item.label}</p>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 500, color: item.color }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* 미완료 게임 목록 */}
          {dueGames.length > 0 && (
            <div style={S.card}>
              <p style={{ fontSize: 14, fontWeight: 500, color: "#f87171", marginBottom: 12 }}>미완료 게임 ({dueGames.length}개)</p>
              {dueGames.map(g => (
                <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #2a2a2a" }}>
                  <span style={{ fontSize: 14, color: "#e8e8e8" }}>{g.name}</span>
                  <span style={{ fontSize: 12, color: "#666" }}>{g.category}</span>
                </div>
              ))}
            </div>
          )}

          {/* 완료 게임 목록 */}
          {doneGames.length > 0 && (
            <div style={S.card}>
              <p style={{ fontSize: 14, fontWeight: 500, color: "#4ade80", marginBottom: 12 }}>완료 게임 ({doneGames.length}개)</p>
              {doneGames.map(g => (
                <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #2a2a2a" }}>
                  <span style={{ fontSize: 14, color: "#666", textDecoration: "line-through" }}>{g.name}</span>
                  <span style={{ fontSize: 12, color: "#4ade80" }}>완료</span>
                </div>
              ))}
            </div>
          )}
        </>)}
      </>)}

      {tab === "users" && (<>
        <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
          {["pending", "all"].map(t => (
            <button key={t} onClick={() => {}} style={{ ...S.btn, background: "#2a2a2a" }}>
              {t === "pending" ? `승인 대기 (${pendingUsers.length})` : `전체 (${allUsers.length})`}
            </button>
          ))}
        </div>

        {pendingUsers.length === 0
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
        }
      </>)}
    </div>
  );
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
  const [games, setGames] = useState([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetPreview, setSheetPreview] = useState([]);
  const [sheetMsg, setSheetMsg] = useState("");
  const [editGame, setEditGame] = useState(null);
  const [addMode, setAddMode] = useState(false);
  const [newGame, setNewGame] = useState({ name: "", category: "", min_players: "", max_players: "", play_time: "", difficulty: "", cycle: "weekly", description: "", note: "" });
  const [componentGame, setComponentGame] = useState(null);
  const [methodGame, setMethodGame] = useState(null);

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
      loadPendingUsers(); loadAllUsers(); loadGames();
    }
    if (userProfile?.role === "store" && userProfile?.status === "approved") loadGames();
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
    } catch { setSheetMsg("구글 시트를 불러오지 못했습니다."); }
    setSheetLoading(false);
  }

  async function uploadSheetData() {
    if (!sheetPreview.length) return;
    setSheetLoading(true); setSheetMsg("");
    try {
      const rows = sheetPreview.map(r => ({
        name: r.name || "", category: r.category || "",
        min_players: r.min_players ? parseInt(r.min_players) : null,
        max_players: r.max_players ? parseInt(r.max_players) : null,
        play_time: r.play_time || "", difficulty: r.difficulty || "",
        cycle: r.cycle || "weekly", description: r.description || "", note: r.note || "",
      }));
      const { error } = await supabase.from("games").upsert(rows, { onConflict: "name" });
      if (error) throw error;
      setSheetMsg(`${rows.length}개 게임이 DB에 저장됐습니다!`);
      setSheetPreview([]); loadGames();
    } catch (e) { setSheetMsg("업로드 중 오류가 발생했습니다: " + e.message); }
    setSheetLoading(false);
  }

  async function saveNewGame() {
    if (!newGame.name.trim()) return;
    await supabase.from("games").insert({ ...newGame, min_players: newGame.min_players ? parseInt(newGame.min_players) : null, max_players: newGame.max_players ? parseInt(newGame.max_players) : null });
    setNewGame({ name: "", category: "", min_players: "", max_players: "", play_time: "", difficulty: "", cycle: "weekly", description: "", note: "" });
    setAddMode(false); loadGames();
  }

  async function saveEditGame() {
    await supabase.from("games").update({ ...editGame, min_players: editGame.min_players ? parseInt(editGame.min_players) : null, max_players: editGame.max_players ? parseInt(editGame.max_players) : null }).eq("id", editGame.id);
    setEditGame(null); loadGames();
  }

  async function deleteGame(id) {
    if (!window.confirm("정말 삭제할까요?")) return;
    await supabase.from("games").delete().eq("id", id);
    loadGames();
  }

  async function handleLogout() { await supabase.auth.signOut(); }

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
      <input placeholder="카테고리" value={game.category} onChange={e => setGame(g => ({ ...g, category: e.target.value }))} style={S.input} />
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="최소 인원" value={game.min_players} onChange={e => setGame(g => ({ ...g, min_players: e.target.value }))} style={{ ...S.input, flex: 1 }} />
        <input placeholder="최대 인원" value={game.max_players} onChange={e => setGame(g => ({ ...g, max_players: e.target.value }))} style={{ ...S.input, flex: 1 }} />
      </div>
      <input placeholder="플레이 시간" value={game.play_time} onChange={e => setGame(g => ({ ...g, play_time: e.target.value }))} style={S.input} />
      <input placeholder="난이도" value={game.difficulty} onChange={e => setGame(g => ({ ...g, difficulty: e.target.value }))} style={S.input} />
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

  // 슈퍼바이저 화면
  if (userProfile.role === "supervisor") return (
  <SupervisorDashboard userProfile={userProfile} stores={stores} onLogout={handleLogout} />
);
  // 마스터 관리자 화면
  if (userProfile.role === "master") return (
    <div style={S.wrapWide}>
      {componentGame && <ComponentManager game={componentGame} onClose={() => setComponentGame(null)} />}
      {methodGame && <MethodManager game={methodGame} onClose={() => setMethodGame(null)} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ ...S.h1, marginBottom: 2 }}>마스터 관리자</h1>
          <p style={S.muted}>{userProfile.name}</p>
        </div>
        <button onClick={handleLogout} style={S.btn}>로그아웃</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" }}>
        {["pending", "users", "games", "sheet", "dashboard"].map(t => (
          <button key={t} onClick={() => setAdminTab(t)} style={{ ...S.btn, background: adminTab === t ? "#2a2a2a" : "transparent", fontWeight: adminTab === t ? 500 : 400 }}>
            {t === "pending" ? `승인 대기 (${pendingUsers.length})` 
              : t === "users" ? `전체 계정 (${allUsers.length})` 
              : t === "games" ? `게임 DB (${games.length})` 
              : t === "sheet" ? "구글 시트" 
              : "대시보드"}
          </button>
        ))}
      </div>
      {adminTab === "dashboard" && (
      <SupervisorDashboard userProfile={userProfile} stores={stores} onLogout={handleLogout} />
      )}
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
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button onClick={() => setComponentGame(g)} style={{ ...S.btn, color: "#7dd3fc", borderColor: "#7dd3fc" }}>구성물</button>
                    <button onClick={() => setMethodGame(g)} style={{ ...S.btn, color: "#fbbf24", borderColor: "#fbbf24" }}>관리 방법</button>
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
              구글 시트 1행 헤더:<br />
              <code style={{ color: "#7dd3fc", fontSize: 12 }}>name, category, min_players, max_players, play_time, difficulty, cycle, description, note</code>
            </p>
            {sheetMsg && <p style={{ ...S.muted, color: sheetMsg.includes("오류") ? "#f87171" : "#4ade80", marginBottom: 12 }}>{sheetMsg}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={fetchSheetPreview} style={S.btnPrimary} disabled={sheetLoading}>{sheetLoading ? "불러오는 중..." : "시트 미리보기"}</button>
              {sheetPreview.length > 0 && <button onClick={uploadSheetData} style={{ ...S.btnPrimary, background: "#16a34a" }} disabled={sheetLoading}>DB에 업로드 ({sheetPreview.length}개)</button>}
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