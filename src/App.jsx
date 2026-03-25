import { useState, useEffect } from "react";

const ADMIN_PASSWORD = "admin1234";

const DEFAULT_GAMES = [
  {
    id: 1, name: "카탄", category: "전략", cycle: "weekly", lastManaged: null,
    methods: ["자원 카드를 종류별로 정리하여 보관함에 넣기","개척지/도시 말 분실 여부 확인","육각형 타일 긁힘 여부 점검","도적 말 위치 초기화","주사위 2개 이상 보유 여부 확인"],
    note: "습기에 약하므로 밀봉 보관 권장",
  },
  {
    id: 2, name: "스플렌더", category: "전략", cycle: "weekly", lastManaged: null,
    methods: ["보석 토큰 색깔별 분류 및 개수 확인","개발 카드 레벨별 분리 보관","귀족 타일 별도 보관","카드 뒤틀림 여부 점검"],
    note: "토큰은 지퍼백에 분리 보관 추천",
  },
  {
    id: 3, name: "코드네임", category: "파티", cycle: "monthly", lastManaged: null,
    methods: ["단어 카드 전수 확인 및 분실 체크","요원 카드(빨강/파랑/암살자) 개수 확인","키 카드 훼손 여부 점검","카드 홀더 상태 확인"],
    note: "카드 수량: 단어카드 200장, 요원카드 17장",
  },
  {
    id: 4, name: "팬데믹", category: "협력", cycle: "monthly", lastManaged: null,
    methods: ["질병 큐브 색깔별 분류 및 개수 확인","도시 카드/전염 카드 분리 보관","게임 보드 접힘 상태 점검","역할 카드 및 참조 카드 확인","연구소/치료제 말 보관 확인"],
    note: "큐브 분실이 잦음 - 주기적 점검 필수",
  },
  {
    id: 5, name: "딕싯", category: "파티", cycle: "monthly", lastManaged: null,
    methods: ["카드 78장 전수 점검","투표 토큰 색깔별 6세트 확인","점수 토끼 말 6개 확인","점수 트랙 보드 상태 점검"],
    note: "카드 그림 훼손 주의 - 슬리브 사용 권장",
  },
];

const CYCLE_LABEL = { daily: "매일", weekly: "매주", monthly: "매월" };
const CYCLE_DAYS  = { daily: 1, weekly: 7, monthly: 30 };

const S = {
  wrap: { maxWidth: 600, margin: "0 auto", padding: "1.5rem 1rem", fontFamily: "inherit" },
  card: { background: "#1e1e1e", border: "1px solid #333", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: 10 },
  cardAlt: { background: "#181818", border: "1px solid #2a2a2a", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: 10 },
  btn: { background: "transparent", border: "1px solid #444", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: "#e8e8e8", fontSize: 13 },
  input: { width: "100%", boxSizing: "border-box", background: "#252525", border: "1px solid #383838", borderRadius: 8, padding: "8px 12px", fontSize: 14, color: "#e8e8e8", marginBottom: 8, outline: "none" },
  badge: (color) => ({ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: color || "#2a2a2a", color: "#aaa" }),
  label: { fontSize: 13, color: "#888", marginBottom: 6, display: "block" },
  h1: { margin: 0, fontSize: 20, fontWeight: 500, color: "#f0f0f0" },
  h2: { margin: "0 0 1rem", fontSize: 16, fontWeight: 500, color: "#f0f0f0" },
  muted: { color: "#666", fontSize: 12 },
  danger: { color: "#f87171", fontSize: 13 },
  success: { color: "#4ade80" },
};

function getDaysDiff(d) { return d ? (Date.now() - new Date(d).getTime()) / 86400000 : Infinity; }
function isDue(g) { return getDaysDiff(g.lastManaged) >= CYCLE_DAYS[g.cycle]; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString("ko-KR") : "미관리"; }

