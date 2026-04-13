'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { supabase } from '@/lib/supabase'
import * as db from '@/lib/db'

const TABS = ["Overview","Progress","Fasting","Food Log","Body Stats","Workouts","Supplements","Meal Plan","Sexual Health","AI Coach"]
const today = () => new Date().toISOString().split("T")[0]
const fmt = (d: string) => new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})

const GOAL_OPTIONS = [
  "Lose weight / fat loss","Reverse prediabetes / blood sugar","Lower blood pressure",
  "Boost testosterone / erections","Fertility / sperm count","Prostate relief",
  "Athletic / muscular look","Reduce gynecomastia","Improve skin / look younger",
  "Mental clarity / energy","Better sleep",
]

const SUPPS = [
  {name:"Vitamin D3+K2",dose:"5,000 IU+100mcg",time:"Morning w/ fat",why:"Testosterone, immunity, mood"},
  {name:"Zinc Picolinate",dose:"50mg",time:"Evening w/ food",why:"Testosterone, sperm, prostate"},
  {name:"Magnesium Glycinate",dose:"400mg",time:"Before bed",why:"Sleep, BP, fasting support"},
  {name:"Fish Oil (EPA/DHA)",dose:"3g combined",time:"With meals",why:"Inflammation, fertility, heart"},
  {name:"Berberine",dose:"500mg 2x/day",time:"Before meals",why:"Blood sugar"},
  {name:"Ashwagandha KSM-66",dose:"600mg",time:"Morning",why:"Testosterone, cortisol"},
  {name:"DIM",dose:"200mg",time:"With food",why:"Estrogen metabolism"},
  {name:"Boron",dose:"6mg",time:"Morning",why:"Free testosterone"},
  {name:"CoQ10 (Ubiquinol)",dose:"200mg",time:"Morning w/ fat",why:"Sperm quality, energy"},
  {name:"Saw Palmetto",dose:"320mg",time:"With food",why:"Prostate support"},
  {name:"Creatine",dose:"5g",time:"Any time",why:"Strength, recovery"},
  {name:"Electrolytes",dose:"See fasting tab",time:"During fasts",why:"Prevent cramping"},
]

const WK: Record<string, {ex:string,sets:string,note:string}[]> = {
  "Push Day":[{ex:"DB Floor Press",sets:"4x10",note:"Shoulder-safe"},{ex:"DB Overhead Press",sets:"3x10",note:"Seated"},{ex:"Push-Ups / Band",sets:"3x15",note:"Band around back"},{ex:"Tricep Extensions",sets:"3x12",note:"Single DB"},{ex:"Lateral Raises",sets:"3x15",note:"Light, slow"}],
  "Pull Day":[{ex:"DB Bent-Over Rows",sets:"4x10",note:"Squeeze lats"},{ex:"Band Pull-Aparts",sets:"4x20",note:"Rear delts"},{ex:"DB Curls",sets:"3x12",note:"Alternate"},{ex:"Face Pulls (band)",sets:"3x15",note:"External rotation"},{ex:"DB Shrugs",sets:"3x15",note:"Hold top 2s"}],
  "Legs & Core":[{ex:"DB Romanian Deadlift",sets:"4x10",note:"Hamstrings & glutes"},{ex:"Hip Thrusts",sets:"4x12",note:"Pause top"},{ex:"Band Walks",sets:"3x15/side",note:"Glute med"},{ex:"Plank Hold",sets:"3x45s",note:"Squeeze"},{ex:"Dead Bugs",sets:"3x10/side",note:"Slow"},{ex:"Farmer Carries",sets:"3x40yd",note:"Heavy, tall"}],
}

const defaultProfile = (): any => ({
  name:"",age:null,height_ft:null,height_in:null,weight:null,goal_weight:null,waist:null,timeline:6,
  bp_sys:null,bp_dia:null,blood_sugar:"normal",sleep_apnea:false,cpap:false,
  prostate_symptoms:false,fertility_goal:false,medications:"",allergies:"",health_history:"",
  work_schedule:"",sleep_hours:7,tobacco:"none",alcohol:"none",cannabis:"none",
  current_diet:"",caffeine:"",diet_style:"keto-carnivore",fasting_plan:"48h-weekly",
  foods_love:"",foods_wont_eat:"",cooking_level:"medium",kitchen_gear:[],budget:120,
  stores:[],location:"",lifting_experience:"some",injuries:"",equipment:[],gym_access:false,
  goals:[],top_goals:[],goals_own_words:"",specific_concerns:"",additional_info:"",
  profile_completed:false,
})

const defaultData = (): any => ({
  weights:[],waist:[],bp:[],fastLog:[],foodLog:[],workoutLog:[],suppChecks:{},currentFast:null,sexLog:[],cycleStart:null
})

const CSS = `
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#1a1d27}::-webkit-scrollbar-thumb{background:#f5c542;border-radius:3px}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.cd{background:#1a1d27;border:1px solid #2a2d37;border-radius:12px;padding:20px;animation:fadeIn .3s ease}
.cdg{box-shadow:0 0 20px rgba(245,197,66,.08)}
.bt{background:#f5c542;color:#0f1117;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600;font-size:14px;transition:all .2s;font-family:'Outfit',sans-serif}
.bt:hover{background:#ffd666;transform:translateY(-1px)}
.bto{background:transparent;border:1px solid #f5c542;color:#f5c542}.bto:hover{background:#f5c54220}
.btd{background:#e74c3c;color:white}.btd:hover{background:#ff6b5a}
.bts{padding:6px 14px;font-size:12px}
.inp{background:#12141c;border:1px solid #2a2d37;color:#e8e6e1;padding:10px 14px;border-radius:8px;font-size:14px;width:100%}
.inp:focus{outline:none;border-color:#f5c542;box-shadow:0 0 0 2px #f5c54230}
.lb{font-size:12px;color:#8a8d97;font-weight:500;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.tg{display:inline-block;background:#f5c54220;color:#f5c542;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
.chip{padding:8px 14px;border-radius:20px;border:1px solid #2a2d37;background:#12141c;color:#8a8d97;font-size:12px;cursor:pointer;font-family:'Outfit',sans-serif;transition:all .15s;font-weight:500}
.chip.on{border-color:#f5c542;background:#f5c54220;color:#f5c542}
`