function Dots() {
  return (
    <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
      {[0,1,2].map(i => (
        <span key={i} style={{ width:6,height:6,borderRadius:"50%",background:"#666",animation:`blink 1.2s ${i*0.2}s infinite` }} />
      ))}
      <style>{`@keyframes blink{0%,80%,100%{opacity:.3;transform:scale(.7)}40%{opacity:1;transform:scale(1)}}`}</style>
    </span>
  );
}

export default function App() {
  const [view, setView]           = useState("user");
  const [tab, setTab]             = useState("today");
  const [games, setGames]         = useState(() => { try { const s=localStorage.getItem("bgm2"); return s?JSON.parse(s):DEFAULT_GAMES; } catch { return DEFAULT_GAMES; } });
  const [checked, setChecked]     = useState({});
  const [expanded, setExpanded]   = useState(null);
  const [aiReminder, setAiReminder] = useState("");
  const [aiReminderLoading, setAiReminderLoading] = useState(false);
  const [aiDetail, setAiDetail]   = useState({});
  const [aiDetailLoading, setAiDetailLoading] = useState(null);
  const [adminPw, setAdminPw]     = useState("");
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminErr, setAdminErr]   = useState("");
  const [editGame, setEditGame]   = useState(null);
  const [addMode, setAddMode]     = useState(false);
  const [newGame, setNewGame]     = useState({ name:"", category:"", cycle:"weekly", methods:[""], note:"" });

  useEffect(() => { try { localStorage.setItem("bgm2", JSON.stringify(games)); } catch {} }, [games]);

  const dueGames = games.filter(isDue);
  const allDone  = dueGames.length > 0 && dueGames.every(g => checked[g.id]);

  async function claude(prompt) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, messages:[{role:"user",content:prompt}] }),
    });
    const d = await res.json();
    return d.content?.map(b=>b.text||"").join("") || "";
  }

  async function loadReminder() {
    if (aiReminderLoading) return;
    setAiReminderLoading(true); setAiReminder("");
    try {
      const names = dueGames.map(g=>g.name).join(", ") || "없음";
      setAiReminder(await claude(`보드게임 관리 도우미입니다. 오늘 관리 필요 게임: ${names}. 친근하고 간결하게 3~4문장 한국어 리마인더를 작성하세요. 이모지 없이.`));
    } catch { setAiReminder("AI 메시지를 불러오지 못했습니다."); }
    setAiReminderLoading(false);
  }

  async function loadDetail(game) {
    if (aiDetailLoading) return;
    setAiDetailLoading(game.id); setAiDetail(d=>({...d,[game.id]:""}));
    try {
      const msg = await claude(`보드게임 "${game.name}" 관리 방법을 친절하게 설명해주세요. 항목: ${game.methods.join(", ")}. 참고: ${game.note||"없음"}. 각 항목을 왜 해야 하는지, 어떻게 하면 좋은지 구체적으로 한국어로 설명. 이모지 없이.`);
      setAiDetail(d=>({...d,[game.id]:msg}));
    } catch { setAiDetail(d=>({...d,[game.id]:"AI 안내를 불러오지 못했습니다."})); }
    setAiDetailLoading(null);
  }

  function markDone(id) {
    const nowChecked = !checked[id];
    setChecked(c=>({...c,[id]:nowChecked}));
    if (nowChecked) setGames(gs=>gs.map(g=>g.id===id?{...g,lastManaged:new Date().toISOString()}:g));
  }

  function saveEdit() { setGames(gs=>gs.map(g=>g.id===editGame.id?editGame:g)); setEditGame(null); }
  function delGame(id) { if(window.confirm("정말 삭제할까요?")) setGames(gs=>gs.filter(g=>g.id!==id)); }
  function saveNew() {
    if(!newGame.name.trim()) return;
    setGames(gs=>[...gs,{...newGame,id:Date.now(),lastManaged:null,methods:newGame.methods.filter(m=>m.trim())}]);
    setNewGame({name:"",category:"",cycle:"weekly",methods:[""],note:""});
    setAddMode(false);
  }

  const tabBtn = (t, label) => (
    <button onClick={()=>setTab(t)} style={{...S.btn, background:tab===t?"#2a2a2a":"transparent", fontWeight:tab===t?500:400}}>
      {label}
    </button>
  );

  const editMethods = (setter, methods, i, val) => { const m=[...methods]; m[i]=val; setter(g=>({...g,methods:m})); };
  const addMethod   = (setter) => setter(g=>({...g,methods:[...g.methods,""]}));
  const delMethod   = (setter, methods, i) => setter(g=>({...g,methods:methods.filter((_,j)=>j!==i)}));

  return (
    <div style={S.wrap}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.5rem"}}>
        <div>
          <h1 style={S.h1}>보드게임 관리</h1>
          <p style={{...S.muted, marginTop:2}}>{new Date().toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"long"})}</p>
        </div>
        <button onClick={()=>{setView(v=>v==="user"?"admin":"user"); setAdminAuth(false); setAdminPw("");}} style={S.btn}>
          {view==="user"?"관리자":"사용자"}
        </button>
      </div>

      {view==="user" && (<>
        <div style={{display:"flex",gap:8,marginBottom:"1rem"}}>
          {tabBtn("today",`오늘 관리 (${dueGames.length})`)}
          {tabBtn("all",`전체 게임 (${games.length})`)}
        </div>

        {tab==="today" && (<>
          <div style={{...S.cardAlt,marginBottom:"1rem"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:500,color:"#888"}}>AI 리마인더</span>
              <button onClick={loadReminder} style={{...S.btn,fontSize:12,padding:"4px 10px"}}>{aiReminderLoading?"생성 중...":"생성"}</button>
            </div>
            {aiReminderLoading ? <Dots /> : aiReminder
              ? <p style={{margin:0,fontSize:14,color:"#ddd",lineHeight:1.7}}>{aiReminder}</p>
              : <p style={{margin:0,fontSize:13,color:"#555"}}>생성 버튼을 눌러 오늘의 리마인더를 확인하세요.</p>
            }
          </div>

          {dueGames.length===0
            ? <div style={{...S.card,textAlign:"center",padding:"2rem"}}><p style={{color:"#555"}}>오늘 관리할 게임이 없습니다.</p></div>
            : (<>
              {allDone && <div style={{...S.card,background:"#1a2e1a",border:"1px solid #2d5a2d",textAlign:"center",marginBottom:10}}><p style={{...S.success,fontWeight:500,fontSize:14}}>오늘 관리가 모두 완료되었습니다!</p></div>}
              {dueGames.map(game=>(
                <div key={game.id} style={S.card}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                    <div onClick={()=>markDone(game.id)} style={{width:20,height:20,borderRadius:6,marginTop:2,flexShrink:0,border:checked[game.id]?"none":"1.5px solid #555",background:checked[game.id]?"#166534":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {checked[game.id]&&<span style={{fontSize:12,color:"#4ade80",fontWeight:700}}>✓</span>}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                        <span style={{fontSize:15,fontWeight:500,color:checked[game.id]?"#555":"#f0f0f0",textDecoration:checked[game.id]?"line-through":"none"}}>{game.name}</span>
                        <span style={S.badge()}>{CYCLE_LABEL[game.cycle]}</span>
                        <span style={S.badge()}>{game.category}</span>
                      </div>
                      <p style={{...S.muted,marginBottom:8}}>마지막 관리: {fmtDate(game.lastManaged)}</p>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>setExpanded(expanded===game.id?null:game.id)} style={{...S.btn,fontSize:12,padding:"4px 10px"}}>
                          {expanded===game.id?"접기":"관리 방법"}
                        </button>
                        <button onClick={()=>{setExpanded(game.id); loadDetail(game);}} style={{...S.btn,fontSize:12,padding:"4px 10px"}}>AI 안내</button>
                      </div>
                      {expanded===game.id&&(
                        <div style={{marginTop:12}}>
                          <ul style={{margin:"0 0 8px",paddingLeft:18}}>
                            {game.methods.map((m,i)=><li key={i} style={{fontSize:13,color:"#ccc",marginBottom:4,lineHeight:1.6}}>{m}</li>)}
                          </ul>
                          {game.note&&<p style={{margin:0,fontSize:12,color:"#666",borderLeft:"2px solid #333",paddingLeft:8}}>{game.note}</p>}
                          {aiDetailLoading===game.id&&<div style={{marginTop:10}}><Dots /></div>}
                          {aiDetailLoading!==game.id&&aiDetail[game.id]&&(
                            <div style={{marginTop:10,padding:"10px 12px",background:"#252525",borderRadius:8}}>
                              <p style={{margin:"0 0 4px",fontSize:12,fontWeight:500,color:"#888"}}>AI 관리 안내</p>
                              <p style={{margin:0,fontSize:13,color:"#ccc",lineHeight:1.7}}>{aiDetail[game.id]}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </>)
          }
        </>)}

        {tab==="all"&&(
          games.map(game=>(
            <div key={game.id} style={S.card}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <span style={{fontSize:15,fontWeight:500,color:"#f0f0f0"}}>{game.name}</span>
                  <span style={{...S.badge(),marginLeft:8}}>{game.category}</span>
                  <span style={{...S.badge(isDue(game)?"#2d1f00":""),marginLeft:4,color:isDue(game)?"#f59e0b":"#aaa"}}>{isDue(game)?"관리 필요":"완료"}</span>
                </div>
                <span style={S.muted}>{CYCLE_LABEL[game.cycle]}</span>
              </div>
              <p style={{...S.muted,marginTop:6}}>마지막 관리: {fmtDate(game.lastManaged)}</p>
            </div>
          ))
        )}
      </>)}

      {view==="admin"&&!adminAuth&&(
        <div style={{...S.card,maxWidth:340,margin:"3rem auto"}}>
          <h2 style={S.h2}>관리자 로그인</h2>
          <input type="password" placeholder="비밀번호 입력" value={adminPw} onChange={e=>setAdminPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(adminPw===ADMIN_PASSWORD?(setAdminAuth(true),setAdminErr("")):setAdminErr("비밀번호가 틀렸습니다."))} style={S.input} />
          {adminErr&&<p style={{...S.danger,margin:"0 0 8px"}}>{adminErr}</p>}
          <button onClick={()=>adminPw===ADMIN_PASSWORD?(setAdminAuth(true),setAdminErr("")):setAdminErr("비밀번호가 틀렸습니다.")} style={{...S.btn,width:"100%"}}>로그인</button>
          <p style={{...S.muted,textAlign:"center",marginTop:8}}>기본 비밀번호: admin1234</p>
        </div>
      )}

      {view==="admin"&&adminAuth&&(<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
          <h2 style={{...S.h2,margin:0}}>게임 DB 관리</h2>
          <button onClick={()=>setAddMode(true)} style={S.btn}>+ 게임 추가</button>
        </div>

        {addMode&&(
          <div style={{...S.cardAlt,marginBottom:10}}>
            <p style={{...S.label,fontWeight:500,fontSize:14}}>새 게임 추가</p>
            <input placeholder="게임 이름" value={newGame.name} onChange={e=>setNewGame(g=>({...g,name:e.target.value}))} style={S.input} />
            <input placeholder="카테고리 (예: 전략, 파티)" value={newGame.category} onChange={e=>setNewGame(g=>({...g,category:e.target.value}))} style={S.input} />
            <select value={newGame.cycle} onChange={e=>setNewGame(g=>({...g,cycle:e.target.value}))} style={{...S.input}}>
              <option value="daily">매일</option><option value="weekly">매주</option><option value="monthly">매월</option>
            </select>
            <span style={S.label}>관리 방법</span>
            {newGame.methods.map((m,i)=>(
              <div key={i} style={{display:"flex",gap:6,marginBottom:6}}>
                <input value={m} onChange={e=>editMethods(setNewGame,newGame.methods,i,e.target.value)} style={{...S.input,marginBottom:0,flex:1}} placeholder={`관리 방법 ${i+1}`} />
                {newGame.methods.length>1&&<button onClick={()=>delMethod(setNewGame,newGame.methods,i)} style={{...S.btn,padding:"6px 10px"}}>-</button>}
              </div>
            ))}
            <button onClick={()=>addMethod(setNewGame)} style={{...S.btn,fontSize:12,marginBottom:8}}>+ 항목 추가</button>
            <input placeholder="참고 메모" value={newGame.note} onChange={e=>setNewGame(g=>({...g,note:e.target.value}))} style={S.input} />
            <div style={{display:"flex",gap:8}}>
              <button onClick={saveNew} style={{...S.btn,flex:1}}>저장</button>
              <button onClick={()=>setAddMode(false)} style={{...S.btn,flex:1}}>취소</button>
            </div>
          </div>
        )}

        {games.map(game=>(
          <div key={game.id} style={S.card}>
            {editGame?.id===game.id?(<>
              <input value={editGame.name} onChange={e=>setEditGame(g=>({...g,name:e.target.value}))} style={S.input} />
              <input value={editGame.category} onChange={e=>setEditGame(g=>({...g,category:e.target.value}))} style={S.input} />
              <select value={editGame.cycle} onChange={e=>setEditGame(g=>({...g,cycle:e.target.value}))} style={{...S.input}}>
                <option value="daily">매일</option><option value="weekly">매주</option><option value="monthly">매월</option>
              </select>
              <span style={S.label}>관리 방법</span>
              {editGame.methods.map((m,i)=>(
                <div key={i} style={{display:"flex",gap:6,marginBottom:6}}>
                  <input value={m} onChange={e=>editMethods(setEditGame,editGame.methods,i,e.target.value)} style={{...S.input,marginBottom:0,flex:1}} />
                  {editGame.methods.length>1&&<button onClick={()=>delMethod(setEditGame,editGame.methods,i)} style={{...S.btn,padding:"6px 10px"}}>-</button>}
                </div>
              ))}
              <button onClick={()=>addMethod(setEditGame)} style={{...S.btn,fontSize:12,marginBottom:8}}>+ 항목 추가</button>
              <input value={editGame.note} onChange={e=>setEditGame(g=>({...g,note:e.target.value}))} style={S.input} placeholder="참고 메모" />
              <div style={{display:"flex",gap:8}}>
                <button onClick={saveEdit} style={{...S.btn,flex:1}}>저장</button>
                <button onClick={()=>setEditGame(null)} style={{...S.btn,flex:1}}>취소</button>
              </div>
            </>):(
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <span style={{fontSize:15,fontWeight:500,color:"#f0f0f0"}}>{game.name}</span>
                  <span style={{...S.muted,marginLeft:8}}>{game.category} · {CYCLE_LABEL[game.cycle]}</span>
                  <p style={{...S.muted,marginTop:4}}>관리 항목 {game.methods.length}개</p>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>setEditGame(game)} style={{...S.btn,fontSize:12,padding:"4px 10px"}}>수정</button>
                  <button onClick={()=>delGame(game.id)} style={{...S.btn,fontSize:12,padding:"4px 10px",color:"#f87171"}}>삭제</button>
                </div>
              </div>
            )}
          </div>
        ))}

        <button onClick={()=>{setAdminAuth(false);setAdminPw("");setView("user");}} style={{...S.btn,width:"100%",marginTop:"1rem",color:"#555"}}>
          로그아웃
        </button>
      </>)}
    </div>
  );
}