export default function KeyTransform() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(defaultProfile())
  const [data, setData] = useState<any>(defaultData())
  const [screen, setScreen] = useState("loading")
  const [tab, setTab] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        const prof = await db.getProfile(session.user.id)
        const localDone = localStorage.getItem(`kt_done_${session.user.id}`) === '1'
        if (prof) {
          setProfile({...defaultProfile(), ...prof})
          const allData = await db.loadAllData(session.user.id)
          setData({...defaultData(), ...allData})
          setScreen((prof.profile_completed || !!(prof.name && prof.age && prof.weight) || localDone) ? "dashboard" : "wizard")
        } else {
          setScreen(localDone ? "dashboard" : "wizard")
        }
      } else {
        setScreen("auth")
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') { setUser(null); setScreen("auth") }
    })
    return () => subscription.unsubscribe()
  }, [])

  const refreshData = useCallback(async () => {
    if (!user) return
    const allData = await db.loadAllData(user.id)
    setData({...defaultData(), ...allData})
  }, [user])

  const sw = Number(profile.weight) || 325
  const gw = Number(profile.goal_weight) || 250

  if (screen === "loading") return (
    <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh",background:"#0f1117",color:"#f5c542"}}>
      <p style={{fontFamily:"'Outfit',sans-serif",fontSize:20}}>Loading...</p>
    </div>
  )

  return (
    <div style={{minHeight:"100vh",background:"#0f1117",color:"#e8e6e1",fontFamily:"'Outfit',sans-serif"}}>
      <style>{CSS}</style>
      {screen === "auth" && <AuthScreen onAuth={async (u: any) => {
        setUser(u)
        const prof = await db.getProfile(u.id)
        const localDone = localStorage.getItem(`kt_done_${u.id}`) === '1'
        if (prof) {
          setProfile({...defaultProfile(), ...prof})
          const allData = await db.loadAllData(u.id)
          setData({...defaultData(), ...allData})
          setScreen((prof.profile_completed || !!(prof.name && prof.age && prof.weight) || localDone) ? "dashboard" : "wizard")
        } else {
          setScreen(localDone ? "dashboard" : "wizard")
        }
      }} />}
      {screen === "wizard" && <WizardScreen profile={profile} user={user} onComplete={async (p: any) => {
        setProfile(p)
        await db.updateProfile(user.id, {...p, profile_completed: true})
        localStorage.setItem(`kt_done_${user.id}`, '1')
        const allData = await db.loadAllData(user.id)
        setData({...defaultData(), ...allData})
        setScreen("dashboard")
      }} />}
      {screen === "dashboard" && (
        <>
          <div style={{background:"linear-gradient(135deg,#141720,#1a1d27)",borderBottom:"1px solid #2a2d37",padding:"16px 20px"}}>
            <div style={{maxWidth:1100,margin:"0 auto"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                <div>
                  <h1 style={{fontSize:22,fontWeight:800,letterSpacing:"-0.5px"}}><span style={{color:"#f5c542"}}>KEY</span> TRANSFORM</h1>
                  <p style={{fontSize:12,color:"#6a6d77",marginTop:2}}>{profile.name} | {sw} to {gw} lbs</p>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <button className="bts bt bto" onClick={()=>setScreen("wizard")}>Profile</button>
                  <button className="bts bt bto" style={{borderColor:"#e74c3c",color:"#e74c3c"}} onClick={async ()=>{await db.signOut();setUser(null);setScreen("auth")}}>Logout</button>
                </div>
              </div>
              <div style={{display:"flex",gap:4,marginTop:16,overflowX:"auto",paddingBottom:4}}>
                {TABS.map((t,i)=><button key={t} onClick={()=>setTab(i)} style={{padding:"8px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"'Outfit',sans-serif",whiteSpace:"nowrap",background:tab===i?"#f5c542":"transparent",color:tab===i?"#0f1117":"#6a6d77"}}>{t}</button>)}
              </div>
            </div>
          </div>
          <div style={{maxWidth:1100,margin:"0 auto",padding:"20px 16px 40px"}}>
            {tab===0 && <OverviewTab data={data} pf={profile} sw={sw} gw={gw} />}
            {tab===1 && <ProgressTab data={data} sw={sw} gw={gw} pf={profile} />}
            {tab===2 && <FastingTab data={data} user={user} refresh={refreshData} />}
            {tab===3 && <FoodLogTab data={data} user={user} refresh={refreshData} />}
            {tab===4 && <BodyStatsTab data={data} user={user} refresh={refreshData} />}
            {tab===5 && <WorkoutTab data={data} user={user} refresh={refreshData} />}
            {tab===6 && <SuppTab data={data} user={user} refresh={refreshData} />}
            {tab===7 && <MealTab pf={profile} />}
            {tab===8 && <SexTab data={data} user={user} refresh={refreshData} />}
            {tab===9 && <CoachTab pf={profile} userId={user?.id} />}
          </div>
        </>
      )}
    </div>
  )
}

// ─── AUTH SCREEN ─────────────────────────────────────────
function AuthScreen({ onAuth }: { onAuth: (u: any) => void }) {
  const [mode,setMode] = useState<"login"|"signup">("signup")
  const [email,setEmail] = useState("")
  const [pass,setPass] = useState("")
  const [name,setName] = useState("")
  const [err,setErr] = useState("")
  const [busy,setBusy] = useState(false)

  const submit = async () => {
    setErr(""); setBusy(true)
    if (mode === "signup") {
      if (!name.trim()) { setErr("Enter your name"); setBusy(false); return }
      if (!email.includes("@")) { setErr("Enter a valid email"); setBusy(false); return }
      if (pass.length < 6) { setErr("Password must be 6+ characters"); setBusy(false); return }
      const { user, error } = await db.signUp(email, pass, name)
      if (error) setErr(error); else if (user) onAuth(user)
    } else {
      const { user, error } = await db.signIn(email, pass)
      if (error) setErr(error); else if (user) onAuth(user)
    }
    setBusy(false)
  }

  return (
    <div style={{display:"flex",justifyContent:"center",alignItems:"center",minHeight:"100vh",padding:20}}>
      <div style={{width:"100%",maxWidth:400,animation:"slideUp .5s ease"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <h1 style={{fontSize:32,fontWeight:900,letterSpacing:"-1px"}}><span style={{color:"#f5c542"}}>KEY</span> TRANSFORM</h1>
          <p style={{fontSize:14,color:"#6a6d77",marginTop:8}}>Your health transformation command center</p>
        </div>
        <div className="cd" style={{padding:28}}>
          <h2 style={{fontSize:18,fontWeight:700,marginBottom:20}}>{mode==="signup"?"Create Account":"Sign In"}</h2>
          {err && <div style={{padding:"10px 14px",borderRadius:8,background:"#e74c3c20",color:"#e74c3c",fontSize:13,marginBottom:14}}>{err}</div>}
          {mode==="signup" && <div style={{marginBottom:14}}><div className="lb">Your Name</div><input className="inp" value={name} onChange={e=>setName(e.target.value)} placeholder="First name" /></div>}
          <div style={{marginBottom:14}}><div className="lb">Email</div><input className="inp" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" /></div>
          <div style={{marginBottom:20}}><div className="lb">Password</div><input className="inp" type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder={mode==="signup"?"Create a password (6+ chars)":"Your password"} onKeyDown={e=>e.key==="Enter"&&submit()} /></div>
          <button className="bt" style={{width:"100%"}} onClick={submit} disabled={busy}>{busy?"...":(mode==="signup"?"Create Account":"Sign In")}</button>
          <div style={{textAlign:"center",marginTop:16,fontSize:13,color:"#6a6d77"}}>
            {mode==="signup"?"Already have an account? ":"Need an account? "}
            <span onClick={()=>{setMode(mode==="signup"?"login":"signup");setErr("")}} style={{color:"#f5c542",cursor:"pointer",fontWeight:600}}>{mode==="signup"?"Sign in":"Create one"}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── WIZARD ──────────────────────────────────────────────
function WizardScreen({ profile, user, onComplete }: any) {
  const [p,setP] = useState({...defaultProfile(), ...profile})
  const [step,setStep] = useState(0)
  const update = (k: string, v: any) => setP((prev: any) => ({...prev, [k]:v}))
  const toggleArr = (k: string, v: string) => setP((prev: any) => ({...prev, [k]: (prev[k]||[]).includes(v) ? (prev[k]||[]).filter((x:string)=>x!==v) : [...(prev[k]||[]),v] }))
  const Chip = ({label,on,onClick}:{label:string,on:boolean,onClick:()=>void}) => <button className={"chip"+(on?" on":"")} onClick={onClick}>{label}</button>

  const steps = [
    <div key="basics" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div><div className="lb">Age</div><input className="inp" type="number" placeholder="Your age" value={p.age||""} onChange={e=>update("age",e.target.value?Number(e.target.value):null)} /></div>
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1}}><div className="lb">Height (ft)</div><input className="inp" type="number" value={p.height_ft||""} onChange={e=>update("height_ft",e.target.value?Number(e.target.value):null)} /></div>
        <div style={{flex:1}}><div className="lb">Height (in)</div><input className="inp" type="number" value={p.height_in||""} onChange={e=>update("height_in",e.target.value?Number(e.target.value):null)} /></div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1}}><div className="lb">Current Weight (lbs)</div><input className="inp" type="number" value={p.weight||""} onChange={e=>update("weight",e.target.value?Number(e.target.value):null)} /></div>
        <div style={{flex:1}}><div className="lb">Goal Weight (lbs)</div><input className="inp" type="number" value={p.goal_weight||""} onChange={e=>update("goal_weight",e.target.value?Number(e.target.value):null)} /></div>
      </div>
      <div><div className="lb">Waist at navel (inches)</div><input className="inp" type="number" step="0.5" value={p.waist||""} onChange={e=>update("waist",e.target.value?Number(e.target.value):null)} /></div>
      <div><div className="lb">Name</div><input className="inp" value={p.name} onChange={e=>update("name",e.target.value)} placeholder="First name" /></div>
    </div>,
    <div key="health" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1}}><div className="lb">BP Systolic</div><input className="inp" type="number" value={p.bp_sys||""} onChange={e=>update("bp_sys",e.target.value?Number(e.target.value):null)} /></div>
        <div style={{flex:1}}><div className="lb">Diastolic</div><input className="inp" type="number" value={p.bp_dia||""} onChange={e=>update("bp_dia",e.target.value?Number(e.target.value):null)} /></div>
      </div>
      <div><div className="lb">Blood Sugar</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{["normal","borderline / prediabetic","diabetic","not sure"].map(v=><Chip key={v} label={v} on={p.blood_sugar===v} onClick={()=>update("blood_sugar",v)}/>)}</div></div>
      <div><div className="lb">Sleep Apnea?</div><div style={{display:"flex",gap:8}}><Chip label="Yes" on={p.sleep_apnea} onClick={()=>update("sleep_apnea",true)}/><Chip label="No" on={!p.sleep_apnea} onClick={()=>update("sleep_apnea",false)}/></div></div>
      <div><div className="lb">Fertility Goal?</div><div style={{display:"flex",gap:8}}><Chip label="Yes" on={p.fertility_goal} onClick={()=>update("fertility_goal",true)}/><Chip label="No" on={!p.fertility_goal} onClick={()=>update("fertility_goal",false)}/></div></div>
      <div><div className="lb">Medications</div><input className="inp" value={p.medications} onChange={e=>update("medications",e.target.value)} placeholder="Or 'none'" /></div>
      <div><div className="lb">Allergies</div><input className="inp" value={p.allergies} onChange={e=>update("allergies",e.target.value)} placeholder="Or 'none'" /></div>
    </div>,
    <div key="diet" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div><div className="lb">Diet Style</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{["keto-carnivore","strict carnivore","keto","low carb","no preference"].map(v=><Chip key={v} label={v} on={p.diet_style===v} onClick={()=>update("diet_style",v)}/>)}</div></div>
      <div><div className="lb">Fasting Plan</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{["48h-weekly","72h-weekly","36h-weekly","16:8 daily","OMAD","no fasting"].map(v=><Chip key={v} label={v} on={p.fasting_plan===v} onClick={()=>update("fasting_plan",v)}/>)}</div></div>
      <div><div className="lb">Foods You Love</div><input className="inp" value={p.foods_love} onChange={e=>update("foods_love",e.target.value)} /></div>
      <div><div className="lb">Foods You Avoid</div><input className="inp" value={p.foods_wont_eat} onChange={e=>update("foods_wont_eat",e.target.value)} /></div>
      <div><div className="lb">Injuries</div><input className="inp" value={p.injuries} onChange={e=>update("injuries",e.target.value)} placeholder="Bad knees, shoulder issues, etc." /></div>
      <div><div className="lb">Weekly Food Budget ($)</div><input className="inp" type="number" value={p.budget||""} onChange={e=>update("budget",e.target.value?Number(e.target.value):null)} /></div>
    </div>,
    <div key="goals" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div><div className="lb">Select Your Goals</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{GOAL_OPTIONS.map(g=><Chip key={g} label={g} on={(p.goals||[]).includes(g)} onClick={()=>toggleArr("goals",g)}/>)}</div></div>
      <div><div className="lb">What is driving this transformation?</div><textarea className="inp" style={{minHeight:80,resize:"vertical"}} value={p.goals_own_words||""} onChange={e=>update("goals_own_words",e.target.value)} placeholder="Your 'why' in your own words..." /></div>
      <div><div className="lb">Specific areas of concern</div><textarea className="inp" style={{minHeight:80,resize:"vertical"}} value={p.specific_concerns||""} onChange={e=>update("specific_concerns",e.target.value)} placeholder="What bothers you most..." /></div>
      <div><div className="lb">Anything else the AI Coach should know</div><textarea className="inp" style={{minHeight:80,resize:"vertical"}} value={p.additional_info||""} onChange={e=>update("additional_info",e.target.value)} placeholder="Past diets, mental health, devices, inspiration..." /></div>
    </div>,
  ]

  const titles = ["About You","Health Status","Diet & Training","Goals & Your Story"]

  return (
    <div style={{display:"flex",justifyContent:"center",padding:"40px 20px",minHeight:"100vh"}}>
      <div style={{width:"100%",maxWidth:600}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <h1 style={{fontSize:24,fontWeight:800}}><span style={{color:"#f5c542"}}>KEY</span> TRANSFORM</h1>
          <p style={{fontSize:13,color:"#6a6d77",marginTop:4}}>{"Let's build your plan"+(p.name?", "+p.name:"")}</p>
        </div>
        <div style={{display:"flex",gap:4,marginBottom:24}}>{titles.map((_,i)=><div key={i} style={{flex:1,height:4,borderRadius:2,background:i<=step?"#f5c542":"#2a2d37"}}/>)}</div>
        <h3 style={{fontSize:18,fontWeight:700,marginBottom:12}}>{titles[step]} <span style={{fontSize:12,color:"#6a6d77"}}>Step {step+1}/{titles.length}</span></h3>
        <div className="cd" style={{padding:24}}>{steps[step]}</div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:16}}>
          <button className="bt bto" onClick={()=>setStep(s=>s-1)} style={{visibility:step>0?"visible":"hidden"}}>Back</button>
          <div style={{display:"flex",gap:8}}>
            {(profile.name && profile.age && profile.weight) && (
              <button className="bt bto" onClick={()=>onComplete(p)} style={{fontSize:12}}>Go to Dashboard</button>
            )}
            <button className="bt" onClick={()=>{ if(step<steps.length-1) setStep(s=>s+1); else onComplete(p); }}>{step===steps.length-1?"Complete Setup":"Next"}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── SHARED UI ───────────────────────────────────────────
function SC({label,value,sub,color}:any) { return <div className="cd cdg" style={{textAlign:"center"}}><div className="lb">{label}</div><div style={{fontSize:28,fontWeight:800,color,marginTop:4}}>{value}</div><div style={{fontSize:12,color:"#6a6d77",marginTop:2}}>{sub}</div></div> }
function PBar({label,pct,color,left,right}:any) { return <div style={{marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{fontWeight:600,color:"#e8e6e1"}}>{label}</span><span style={{color,fontWeight:700}}>{Math.round(pct)}%</span></div><div style={{height:12,background:"#12141c",borderRadius:6,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,pct)+"%",background:color,borderRadius:6,transition:"width 1s ease"}}/></div><div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#4a4d57",marginTop:3}}><span>{left}</span><span>{right}</span></div></div> }
function RatingPick({label,value,onChange,color,lo,hi}:any) { return <div style={{marginBottom:14}}><div className="lb">{label}</div><div style={{display:"flex",gap:6,marginTop:6}}>{[1,2,3,4,5].map(n=><button key={n} onClick={()=>onChange(n)} style={{width:44,height:44,borderRadius:8,border:"2px solid "+(value===n?color:"#2a2d37"),background:value===n?color+"25":"#12141c",color:value===n?color:"#6a6d77",fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>{n}</button>)}</div>{lo&&<div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#4a4d57",marginTop:4,padding:"0 2px"}}><span>{lo}</span><span>{hi}</span></div>}</div> }

// ─── OVERVIEW ────────────────────────────────────────────
function OverviewTab({data,pf,sw,gw}:any) {
  const lw=data.weights.length?data.weights[data.weights.length-1].value:sw
  const lost=sw-lw;const diff=sw-gw;const pct=diff>0?Math.min(100,(lost/diff)*100):0
  const ts=data.suppChecks[today()]||[];const sp=Math.round((ts.length/SUPPS.length)*100)
  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
      <SC label="Current Weight" value={lw+" lbs"} sub={(lost>0?"-":"")+Math.abs(lost)+" lbs"} color={lost>0?"#2ecc71":"#e8e6e1"} />
      <SC label="Goal Progress" value={Math.round(pct)+"%"} sub={Math.round(diff-lost)+" lbs to go"} color="#f5c542" />
      <SC label="Supplements Today" value={sp+"%"} sub={ts.length+"/"+SUPPS.length+" taken"} color={sp===100?"#2ecc71":"#e67e22"} />
    </div>
    {pf.goals_own_words&&<div className="cd" style={{background:"linear-gradient(135deg,#1a1d27,#1e1f2a)"}}><h3 style={{fontSize:15,fontWeight:700,marginBottom:8}}>My Why</h3><p style={{fontSize:13,color:"#a0a3ad",lineHeight:1.6}}>{pf.goals_own_words}</p></div>}
  </div>
}

// ─── PROGRESS ────────────────────────────────────────────
function ProgressTab({data,sw,gw,pf}:any) {
  const lw=data.weights.length?data.weights[data.weights.length-1].value:sw
  const diff=sw-gw;const wpct=diff>0?Math.min(100,((sw-lw)/diff)*100):0
  const wt=data.weights.map((w:any)=>({date:fmt(w.date),weight:w.value}))
  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div className="cd cdg" style={{textAlign:"center",padding:24}}><div style={{fontSize:28,fontWeight:900,color:"#f5c542"}}>{sw-lw>0?(sw-lw)+" lbs Lost":"Starting Point"}</div><div style={{fontSize:13,color:"#8a8d97",marginTop:4}}>{lw} lbs now | {Math.round(diff-(sw-lw))} remaining</div></div>
    <div className="cd"><PBar label={"Weight ("+sw+" to "+gw+")"} pct={wpct} color="#f5c542" left={sw+" lbs"} right={gw+" lbs"}/></div>
    {wt.length>1&&<div className="cd"><h3 style={{fontSize:15,fontWeight:700,marginBottom:14}}>Weight Timeline</h3><ResponsiveContainer width="100%" height={200}><AreaChart data={wt}><defs><linearGradient id="pw" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f5c542" stopOpacity={0.3}/><stop offset="95%" stopColor="#f5c542" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#2a2d37"/><XAxis dataKey="date" tick={{fill:"#6a6d77",fontSize:10}}/><YAxis domain={[gw-10,sw+10]} tick={{fill:"#6a6d77",fontSize:11}}/><Tooltip contentStyle={{background:"#1a1d27",border:"1px solid #2a2d37",borderRadius:8,color:"#e8e6e1"}}/><Area type="monotone" dataKey="weight" stroke="#f5c542" fill="url(#pw)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div>}
  </div>
}

// ─── FASTING ─────────────────────────────────────────────
function FastingTab({data,user,refresh}:any) {
  const [now,setNow]=useState(Date.now())
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[])
  const startFast=async()=>{await db.startCurrentFast(user.id);refresh()}
  const endFast=async()=>{if(!data.currentFast)return;const h=Math.round((Date.now()-data.currentFast)/36e5*10)/10;await db.addFast(user.id,new Date(data.currentFast).toISOString(),new Date().toISOString(),h);await db.endCurrentFast(user.id);refresh()}
  const el=data.currentFast?(now-data.currentFast)/1000:0
  const hrs=Math.floor(el/3600),mins=Math.floor((el%3600)/60),secs=Math.floor(el%60)
  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div className="cd cdg" style={{textAlign:"center",padding:30}}>{data.currentFast?<div><div className="lb">FASTING</div><div style={{fontSize:48,fontWeight:900,color:"#f5c542",animation:"pulse 2s infinite"}}>{String(hrs).padStart(2,"0")}:{String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}</div><button className="bt btd" style={{marginTop:20}} onClick={endFast}>End Fast</button></div>:<div><div style={{fontSize:28,fontWeight:700}}>Start Your Fast</div><button className="bt" style={{marginTop:16}} onClick={startFast}>Begin Fast</button></div>}</div>
    <div className="cd"><h3 style={{fontSize:15,fontWeight:700,marginBottom:12}}>History</h3>{data.fastLog.length===0?<p style={{fontSize:13,color:"#6a6d77"}}>No fasts yet.</p>:<div style={{display:"flex",flexDirection:"column",gap:6}}>{[...data.fastLog].reverse().slice(0,10).map((f:any,i:number)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",background:"#12141c",borderRadius:8}}><span style={{fontSize:13}}>{new Date(f.start).toLocaleDateString()}</span><span className="tg">{f.hours}h</span></div>)}</div>}</div>
  </div>
}

// ─── FOOD LOG ────────────────────────────────────────────
function FoodLogTab({data,user,refresh}:any) {
  const [e,setE]=useState({food:"",protein:"",fat:"",carbs:"",cal:""})
  const add=async()=>{if(!e.food)return;await db.addFood(user.id,today(),e.food,Number(e.protein)||0,Number(e.fat)||0,Number(e.carbs)||0,Number(e.cal)||0);setE({food:"",protein:"",fat:"",carbs:"",cal:""});refresh()}
  const tl=data.foodLog.filter((f:any)=>f.date===today())
  const tot=tl.reduce((a:any,f:any)=>({protein:a.protein+f.protein,fat:a.fat+f.fat,carbs:a.carbs+f.carbs,cal:a.cal+f.cal}),{protein:0,fat:0,carbs:0,cal:0})
  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div className="cd"><h3 style={{fontSize:15,fontWeight:700,marginBottom:12}}>Today: P:{tot.protein}g F:{tot.fat}g C:{tot.carbs}g | {tot.cal} cal</h3></div>
    <div className="cd"><h3 style={{fontSize:15,fontWeight:700,marginBottom:12}}>Log Food</h3><div style={{display:"flex",flexDirection:"column",gap:8}}><input className="inp" placeholder="What did you eat?" value={e.food} onChange={x=>setE({...e,food:x.target.value})}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}><input className="inp" placeholder="Protein" type="number" value={e.protein} onChange={x=>setE({...e,protein:x.target.value})}/><input className="inp" placeholder="Fat" type="number" value={e.fat} onChange={x=>setE({...e,fat:x.target.value})}/><input className="inp" placeholder="Carbs" type="number" value={e.carbs} onChange={x=>setE({...e,carbs:x.target.value})}/><input className="inp" placeholder="Cal" type="number" value={e.cal} onChange={x=>setE({...e,cal:x.target.value})}/></div><button className="bt" onClick={add}>Add</button></div></div>
    {tl.length>0&&<div className="cd">{tl.map((f:any,i:number)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:13}}><span>{f.food}</span><span style={{color:"#8a8d97"}}>P:{f.protein} F:{f.fat} C:{f.carbs} | {f.cal}cal</span></div>)}</div>}
  </div>
}

// ─── BODY STATS ──────────────────────────────────────────
function BodyStatsTab({data,user,refresh}:any) {
  const [wt,sWt]=useState("");const [ws,sWs]=useState("");const [bs,sBs]=useState("");const [bd,sBd]=useState("")
  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div className="cd"><h3 style={{fontSize:15,fontWeight:700,marginBottom:12}}>Weight</h3><div style={{display:"flex",gap:8}}><input className="inp" style={{width:140}} placeholder="lbs" type="number" value={wt} onChange={x=>sWt(x.target.value)}/><button className="bt" onClick={async()=>{if(!wt)return;await db.addWeight(user.id,today(),Number(wt));sWt("");refresh()}}>Log</button></div></div>
    <div className="cd"><h3 style={{fontSize:15,fontWeight:700,marginBottom:12}}>Waist</h3><div style={{display:"flex",gap:8}}><input className="inp" style={{width:140}} placeholder="inches" type="number" step="0.5" value={ws} onChange={x=>sWs(x.target.value)}/><button className="bt" onClick={async()=>{if(!ws)return;await db.addWaist(user.id,today(),Number(ws));sWs("");refresh()}}>Log</button></div></div>
    <div className="cd"><h3 style={{fontSize:15,fontWeight:700,marginBottom:12}}>Blood Pressure</h3><div style={{display:"flex",gap:8,alignItems:"center"}}><input className="inp" style={{width:100}} placeholder="Sys" type="number" value={bs} onChange={x=>sBs(x.target.value)}/><span style={{color:"#6a6d77"}}>/</span><input className="inp" style={{width:100}} placeholder="Dia" type="number" value={bd} onChange={x=>sBd(x.target.value)}/><button className="bt" onClick={async()=>{if(!bs||!bd)return;await db.addBP(user.id,today(),Number(bs),Number(bd));sBs("");sBd("");refresh()}}>Log</button></div></div>
  </div>
}

// ─── WORKOUTS ────────────────────────────────────────────
function WorkoutTab({data,user,refresh}:any) {
  const [day,setDay]=useState("Push Day");const [done,setDone]=useState<Record<number,boolean>>({})
  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div style={{display:"flex",gap:8}}>{Object.keys(WK).map(d=><button key={d} className={day===d?"bt":"bt bto"} style={{flex:1,fontSize:12}} onClick={()=>{setDay(d);setDone({})}}>{d}</button>)}</div>
    <div className="cd"><h3 style={{fontSize:15,fontWeight:700,marginBottom:14}}>{day}</h3>{WK[day].map((x,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:done[i]?"#f5c54210":"#12141c",borderRadius:8,marginBottom:6}}><div onClick={()=>setDone({...done,[i]:!done[i]})} style={{width:22,height:22,borderRadius:6,border:"2px solid "+(done[i]?"#f5c542":"#3a3d47"),background:done[i]?"#f5c542":"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{done[i]&&<span style={{color:"#0f1117",fontSize:14}}>✓</span>}</div><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>{x.ex}</div><div style={{fontSize:11,color:"#6a6d77"}}>{x.note}</div></div><span className="tg">{x.sets}</span></div>)}<button className="bt" style={{marginTop:12,width:"100%"}} onClick={async()=>{await db.addWorkout(user.id,today(),day,done);setDone({});refresh()}}>Log Workout</button></div>
    <div className="cd"><h3 style={{fontSize:15,fontWeight:700,marginBottom:12}}>History</h3>{data.workoutLog.length===0?<p style={{fontSize:13,color:"#6a6d77"}}>None yet.</p>:<div>{[...data.workoutLog].reverse().slice(0,10).map((w:any,i:number)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:13}}><span>{fmt(w.date)}</span><span className="tg">{w.day}</span></div>)}</div>}</div>
  </div>
}

// ─── SUPPLEMENTS ─────────────────────────────────────────
function SuppTab({data,user,refresh}:any) {
  const tc=data.suppChecks[today()]||[]
  const toggle=async(i:number)=>{const c=tc.includes(i)?tc.filter((x:number)=>x!==i):[...tc,i];await db.setSuppChecks(user.id,today(),c);refresh()}
  const pct=Math.round((tc.length/SUPPS.length)*100)
  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div className="cd cdg" style={{textAlign:"center"}}><div style={{fontSize:42,fontWeight:900,color:pct===100?"#2ecc71":"#f5c542"}}>{pct}%</div></div>
    <div className="cd">{SUPPS.map((s,i)=><div key={i} onClick={()=>toggle(i)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,cursor:"pointer"}}><div style={{width:22,height:22,borderRadius:6,border:"2px solid "+(tc.includes(i)?"#f5c542":"#3a3d47"),background:tc.includes(i)?"#f5c542":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{tc.includes(i)&&<span style={{color:"#0f1117",fontSize:14}}>✓</span>}</div><div><div style={{fontSize:14,fontWeight:600,opacity:tc.includes(i)?0.5:1}}>{s.name} — {s.dose}</div><div style={{fontSize:11,color:"#6a6d77"}}>{s.time} | {s.why}</div></div></div>)}</div>
  </div>
}

// ─── MEAL PLAN ───────────────────────────────────────────
function MealTab({pf}:any) {
  return <div className="cd"><h3 style={{fontSize:15,fontWeight:700,marginBottom:12}}>Personalized Meal Plan</h3><p style={{fontSize:13,color:"#a0a3ad"}}>Diet: {pf.diet_style} | Budget: ${pf.budget}/wk | Loves: {pf.foods_love||"not set"}</p><p style={{fontSize:12,color:"#6a6d77",marginTop:12}}>Ask the <strong style={{color:"#f5c542"}}>AI Coach</strong> tab for a fully personalized weekly meal plan, recipes, and shopping list.</p></div>
}

// ─── SEXUAL HEALTH ───────────────────────────────────────
function SexTab({data,user,refresh}:any) {
  const [form,setForm]=useState({morningWood:"",erectionQuality:3,libido:3,hadSex:false,volume:"normal",stamina:"normal",notes:""})
  const logEntry=async()=>{await db.addSexEntry(user.id,{...form,date:today()});setForm({morningWood:"",erectionQuality:3,libido:3,hadSex:false,volume:"normal",stamina:"normal",notes:""});refresh()}
  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div className="cd"><h3 style={{fontSize:15,fontWeight:700,marginBottom:14}}>Log Today</h3>
      <div style={{marginBottom:14}}><div className="lb">Morning Wood</div><div style={{display:"flex",gap:8,marginTop:6}}>{[{v:"yes",l:"Yes",c:"#2ecc71"},{v:"partial",l:"Partial",c:"#f5c542"},{v:"no",l:"None",c:"#e74c3c"}].map(o=><button key={o.v} onClick={()=>setForm({...form,morningWood:o.v})} style={{flex:1,padding:"10px",borderRadius:8,cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontSize:13,fontWeight:600,border:"2px solid "+(form.morningWood===o.v?o.c:"#2a2d37"),background:form.morningWood===o.v?o.c+"20":"#12141c",color:form.morningWood===o.v?o.c:"#6a6d77"}}>{o.l}</button>)}</div></div>
      <RatingPick label="Libido" value={form.libido} onChange={(v:number)=>setForm({...form,libido:v})} color="#3498db" lo="Dead" hi="On fire"/>
      <div style={{marginBottom:14}}><div className="lb">Activity</div><div style={{display:"flex",gap:8}}><button onClick={()=>setForm({...form,hadSex:true})} className={form.hadSex?"bt":"bt bto"} style={{flex:1}}>Yes</button><button onClick={()=>setForm({...form,hadSex:false})} className={!form.hadSex?"bt":"bt bto"} style={{flex:1}}>No</button></div></div>
      {form.hadSex&&<RatingPick label="Erection Quality" value={form.erectionQuality} onChange={(v:number)=>setForm({...form,erectionQuality:v})} color="#e056a0" lo="Weak" hi="Rock solid"/>}
      <button className="bt" style={{width:"100%"}} onClick={logEntry}>Log Entry</button>
    </div>
    <div className="cd"><h3 style={{fontSize:15,fontWeight:700,marginBottom:12}}>Recent</h3>{data.sexLog.length===0?<p style={{fontSize:13,color:"#6a6d77"}}>No entries.</p>:<div>{[...data.sexLog].reverse().slice(0,10).map((e:any,i:number)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:12}}><span>{fmt(e.date)}</span><span>AM:{e.morningWood==="yes"?"Y":"N"} L:{e.libido}/5 {e.hadSex?"E:"+e.erectionQuality+"/5":""}</span></div>)}</div>}</div>
  </div>
}

// ─── AI COACH ────────────────────────────────────────────
function CoachTab({pf, userId}:any) {
  const KEY = `kt_coach_${userId||'default'}`
  const [msgs,setMsgs]=useState<any[]>(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return []}})
  const [input,setInput]=useState("");const [busy,setBusy]=useState(false);const ref=useRef<HTMLDivElement>(null)
  const SYS="You are KEY COACH, an elite health transformation advisor for "+pf.name+". Age "+(pf.age||"?")+", "+(pf.height_ft||"?")+"ft"+(pf.height_in||"?")+"in, "+(pf.weight||"?")+"lbs (goal "+(pf.goal_weight||"?")+"). BP "+(pf.bp_sys||"?")+"/"+(pf.bp_dia||"?")+". Blood sugar: "+pf.blood_sugar+". Diet: "+pf.diet_style+". Fasting: "+pf.fasting_plan+". Injuries: "+(pf.injuries||"none")+". Allergies: "+(pf.allergies||"none")+". Goals: "+(pf.goals||[]).join(", ")+". "+(pf.goals_own_words?"MOTIVATION: "+pf.goals_own_words+". ":"")+(pf.specific_concerns?"CONCERNS: "+pf.specific_concerns+". ":"")+(pf.additional_info?"CONTEXT: "+pf.additional_info+". ":"")+"YOUR EXPERTISE: health/fitness, fasting, keto/carnivore nutrition, bodybuilding, natural medicine, supplements, red light therapy, biology, culinary arts, and The Bible. Style: direct, no-BS, specific numbers, scripture when natural, actionable. IMPORTANT: Chat history is automatically saved on the user's device. When asked to save or remember this conversation, confirm it is already saved automatically."

  // Auto-save chat to localStorage on every message change
  useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify(msgs))}catch{}},[msgs,KEY])

  const send=async()=>{if(!input.trim()||busy)return;const um={role:"user",content:input.trim()};const nm=[...msgs,um];setMsgs(nm);setInput("");setBusy(true);try{const r=await fetch("/api/coach",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system:SYS,messages:nm.map((m:any)=>({role:m.role,content:m.content}))})});const d=await r.json();const txt=(d.content||[]).filter((b:any)=>b.type==="text").map((b:any)=>b.text).join("")||"Error.";setMsgs([...nm,{role:"assistant",content:txt}])}catch{setMsgs([...nm,{role:"assistant",content:"Connection error."}])}setBusy(false)}
  const clearChat=()=>{setMsgs([]);try{localStorage.removeItem(KEY)}catch{}}
  useEffect(()=>{if(ref.current)ref.current.scrollTop=ref.current.scrollHeight},[msgs,busy])

  return <div style={{display:"flex",flexDirection:"column",height:"calc(100vh-180px)",maxHeight:700}}>
    <div style={{padding:"14px 16px",background:"#1a1d27",borderRadius:"12px 12px 0 0",border:"1px solid #2a2d37",borderBottom:"none",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div><div style={{fontSize:15,fontWeight:700}}>KEY COACH</div><div style={{fontSize:11,color:"#6a6d77"}}>Personalized for {pf.name} · Chat auto-saved</div></div>
      {msgs.length>0&&<button className="bt bto bts" onClick={clearChat}>Clear Chat</button>}
    </div>
    <div ref={ref} style={{flex:1,overflow:"auto",padding:16,background:"#12141c",borderLeft:"1px solid #2a2d37",borderRight:"1px solid #2a2d37",display:"flex",flexDirection:"column",gap:12}}>
      {msgs.length===0&&<div style={{textAlign:"center",padding:30,color:"#6a6d77",fontSize:13}}>Ask me anything about your plan.<br/><span style={{fontSize:11,marginTop:8,display:"block",color:"#4a4d57"}}>Chats are saved automatically on this device.</span></div>}
      {msgs.map((m:any,i:number)=><div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}><div style={{maxWidth:"85%",padding:"10px 14px",borderRadius:12,background:m.role==="user"?"#f5c542":"#1a1d27",color:m.role==="user"?"#0f1117":"#e8e6e1",fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap",border:m.role==="user"?"none":"1px solid #2a2d37"}}>{m.content}</div></div>)}
      {busy&&<div style={{padding:"10px 18px",borderRadius:12,background:"#1a1d27",border:"1px solid #2a2d37",width:"fit-content"}}><div style={{display:"flex",gap:4,animation:"pulse 1s infinite"}}><div style={{width:7,height:7,borderRadius:"50%",background:"#f5c542"}}/><div style={{width:7,height:7,borderRadius:"50%",background:"#f5c542",opacity:.6}}/><div style={{width:7,height:7,borderRadius:"50%",background:"#f5c542",opacity:.3}}/></div></div>}
    </div>
    <div style={{padding:"12px 16px",background:"#1a1d27",borderRadius:"0 0 12px 12px",border:"1px solid #2a2d37",borderTop:"none",display:"flex",gap:8}}><input className="inp" style={{flex:1,background:"#12141c"}} placeholder="Ask anything..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")send()}}/><button className="bt" onClick={send} disabled={busy||!input.trim()}>Send</button></div>
  </div>
}
