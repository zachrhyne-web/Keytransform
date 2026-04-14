'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { supabase } from '@/lib/supabase'
import * as db from '@/lib/db'

const TABS = ["Overview","Progress","Fasting","Food Log","Body Stats","Workouts","Supplements","Meal Plan","Sexual Health","Labs & Docs","AI Coach"]
const today = () => new Date().toISOString().split("T")[0]
const fmt = (d: string) => new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})

const GOAL_OPTIONS_SHARED = [
  "Lose weight / fat loss","Reverse prediabetes / blood sugar","Lower blood pressure",
  "Athletic / muscular look","Improve skin / look younger","Mental clarity / energy",
  "Better sleep","Reduce stress / cortisol","Build strength & muscle",
]
const GOAL_OPTIONS_MALE = [
  "Boost testosterone / erections","Fertility / sperm count","Prostate relief","Reduce gynecomastia",
]
const GOAL_OPTIONS_FEMALE = [
  "Hormonal balance / cycle regulation","PCOS management","Perimenopause / menopause support",
  "Bone density / prevent osteoporosis","Pelvic floor health","Female fertility",
  "Reduce bloating / water retention","Postpartum recovery","Reduce PMS symptoms",
]
const getGoalOptions = (gender: string) => [
  ...GOAL_OPTIONS_SHARED,
  ...(gender === 'female' ? GOAL_OPTIONS_FEMALE : GOAL_OPTIONS_MALE),
]

const SUPPS_MALE = [
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
const SUPPS_FEMALE = [
  {name:"Vitamin D3+K2",dose:"5,000 IU+100mcg",time:"Morning w/ fat",why:"Bone density, immunity, mood"},
  {name:"Magnesium Glycinate",dose:"400mg",time:"Before bed",why:"PMS, sleep, muscle recovery"},
  {name:"Fish Oil (EPA/DHA)",dose:"3g combined",time:"With meals",why:"Inflammation, hormones, skin"},
  {name:"Calcium + Vitamin D",dose:"1,000mg + 1,000IU",time:"With meals",why:"Bone density, muscle function"},
  {name:"Methylfolate (B9)",dose:"400mcg",time:"Morning",why:"Hormonal health, fertility, mood"},
  {name:"Maca Root",dose:"1,500mg",time:"Morning",why:"Hormonal balance, libido, energy"},
  {name:"Vitex / Chasteberry",dose:"400mg",time:"Morning",why:"Cycle regulation, PMS relief"},
  {name:"Evening Primrose Oil",dose:"1,000mg",time:"Cycle days 1–14",why:"Hormonal balance, PMS, skin"},
  {name:"Berberine",dose:"500mg 2x/day",time:"Before meals",why:"Blood sugar, PCOS support"},
  {name:"Ashwagandha KSM-66",dose:"600mg",time:"Morning",why:"Cortisol, stress, energy"},
  {name:"Zinc Picolinate",dose:"25mg",time:"Evening w/ food",why:"Immunity, skin, hormones"},
  {name:"Iron (if low)",dose:"18mg",time:"Empty stomach w/ vit C",why:"Energy, blood health"},
  {name:"Creatine",dose:"3–5g",time:"Any time",why:"Strength, cognitive function"},
  {name:"Electrolytes",dose:"See fasting tab",time:"During fasts",why:"Prevent cramping"},
]

const WK_MALE: Record<string, {ex:string,sets:string,note:string}[]> = {
  "Push Day":[{ex:"DB Floor Press",sets:"4x10",note:"Shoulder-safe"},{ex:"DB Overhead Press",sets:"3x10",note:"Seated"},{ex:"Push-Ups / Band",sets:"3x15",note:"Band around back"},{ex:"Tricep Extensions",sets:"3x12",note:"Single DB"},{ex:"Lateral Raises",sets:"3x15",note:"Light, slow"}],
  "Pull Day":[{ex:"DB Bent-Over Rows",sets:"4x10",note:"Squeeze lats"},{ex:"Band Pull-Aparts",sets:"4x20",note:"Rear delts"},{ex:"DB Curls",sets:"3x12",note:"Alternate"},{ex:"Face Pulls (band)",sets:"3x15",note:"External rotation"},{ex:"DB Shrugs",sets:"3x15",note:"Hold top 2s"}],
  "Legs & Core":[{ex:"DB Romanian Deadlift",sets:"4x10",note:"Hamstrings & glutes"},{ex:"Hip Thrusts",sets:"4x12",note:"Pause top"},{ex:"Band Walks",sets:"3x15/side",note:"Glute med"},{ex:"Plank Hold",sets:"3x45s",note:"Squeeze"},{ex:"Dead Bugs",sets:"3x10/side",note:"Slow"},{ex:"Farmer Carries",sets:"3x40yd",note:"Heavy, tall"}],
}
const WK_FEMALE: Record<string, {ex:string,sets:string,note:string}[]> = {
  "Glute & Legs":[{ex:"Hip Thrusts",sets:"4x15",note:"Squeeze at top 2s"},{ex:"Sumo DB Squat",sets:"4x12",note:"Wide stance, toes out"},{ex:"DB Romanian Deadlift",sets:"3x12",note:"Hamstrings & glutes"},{ex:"Band Walks",sets:"3x20/side",note:"Glute med activation"},{ex:"Donkey Kicks",sets:"3x15/side",note:"Controlled, squeeze top"},{ex:"Calf Raises",sets:"3x20",note:"Full range of motion"}],
  "Upper Body & Core":[{ex:"DB Shoulder Press",sets:"3x12",note:"Seated, controlled"},{ex:"DB Bent-Over Rows",sets:"3x12",note:"Squeeze shoulder blades"},{ex:"Lateral Raises",sets:"3x15",note:"Light, slow, feel the burn"},{ex:"Tricep Kickbacks",sets:"3x15",note:"Full extension"},{ex:"Plank Hold",sets:"3x45s",note:"Brace core"},{ex:"Dead Bugs",sets:"3x10/side",note:"Lower back on floor"}],
  "Full Body Burn":[{ex:"DB Squat to Press",sets:"3x12",note:"Explosive up"},{ex:"Reverse Lunges",sets:"3x12/side",note:"Step back, knee soft"},{ex:"Push-Up (or band)",sets:"3x10",note:"Modify as needed"},{ex:"DB Row",sets:"3x12/side",note:"Single arm"},{ex:"Hip Thrust",sets:"3x15",note:"Bodyweight or loaded"},{ex:"Mountain Climbers",sets:"3x20",note:"Fast, core tight"}],
}
const WK = (gender: string) => gender === 'female' ? WK_FEMALE : WK_MALE

const defaultProfile = (): any => ({
  gender:"male",
  name:"",age:null,height_ft:null,height_in:null,weight:null,goal_weight:null,waist:null,timeline:6,
  bp_sys:null,bp_dia:null,blood_sugar:"normal",sleep_apnea:false,cpap:false,
  prostate_symptoms:false,fertility_goal:false,medications:"",allergies:"",health_history:"",
  pcos:false,menopause_stage:"none",hormone_concerns:"",
  work_schedule:"",sleep_hours:7,tobacco:"none",alcohol:"none",cannabis:"none",
  current_diet:"",caffeine:"",diet_style:"keto-carnivore",fasting_plan:"48h-weekly",
  foods_love:"",foods_wont_eat:"",cooking_level:"medium",kitchen_gear:[],budget:120,
  stores:[],location:"",lifting_experience:"some",injuries:"",equipment:[],gym_access:false,
  body_type:"",body_focus:[],body_description:"",
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
  const [medDocs, setMedDocs] = useState<any[]>([])
  const [screen, setScreen] = useState("loading")
  const [tab, setTab] = useState(0)

  const refreshMedDocs = useCallback(async (uid?: string) => {
    const id = uid || user?.id
    if (!id) return
    const docs = await db.getMedicalDocs(id)
    setMedDocs(docs)
  }, [user])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        const prof = await db.getProfile(session.user.id)
        const localDone = localStorage.getItem(`kt_done_${session.user.id}`) === '1'
        if (prof) {
          setProfile({...defaultProfile(), ...prof})
          const [allData, docs] = await Promise.all([db.loadAllData(session.user.id), db.getMedicalDocs(session.user.id)])
          setData({...defaultData(), ...allData})
          setMedDocs(docs)
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
          const [allData, docs] = await Promise.all([db.loadAllData(u.id), db.getMedicalDocs(u.id)])
          setData({...defaultData(), ...allData})
          setMedDocs(docs)
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
            {tab===5 && <WorkoutTab data={data} user={user} refresh={refreshData} pf={profile} />}
            {tab===6 && <SuppTab data={data} user={user} refresh={refreshData} pf={profile} />}
            {tab===7 && <MealTab pf={profile} />}
            {tab===8 && <SexTab data={data} user={user} refresh={refreshData} pf={profile} />}
            {tab===9 && <LabsTab user={user} pf={profile} medDocs={medDocs} refreshDocs={()=>refreshMedDocs(user?.id)} />}
            {tab===10 && <CoachTab pf={profile} userId={user?.id} medDocs={medDocs} />}
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
    // ── Step 0: About You ──────────────────────────────────
    <div key="basics" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div><div className="lb">I am a</div><div style={{display:"flex",gap:8}}><Chip label="Male" on={p.gender==='male'} onClick={()=>update("gender","male")}/><Chip label="Female" on={p.gender==='female'} onClick={()=>update("gender","female")}/></div></div>
      <div><div className="lb">Name</div><input className="inp" value={p.name} onChange={e=>update("name",e.target.value)} placeholder="First name" /></div>
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
    </div>,
    // ── Step 1: Health Status ──────────────────────────────
    <div key="health" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1}}><div className="lb">BP Systolic</div><input className="inp" type="number" value={p.bp_sys||""} onChange={e=>update("bp_sys",e.target.value?Number(e.target.value):null)} /></div>
        <div style={{flex:1}}><div className="lb">Diastolic</div><input className="inp" type="number" value={p.bp_dia||""} onChange={e=>update("bp_dia",e.target.value?Number(e.target.value):null)} /></div>
      </div>
      <div><div className="lb">Blood Sugar</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{["normal","borderline / prediabetic","diabetic","not sure"].map(v=><Chip key={v} label={v} on={p.blood_sugar===v} onClick={()=>update("blood_sugar",v)}/>)}</div></div>
      <div><div className="lb">Sleep Apnea?</div><div style={{display:"flex",gap:8}}><Chip label="Yes" on={p.sleep_apnea} onClick={()=>update("sleep_apnea",true)}/><Chip label="No" on={!p.sleep_apnea} onClick={()=>update("sleep_apnea",false)}/></div></div>
      <div><div className="lb">Fertility Goal?</div><div style={{display:"flex",gap:8}}><Chip label="Yes" on={p.fertility_goal} onClick={()=>update("fertility_goal",true)}/><Chip label="No" on={!p.fertility_goal} onClick={()=>update("fertility_goal",false)}/></div></div>
      {p.gender==='female' && <>
        <div style={{padding:"12px 14px",borderRadius:8,background:"#f5c54210",border:"1px solid #f5c54230"}}><div style={{fontSize:12,color:"#f5c542",fontWeight:600,marginBottom:10}}>FEMALE HEALTH</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div><div className="lb">PCOS / Irregular Cycles?</div><div style={{display:"flex",gap:8}}><Chip label="Yes / PCOS" on={p.pcos} onClick={()=>update("pcos",true)}/><Chip label="No / Regular" on={!p.pcos} onClick={()=>update("pcos",false)}/></div></div>
            <div><div className="lb">Menopause Stage</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{["none","perimenopause","menopause","post-menopause"].map(v=><Chip key={v} label={v} on={p.menopause_stage===v} onClick={()=>update("menopause_stage",v)}/>)}</div></div>
            <div><div className="lb">Hormone Concerns</div><input className="inp" value={p.hormone_concerns||""} onChange={e=>update("hormone_concerns",e.target.value)} placeholder="Irregular cycles, hot flashes, mood swings, low libido..." /></div>
          </div>
        </div>
      </>}
      {p.gender==='male' && <div><div className="lb">Prostate Symptoms?</div><div style={{display:"flex",gap:8}}><Chip label="Yes" on={p.prostate_symptoms} onClick={()=>update("prostate_symptoms",true)}/><Chip label="No" on={!p.prostate_symptoms} onClick={()=>update("prostate_symptoms",false)}/></div></div>}
      <div><div className="lb">Medications</div><input className="inp" value={p.medications} onChange={e=>update("medications",e.target.value)} placeholder="Or 'none'" /></div>
      <div><div className="lb">Allergies</div><input className="inp" value={p.allergies} onChange={e=>update("allergies",e.target.value)} placeholder="Or 'none'" /></div>
    </div>,
    // ── Step 2: Diet & Training ────────────────────────────
    <div key="diet" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div><div className="lb">Diet Style</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{["keto-carnivore","strict carnivore","keto","low carb","mediterranean","no preference"].map(v=><Chip key={v} label={v} on={p.diet_style===v} onClick={()=>update("diet_style",v)}/>)}</div></div>
      <div><div className="lb">Fasting Plan</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{["48h-weekly","72h-weekly","36h-weekly","16:8 daily","OMAD","no fasting"].map(v=><Chip key={v} label={v} on={p.fasting_plan===v} onClick={()=>update("fasting_plan",v)}/>)}</div></div>
      <div><div className="lb">Foods You Love</div><input className="inp" value={p.foods_love} onChange={e=>update("foods_love",e.target.value)} /></div>
      <div><div className="lb">Foods You Avoid</div><input className="inp" value={p.foods_wont_eat} onChange={e=>update("foods_wont_eat",e.target.value)} /></div>
      <div><div className="lb">Injuries / Limitations</div><input className="inp" value={p.injuries} onChange={e=>update("injuries",e.target.value)} placeholder="Bad knees, shoulder issues, pelvic floor concerns, etc." /></div>
      <div><div className="lb">Weekly Food Budget ($)</div><input className="inp" type="number" value={p.budget||""} onChange={e=>update("budget",e.target.value?Number(e.target.value):null)} /></div>
    </div>,
    // ── Step 3: Body & Focus ───────────────────────────────
    <div key="body" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div><div className="lb">Body Type</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {(p.gender==='female'
          ? ["Apple (carry weight in middle)","Pear (carry weight in hips/thighs)","Hourglass","Rectangle (straight up/down)","Athletic / muscular"]
          : ["Ectomorph (naturally slim)","Mesomorph (naturally athletic)","Endomorph (naturally stocky)"]
        ).map(v=><Chip key={v} label={v} on={p.body_type===v} onClick={()=>update("body_type",v)}/>)}
      </div></div>
      <div><div className="lb">Areas to Focus On</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {["Belly / midsection","Arms","Thighs / legs","Glutes / hips","Back","Chest","Core","Full body","Love handles","Face / neck"].map(v=>
          <Chip key={v} label={v} on={(p.body_focus||[]).includes(v)} onClick={()=>toggleArr("body_focus",v)}/>
        )}
      </div></div>
      <div><div className="lb">Describe Your Body & What You Want to Change</div>
        <textarea className="inp" style={{minHeight:110,resize:"vertical"}} value={p.body_description||""} onChange={e=>update("body_description",e.target.value)}
          placeholder={p.gender==='female'
            ? "Describe where you carry weight, your body shape, what you love about yourself, what you want to improve, how clothes fit, how you want to feel in your body..."
            : "Describe where you carry weight, what you want to build or lose, how your clothes fit, what you want to look and feel like..."}
        />
      </div>
    </div>,
    // ── Step 4: Goals & Your Story ─────────────────────────
    <div key="goals" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div><div className="lb">Select Your Goals</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{getGoalOptions(p.gender).map(g=><Chip key={g} label={g} on={(p.goals||[]).includes(g)} onClick={()=>toggleArr("goals",g)}/>)}</div></div>
      <div><div className="lb">What is driving this transformation?</div><textarea className="inp" style={{minHeight:80,resize:"vertical"}} value={p.goals_own_words||""} onChange={e=>update("goals_own_words",e.target.value)} placeholder="Your 'why' in your own words..." /></div>
      <div><div className="lb">Specific areas of concern</div><textarea className="inp" style={{minHeight:80,resize:"vertical"}} value={p.specific_concerns||""} onChange={e=>update("specific_concerns",e.target.value)} placeholder="What bothers you most..." /></div>
      <div><div className="lb">Anything else the AI Coach should know</div><textarea className="inp" style={{minHeight:80,resize:"vertical"}} value={p.additional_info||""} onChange={e=>update("additional_info",e.target.value)} placeholder="Past diets, mental health, devices, inspiration..." /></div>
    </div>,
  ]

  const titles = ["About You","Health Status","Diet & Training","Body & Focus","Goals & Your Story"]

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
  const [now,setNow]=useState(Date.now())
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(t)},[])

  // Weight
  const lw=data.weights.length?data.weights[data.weights.length-1].value:sw
  const lost=Number((sw-lw).toFixed(1));const diff=sw-gw;const pct=diff>0?Math.min(100,(lost/diff)*100):0
  const last7w=data.weights.filter((w:any)=>(Date.now()-new Date(w.date+'T12:00:00').getTime())<=7*864e5)
  const weekTrend=last7w.length>=2?Number((last7w[last7w.length-1].value-last7w[0].value).toFixed(1)):null

  // BMI
  const hIn=((pf.height_ft||0)*12+(pf.height_in||0))
  const bmi=hIn>0?((lw/(hIn*hIn))*703):null
  const bmiCat=bmi?(bmi<18.5?{l:"Underweight",c:"#3498db"}:bmi<25?{l:"Normal",c:"#2ecc71"}:bmi<30?{l:"Overweight",c:"#f5c542"}:{l:"Obese",c:"#e74c3c"}):null

  // Waist
  const lWaist=data.waist.length?data.waist[data.waist.length-1].value:(pf.waist||null)
  const waistChg=lWaist&&pf.waist?Number((lWaist-pf.waist).toFixed(1)):null
  const waistRisk=lWaist?(pf.gender==='female'?(lWaist<32?{l:"Low Risk",c:"#2ecc71"}:lWaist<35?{l:"Moderate",c:"#f5c542"}:{l:"High Risk",c:"#e74c3c"}):(lWaist<37?{l:"Low Risk",c:"#2ecc71"}:lWaist<40?{l:"Moderate",c:"#f5c542"}:{l:"High Risk",c:"#e74c3c"})):null

  // BP
  const lBP=data.bp.length?data.bp[data.bp.length-1]:null
  const bpCat=lBP?(lBP.sys<120&&lBP.dia<80?{l:"Normal",c:"#2ecc71"}:lBP.sys<130?{l:"Elevated",c:"#f5c542"}:lBP.sys<140?{l:"High Stage 1",c:"#e67e22"}:{l:"High Stage 2",c:"#e74c3c"}):null

  // Blood sugar
  const bsCat:any={normal:{l:"Normal",c:"#2ecc71"},"borderline / prediabetic":{l:"Prediabetic",c:"#f5c542"},diabetic:{l:"Diabetic",c:"#e74c3c"},"not sure":{l:"Unknown",c:"#8a8d97"}}
  const bsInfo=bsCat[pf.blood_sugar]||{l:"Not set",c:"#8a8d97"}

  // Fasting
  const fastHrs=data.currentFast?((now-data.currentFast)/36e5):null
  const lastFast=data.fastLog.length?data.fastLog[data.fastLog.length-1]:null
  const totalFastH=Math.round(data.fastLog.reduce((s:number,f:any)=>s+(f.hours||0),0))

  // Workouts
  const wkStart=new Date();wkStart.setHours(0,0,0,0);wkStart.setDate(wkStart.getDate()-wkStart.getDay())
  const wksWk=data.workoutLog.filter((w:any)=>new Date(w.date+'T12:00:00')>=wkStart).length
  const lastWO=data.workoutLog.length?data.workoutLog[data.workoutLog.length-1]:null

  // Supps
  const suppList=pf?.gender==='female'?SUPPS_FEMALE:SUPPS_MALE
  const ts=data.suppChecks[today()]||[];const sp=Math.round((ts.length/suppList.length)*100)

  // Nutrition
  const todayF=data.foodLog.filter((f:any)=>f.date===today())
  const calToday=Math.round(todayF.reduce((s:number,f:any)=>s+(f.cal||0),0))
  const proToday=Math.round(todayF.reduce((s:number,f:any)=>s+(f.protein||0),0))
  const fatToday=Math.round(todayF.reduce((s:number,f:any)=>s+(f.fat||0),0))

  // Pace
  const firstW=data.weights.length?new Date(data.weights[0].date+'T12:00:00'):null
  const daysOn=firstW?Math.floor((Date.now()-firstW.getTime())/864e5):0
  const last4w=data.weights.slice(-28)
  const wklyLoss=last4w.length>=7?((last4w[0].value-last4w[last4w.length-1].value)/(last4w.length/7)):null
  const daysToGoal=wklyLoss&&wklyLoss>0&&lost<diff?Math.round(((diff-lost)/wklyLoss)*7):null
  const goalDate=daysToGoal?new Date(Date.now()+daysToGoal*864e5).toLocaleDateString('en-US',{month:'short',year:'numeric'}):null

  const Tile=({label,val,unit="",sub="",color="#e8e6e1",badge=null as any,detail=""}:any)=>(
    <div className="cd" style={{padding:"16px 18px"}}>
      <div style={{fontSize:10,color:"#6a6d77",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>{label}</div>
      <div style={{display:"flex",alignItems:"baseline",gap:4,flexWrap:"wrap"}}>
        <div style={{fontSize:28,fontWeight:900,color,lineHeight:1}}>{val}</div>
        {unit&&<div style={{fontSize:12,color:"#6a6d77"}}>{unit}</div>}
      </div>
      {sub&&<div style={{fontSize:12,color:"#8a8d97",marginTop:5}}>{sub}</div>}
      {badge&&<div style={{marginTop:8,display:"inline-flex",background:badge.c+"22",color:badge.c,padding:"2px 10px",borderRadius:20,fontSize:10,fontWeight:700,border:"1px solid "+badge.c+"44"}}>{badge.l}</div>}
      {detail&&<div style={{fontSize:11,color:"#6a6d77",marginTop:6,paddingTop:6,borderTop:"1px solid #2a2d37"}}>{detail}</div>}
    </div>
  )
  const Sec=({title,children}:any)=>(
    <div><div style={{fontSize:10,color:"#f5c542",fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:10}}>{title}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",gap:10}}>{children}</div></div>
  )

  return <div style={{display:"flex",flexDirection:"column",gap:22}}>
    <Sec title="Body Metrics">
      <Tile label="Current Weight" val={lw} unit="lbs"
        sub={weekTrend!==null?(weekTrend<0?`↓ ${Math.abs(weekTrend)} lbs this week`:`↑ ${weekTrend} lbs this week`):"Log weight to see trends"}
        color={lost>0?"#2ecc71":"#e8e6e1"}
        badge={lost>0?{l:`− ${lost} lbs lost`,c:"#2ecc71"}:null}
        detail={`Start: ${sw} lbs · Goal: ${gw} lbs`}/>
      <Tile label="Goal Progress" val={Math.round(pct)} unit="%"
        sub={`${(diff-lost).toFixed(1)} lbs remaining`}
        color="#f5c542"
        badge={goalDate?{l:`Est. ${goalDate}`,c:"#f5c542"}:null}
        detail={wklyLoss?`${wklyLoss.toFixed(1)} lbs/week current pace`:"Need more weigh-ins"}/>
      <Tile label="BMI" val={bmi?bmi.toFixed(1):"—"}
        sub={hIn>0?`${pf.height_ft||"?"}' ${pf.height_in||"?"}" · ${lw} lbs`:"Add height & weight"}
        color={bmiCat?bmiCat.c:"#8a8d97"} badge={bmiCat}
        detail="Healthy range: 18.5 – 24.9"/>
      <Tile label="Waist" val={lWaist||"—"} unit={lWaist?"in":""}
        sub={waistChg!==null?(waistChg<0?`↓ ${Math.abs(waistChg)} in from start`:`↑ ${waistChg} in from start`):"Log waist in Body Stats"}
        color={waistRisk?waistRisk.c:"#8a8d97"} badge={waistRisk}
        detail={pf.gender==='female'?"Goal: under 35 in (low risk)":"Goal: under 40 in (low risk)"}/>
    </Sec>

    <Sec title="Health Vitals">
      <Tile label="Blood Pressure" val={lBP?`${lBP.sys}/${lBP.dia}`:"—"} unit={lBP?"mmHg":""}
        sub={lBP?`Last: ${fmt(data.bp[data.bp.length-1].date)}`:"Log in Body Stats tab"}
        color={bpCat?bpCat.c:"#8a8d97"} badge={bpCat}
        detail="Optimal: below 120/80 mmHg"/>
      <Tile label="Blood Sugar" val={pf.blood_sugar==="borderline / prediabetic"?"Prediabetic":pf.blood_sugar||"Not set"}
        sub="From your health profile"
        color={bsInfo.c} badge={bsInfo}
        detail="Update any time in Profile"/>
      <Tile label="Fasting Status" val={fastHrs?fastHrs.toFixed(1):(lastFast?lastFast.hours:"—")} unit="hrs"
        sub={fastHrs?"🔥 Active fast in progress":lastFast?`Last: ${new Date(lastFast.start).toLocaleDateString()}`:"No fasts logged yet"}
        color={fastHrs?"#f5c542":lastFast?"#3498db":"#8a8d97"}
        badge={fastHrs?{l:"FASTING NOW",c:"#f5c542"}:null}
        detail={`${data.fastLog.length} sessions · ${totalFastH}h total fasted`}/>
      <Tile label="Program Duration" val={daysOn||"—"} unit={daysOn?"days":""}
        sub={daysOn?`${Math.floor(daysOn/7)} weeks on program`:"Start logging to track"}
        color="#a29bfe"
        detail={firstW?`Started ${firstW.toLocaleDateString('en-US',{month:'long',day:'numeric'})}`:undefined}/>
    </Sec>

    <Sec title="Today">
      <Tile label="Supplements" val={sp} unit="%"
        sub={`${ts.length} of ${suppList.length} taken today`}
        color={sp===100?"#2ecc71":sp>=50?"#f5c542":"#e74c3c"}
        badge={sp===100?{l:"Complete ✓",c:"#2ecc71"}:null}/>
      <Tile label="Calories" val={calToday||"—"} unit={calToday?"kcal":""}
        sub={calToday?`Protein: ${proToday}g · Fat: ${fatToday}g`:"Log food in Food Log tab"}
        color={calToday?"#e8e6e1":"#6a6d77"}
        detail={proToday>100?"Good protein intake":"Aim for 0.8–1g protein per lb goal weight"}/>
      <Tile label="Workouts This Week" val={wksWk} unit="sessions"
        sub={lastWO?`Last: ${lastWO.day} · ${fmt(lastWO.date)}`:"Log workouts in Workouts tab"}
        color={wksWk>=3?"#2ecc71":wksWk>=1?"#f5c542":"#6a6d77"}
        badge={wksWk>=3?{l:"On Track",c:"#2ecc71"}:null}
        detail={`${data.workoutLog.length} total sessions logged`}/>
      <Tile label="Total Fasting" val={totalFastH} unit="hrs"
        sub={data.fastLog.length?`Avg ${(totalFastH/data.fastLog.length).toFixed(1)}h per fast`:"Start fasting to see data"}
        color="#3498db"
        detail={`${data.fastLog.length} completed fasts`}/>
    </Sec>

    {(pf.goals?.length>0||pf.body_description)&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{fontSize:10,color:"#f5c542",fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px"}}>Your Focus</div>
      {pf.goals?.length>0&&<div className="cd" style={{padding:"14px 18px"}}><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{(pf.goals||[]).map((g:string,i:number)=><div key={i} style={{background:"#f5c54218",border:"1px solid #f5c54235",color:"#f5c542",padding:"5px 12px",borderRadius:20,fontSize:12,fontWeight:600}}>{g}</div>)}</div></div>}
      {pf.body_focus?.length>0&&<div className="cd" style={{padding:"14px 18px"}}><div style={{fontSize:11,color:"#8a8d97",marginBottom:6}}>Focus areas</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{(pf.body_focus||[]).map((f:string,i:number)=><span key={i} style={{background:"#2a2d37",color:"#a0a3ad",padding:"3px 10px",borderRadius:12,fontSize:12}}>{f}</span>)}</div></div>}
      {pf.body_description&&<div className="cd" style={{background:"linear-gradient(135deg,#1a1d27,#1e1f2a)",padding:"14px 18px"}}><div style={{fontSize:11,color:"#8a8d97",marginBottom:4}}>Body description</div><p style={{fontSize:13,color:"#a0a3ad",lineHeight:1.7,margin:0}}>{pf.body_description}</p></div>}
      {pf.goals_own_words&&<div className="cd" style={{background:"linear-gradient(135deg,#1a1d27,#1e1f2a)",padding:"14px 18px"}}><div style={{fontSize:11,color:"#8a8d97",marginBottom:4}}>My why</div><p style={{fontSize:13,color:"#a0a3ad",lineHeight:1.7,margin:0}}>{pf.goals_own_words}</p></div>}
    </div>}
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
function WorkoutTab({data,user,refresh,pf}:any) {
  const wk = WK(pf?.gender||'male')
  const defaultDay = Object.keys(wk)[0]
  const [day,setDay]=useState(defaultDay);const [done,setDone]=useState<Record<number,boolean>>({})
  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{Object.keys(wk).map(d=><button key={d} className={day===d?"bt":"bt bto"} style={{flex:1,fontSize:12,minWidth:100}} onClick={()=>{setDay(d);setDone({})}}>{d}</button>)}</div>
    <div className="cd"><h3 style={{fontSize:15,fontWeight:700,marginBottom:14}}>{day}</h3>{(wk[day]||[]).map((x,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:done[i]?"#f5c54210":"#12141c",borderRadius:8,marginBottom:6}}><div onClick={()=>setDone({...done,[i]:!done[i]})} style={{width:22,height:22,borderRadius:6,border:"2px solid "+(done[i]?"#f5c542":"#3a3d47"),background:done[i]?"#f5c542":"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{done[i]&&<span style={{color:"#0f1117",fontSize:14}}>✓</span>}</div><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>{x.ex}</div><div style={{fontSize:11,color:"#6a6d77"}}>{x.note}</div></div><span className="tg">{x.sets}</span></div>)}<button className="bt" style={{marginTop:12,width:"100%"}} onClick={async()=>{await db.addWorkout(user.id,today(),day,done);setDone({});refresh()}}>Log Workout</button></div>
    <div className="cd"><h3 style={{fontSize:15,fontWeight:700,marginBottom:12}}>History</h3>{data.workoutLog.length===0?<p style={{fontSize:13,color:"#6a6d77"}}>None yet.</p>:<div>{[...data.workoutLog].reverse().slice(0,10).map((w:any,i:number)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:13}}><span>{fmt(w.date)}</span><span className="tg">{w.day}</span></div>)}</div>}</div>
  </div>
}

// ─── SUPPLEMENTS ─────────────────────────────────────────
function SuppTab({data,user,refresh,pf}:any) {
  const suppList = pf?.gender==='female' ? SUPPS_FEMALE : SUPPS_MALE
  const tc=data.suppChecks[today()]||[]
  const toggle=async(i:number)=>{const c=tc.includes(i)?tc.filter((x:number)=>x!==i):[...tc,i];await db.setSuppChecks(user.id,today(),c);refresh()}
  const pct=Math.round((tc.length/suppList.length)*100)
  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div className="cd cdg" style={{textAlign:"center"}}><div style={{fontSize:42,fontWeight:900,color:pct===100?"#2ecc71":"#f5c542"}}>{pct}%</div><div style={{fontSize:11,color:"#6a6d77",marginTop:4}}>{pf?.gender==='female'?"Women's":"Men's"} supplement stack</div></div>
    <div className="cd">{suppList.map((s,i)=><div key={i} onClick={()=>toggle(i)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,cursor:"pointer"}}><div style={{width:22,height:22,borderRadius:6,border:"2px solid "+(tc.includes(i)?"#f5c542":"#3a3d47"),background:tc.includes(i)?"#f5c542":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{tc.includes(i)&&<span style={{color:"#0f1117",fontSize:14}}>✓</span>}</div><div><div style={{fontSize:14,fontWeight:600,opacity:tc.includes(i)?0.5:1}}>{s.name} — {s.dose}</div><div style={{fontSize:11,color:"#6a6d77"}}>{s.time} | {s.why}</div></div></div>)}</div>
  </div>
}

// ─── MEAL PLAN ───────────────────────────────────────────
function MealTab({pf}:any) {
  return <div className="cd"><h3 style={{fontSize:15,fontWeight:700,marginBottom:12}}>Personalized Meal Plan</h3><p style={{fontSize:13,color:"#a0a3ad"}}>Diet: {pf.diet_style} | Budget: ${pf.budget}/wk | Loves: {pf.foods_love||"not set"}</p><p style={{fontSize:12,color:"#6a6d77",marginTop:12}}>Ask the <strong style={{color:"#f5c542"}}>AI Coach</strong> tab for a fully personalized weekly meal plan, recipes, and shopping list tailored to your goals.</p></div>
}

// ─── SEXUAL HEALTH ───────────────────────────────────────
function SexTab({data,user,refresh,pf}:any) {
  const isFemale = pf?.gender === 'female'
  const [form,setForm]=useState({morningWood:"",morningEnergy:"",erectionQuality:3,libido:3,mood:3,hadSex:false,volume:"normal",stamina:"normal",pmsSymptoms:"",notes:""})
  const logEntry=async()=>{
    await db.addSexEntry(user.id,{...form,date:today(),morningWood:isFemale?form.morningEnergy:form.morningWood})
    setForm({morningWood:"",morningEnergy:"",erectionQuality:3,libido:3,mood:3,hadSex:false,volume:"normal",stamina:"normal",pmsSymptoms:"",notes:""})
    refresh()
  }
  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div className="cd"><h3 style={{fontSize:15,fontWeight:700,marginBottom:14}}>Log Today</h3>
      {isFemale ? <>
        <div style={{marginBottom:14}}><div className="lb">Morning Energy</div><div style={{display:"flex",gap:8,marginTop:6}}>{[{v:"great",l:"Great",c:"#2ecc71"},{v:"ok",l:"OK",c:"#f5c542"},{v:"low",l:"Low",c:"#e74c3c"}].map(o=><button key={o.v} onClick={()=>setForm({...form,morningEnergy:o.v})} style={{flex:1,padding:"10px",borderRadius:8,cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontSize:13,fontWeight:600,border:"2px solid "+(form.morningEnergy===o.v?o.c:"#2a2d37"),background:form.morningEnergy===o.v?o.c+"20":"#12141c",color:form.morningEnergy===o.v?o.c:"#6a6d77"}}>{o.l}</button>)}</div></div>
        <RatingPick label="Libido" value={form.libido} onChange={(v:number)=>setForm({...form,libido:v})} color="#e056a0" lo="None" hi="High"/>
        <RatingPick label="Mood" value={form.mood} onChange={(v:number)=>setForm({...form,mood:v})} color="#3498db" lo="Low" hi="Great"/>
        <div style={{marginBottom:14}}><div className="lb">Sexual Activity</div><div style={{display:"flex",gap:8}}><button onClick={()=>setForm({...form,hadSex:true})} className={form.hadSex?"bt":"bt bto"} style={{flex:1}}>Yes</button><button onClick={()=>setForm({...form,hadSex:false})} className={!form.hadSex?"bt":"bt bto"} style={{flex:1}}>No</button></div></div>
        <div style={{marginBottom:14}}><div className="lb">PMS / Cycle Symptoms (if any)</div><input className="inp" value={form.pmsSymptoms} onChange={e=>setForm({...form,pmsSymptoms:e.target.value})} placeholder="Cramps, bloating, mood shifts, spotting..." /></div>
        <div style={{marginBottom:14}}><div className="lb">Notes</div><input className="inp" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Anything worth tracking..." /></div>
      </> : <>
        <div style={{marginBottom:14}}><div className="lb">Morning Wood</div><div style={{display:"flex",gap:8,marginTop:6}}>{[{v:"yes",l:"Yes",c:"#2ecc71"},{v:"partial",l:"Partial",c:"#f5c542"},{v:"no",l:"None",c:"#e74c3c"}].map(o=><button key={o.v} onClick={()=>setForm({...form,morningWood:o.v})} style={{flex:1,padding:"10px",borderRadius:8,cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontSize:13,fontWeight:600,border:"2px solid "+(form.morningWood===o.v?o.c:"#2a2d37"),background:form.morningWood===o.v?o.c+"20":"#12141c",color:form.morningWood===o.v?o.c:"#6a6d77"}}>{o.l}</button>)}</div></div>
        <RatingPick label="Libido" value={form.libido} onChange={(v:number)=>setForm({...form,libido:v})} color="#3498db" lo="Dead" hi="On fire"/>
        <div style={{marginBottom:14}}><div className="lb">Activity</div><div style={{display:"flex",gap:8}}><button onClick={()=>setForm({...form,hadSex:true})} className={form.hadSex?"bt":"bt bto"} style={{flex:1}}>Yes</button><button onClick={()=>setForm({...form,hadSex:false})} className={!form.hadSex?"bt":"bt bto"} style={{flex:1}}>No</button></div></div>
        {form.hadSex&&<RatingPick label="Erection Quality" value={form.erectionQuality} onChange={(v:number)=>setForm({...form,erectionQuality:v})} color="#e056a0" lo="Weak" hi="Rock solid"/>}
      </>}
      <button className="bt" style={{width:"100%"}} onClick={logEntry}>Log Entry</button>
    </div>
    <div className="cd"><h3 style={{fontSize:15,fontWeight:700,marginBottom:12}}>Recent</h3>{data.sexLog.length===0?<p style={{fontSize:13,color:"#6a6d77"}}>No entries.</p>:<div>{[...data.sexLog].reverse().slice(0,10).map((e:any,i:number)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:12}}><span>{fmt(e.date)}</span><span>{isFemale?`Energy:${e.morningWood} L:${e.libido}/5 Mood:${e.mood||"?"}/5`:`AM:${e.morningWood==="yes"?"Y":"N"} L:${e.libido}/5${e.hadSex?" E:"+e.erectionQuality+"/5":""}`}</span></div>)}</div>}</div>
  </div>
}

// ─── LABS & DOCS ─────────────────────────────────────────
function LabsTab({user,pf,medDocs,refreshDocs}:any) {
  const [view,setView]=useState<'list'|'add'|'detail'>('list')
  const [docType,setDocType]=useState('bloodwork')
  const [pasteText,setPasteText]=useState('')
  const [docName,setDocName]=useState('')
  const [parsing,setParsing]=useState(false)
  const [status,setStatus]=useState('')
  const [selected,setSelected]=useState<any>(null)
  const fileRef=useRef<HTMLInputElement>(null)
  const DOC_TYPES=['bloodwork','hormone panel','doctor report','imaging','other']

  const parseAndSave=async(textIn:string,name:string,extraVals:any={})=>{
    setParsing(true);setStatus('AI is analyzing your document...')
    try{
      const res=await fetch('/api/parse-labs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:textIn,docType,gender:pf.gender,...extraVals})})
      const result=await res.json()
      const doc=await db.addMedicalDoc(user.id,{file_name:name||`${docType} — ${new Date().toLocaleDateString()}`,doc_type:docType,raw_text:textIn||result.extractedText||'',parsed_values:result.parsed||[],notes:result.summary||''})
      if(doc){refreshDocs();setPasteText('');setDocName('');setStatus('✓ Saved!');setTimeout(()=>{setView('list');setStatus('')},1200)}
      else setStatus('Error saving. Check your Supabase setup.')
    }catch{setStatus('Error parsing. Try again.')}
    finally{setParsing(false)}
  }

  const handleFile=(e:any)=>{
    const file=e.target.files[0];if(!file)return
    if(file.type.startsWith('image/')){
      setStatus('Reading image...')
      const reader=new FileReader()
      reader.onload=async(ev)=>{
        const b64=ev.target?.result as string
        await parseAndSave('',file.name,{image:b64})
      }
      reader.readAsDataURL(file)
    } else if(file.type==='text/plain'){
      const reader=new FileReader()
      reader.onload=(ev)=>{setPasteText(ev.target?.result as string);setDocName(file.name);setStatus('')}
      reader.readAsText(file)
    } else {
      setStatus('Upload JPG/PNG image or .txt file. For PDFs, copy text and paste below.')
    }
    e.target.value=''
  }

  const statusColor=( s:string)=>s==='normal'?'#2ecc71':s==='high'||s==='low'?'#f5c542':s==='critical'?'#e74c3c':'#8a8d97'

  const renderParsed=(parsed:any)=>{
    const items=Array.isArray(parsed)?parsed:[]
    if(!items.length)return<p style={{fontSize:13,color:"#6a6d77"}}>No structured values extracted. View original text below.</p>
    const normal=items.filter((v:any)=>v.status==='normal')
    const flagged=items.filter((v:any)=>v.status&&v.status!=='normal')
    const Row=({item}:any)=>(
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",background:"#12141c",borderRadius:8,gap:12}}>
        <div><div style={{fontSize:13,fontWeight:600}}>{item.name}</div>{item.reference_range&&<div style={{fontSize:11,color:"#4a4d57"}}>Ref: {item.reference_range}</div>}</div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontSize:14,fontWeight:800,color:statusColor(item.status||'')}}>{item.value}{item.unit?' '+item.unit:''}</div>
          {item.status&&<div style={{fontSize:9,color:statusColor(item.status),textTransform:"uppercase",fontWeight:700,letterSpacing:"0.5px"}}>{item.status}</div>}
        </div>
      </div>
    )
    return<div style={{display:"flex",flexDirection:"column",gap:6}}>
      {flagged.length>0&&<><div style={{fontSize:10,color:"#f5c542",fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",marginBottom:2}}>Flagged ({flagged.length})</div>{flagged.map((v:any,i:number)=><Row key={i} item={v}/>)}</>}
      {normal.length>0&&<><div style={{fontSize:10,color:"#2ecc71",fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",marginTop:4,marginBottom:2}}>Normal ({normal.length})</div>{normal.map((v:any,i:number)=><Row key={i} item={v}/>)}</>}
    </div>
  }

  if(view==='detail'&&selected)return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <button className="bt bto bts" onClick={()=>setView('list')}>← Back</button>
        <div><div style={{fontSize:16,fontWeight:700}}>{selected.file_name}</div><div style={{fontSize:11,color:"#6a6d77"}}>{new Date(selected.created_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})} · {selected.doc_type}</div></div>
        <button className="bt bts" style={{marginLeft:"auto",borderColor:"#e74c3c",color:"#e74c3c",background:"transparent",border:"1px solid #e74c3c"}} onClick={async()=>{await db.deleteMedicalDoc(selected.id);refreshDocs();setView('list')}}>Delete</button>
      </div>
      {selected.notes&&<div className="cd" style={{background:"linear-gradient(135deg,#141720,#1a1d27)"}}><div style={{fontSize:10,color:"#f5c542",fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",marginBottom:8}}>AI Analysis</div><p style={{fontSize:13,color:"#a0a3ad",lineHeight:1.7,margin:0}}>{selected.notes}</p></div>}
      <div className="cd"><div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Extracted Biomarkers</div>{renderParsed(selected.parsed_values)}</div>
      {selected.raw_text&&<div className="cd"><div style={{fontSize:12,fontWeight:700,marginBottom:8,color:"#6a6d77"}}>Original Text</div><pre style={{fontSize:11,color:"#6a6d77",whiteSpace:"pre-wrap",lineHeight:1.6,maxHeight:200,overflow:"auto",margin:0}}>{selected.raw_text}</pre></div>}
    </div>
  )

  return<div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
      <div><h2 style={{fontSize:18,fontWeight:800,margin:0}}>Labs & Medical Docs</h2><p style={{fontSize:12,color:"#6a6d77",marginTop:4,marginBottom:0}}>Upload bloodwork or reports · AI extracts biomarkers · Personalizes your plan</p></div>
      <button className="bt bts" onClick={()=>setView(view==='add'?'list':'add')}>{view==='add'?'Cancel':'+ Add Document'}</button>
    </div>

    {view==='add'&&<div className="cd" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div><div className="lb">Document Type</div><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>{DOC_TYPES.map(t=><button key={t} onClick={()=>setDocType(t)} style={{padding:"6px 14px",borderRadius:20,border:"1px solid "+(docType===t?"#f5c542":"#2a2d37"),background:docType===t?"#f5c54220":"#12141c",color:docType===t?"#f5c542":"#6a6d77",fontSize:12,cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontWeight:600,transition:"all .15s"}}>{t}</button>)}</div></div>
      <div><div className="lb">Document Name</div><input className="inp" value={docName} onChange={e=>setDocName(e.target.value)} placeholder={`e.g. "Annual Labs — April 2026"`}/></div>
      <div style={{border:"2px dashed #2a2d37",borderRadius:10,padding:24,textAlign:"center",cursor:"pointer",transition:"border-color .2s"}} onClick={()=>fileRef.current?.click()} onMouseOver={e=>(e.currentTarget.style.borderColor='#f5c542')} onMouseOut={e=>(e.currentTarget.style.borderColor='#2a2d37')}>
        <input ref={fileRef} type="file" accept="image/*,.txt" style={{display:"none"}} onChange={handleFile}/>
        <div style={{fontSize:32,marginBottom:8}}>📄</div>
        <div style={{fontSize:14,fontWeight:600}}>Upload Image or Text File</div>
        <div style={{fontSize:11,color:"#6a6d77",marginTop:4}}>JPG / PNG photo of your report · AI reads it with vision</div>
        <div style={{fontSize:11,color:"#4a4d57",marginTop:2}}>For PDFs: open in Adobe/Preview → Select All → Copy → Paste below</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{flex:1,height:1,background:"#2a2d37"}}/><span style={{fontSize:10,color:"#4a4d57",fontWeight:700,letterSpacing:"1px"}}>OR PASTE TEXT</span><div style={{flex:1,height:1,background:"#2a2d37"}}/></div>
      <div>
        <div className="lb">Paste Report Text</div>
        <textarea className="inp" style={{minHeight:160,resize:"vertical",marginTop:6,fontFamily:"monospace",fontSize:11,lineHeight:1.6}} value={pasteText} onChange={e=>setPasteText(e.target.value)} placeholder={"Paste your bloodwork or report text here...\n\nExample:\nGlucose: 94 mg/dL  (65-99)  ✓\nHbA1c: 5.4%  (<5.7)  ✓\nTotal Cholesterol: 182 mg/dL  (<200)  ✓\nLDL: 112 mg/dL  (<130)  ✓\nHDL: 52 mg/dL  (>40)  ✓\nTriglycerides: 88 mg/dL  (<150)  ✓\nTestosterone: 520 ng/dL  (264-916)  ✓\nVitamin D: 28 ng/mL  (30-100)  LOW"}/>
      </div>
      {status&&<div style={{padding:"10px 14px",borderRadius:8,background:status.includes('Error')?'#e74c3c20':status.includes('✓')?'#2ecc7120':'#f5c54220',color:status.includes('Error')?'#e74c3c':status.includes('✓')?'#2ecc71':'#f5c542',fontSize:13}}>{status}</div>}
      <button className="bt" style={{width:"100%"}} onClick={()=>parseAndSave(pasteText,docName)} disabled={!pasteText.trim()||parsing}>{parsing?'AI is analyzing...':'🧬 Analyze & Save'}</button>
    </div>}

    {medDocs.length===0&&view!=='add'&&<div className="cd" style={{textAlign:"center",padding:48}}>
      <div style={{fontSize:40,marginBottom:12}}>🧬</div>
      <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>No Documents Yet</div>
      <p style={{fontSize:13,color:"#6a6d77",lineHeight:1.6,marginBottom:20}}>Upload bloodwork or doctor reports. AI extracts all biomarkers, flags abnormal values, and uses the data to fine-tune your supplement, diet, and training plan.</p>
      <button className="bt" onClick={()=>setView('add')}>+ Add Your First Document</button>
    </div>}

    {medDocs.length>0&&view!=='add'&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{fontSize:10,color:"#f5c542",fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px"}}>{medDocs.length} document{medDocs.length!==1?'s':''} on file</div>
      {medDocs.map((doc:any,i:number)=>{
        const items=Array.isArray(doc.parsed_values)?doc.parsed_values:[]
        const flagged=items.filter((v:any)=>v.status&&v.status!=='normal').length
        return<div key={i} className="cd" style={{cursor:"pointer",padding:"14px 18px"}} onClick={()=>{setSelected(doc);setView('detail')}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700}}>{doc.file_name}</div>
              <div style={{fontSize:11,color:"#6a6d77",marginTop:2}}>{new Date(doc.created_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})} · {doc.doc_type}</div>
              {doc.notes&&<div style={{fontSize:12,color:"#a0a3ad",marginTop:6,lineHeight:1.5}}>{doc.notes.substring(0,140)}{doc.notes.length>140?'…':''}</div>}
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              {items.length>0&&<div style={{fontSize:11,color:"#6a6d77"}}>{items.length} values</div>}
              {flagged>0&&<div style={{marginTop:4,background:"#f5c54220",color:"#f5c542",padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:700}}>{flagged} flagged</div>}
              {flagged===0&&items.length>0&&<div style={{marginTop:4,background:"#2ecc7120",color:"#2ecc71",padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:700}}>All normal</div>}
            </div>
          </div>
        </div>
      })}
    </div>}
  </div>
}

// ─── AI COACH ────────────────────────────────────────────
function CoachTab({pf, userId, medDocs}:any) {
  const KEY = `kt_coach_${userId||'default'}`
  const [msgs,setMsgs]=useState<any[]>(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return []}})
  const [input,setInput]=useState("");const [busy,setBusy]=useState(false);const ref=useRef<HTMLDivElement>(null)
  const labContext=(medDocs||[]).slice(0,3).map((d:any)=>`[${d.doc_type} — ${new Date(d.created_at).toLocaleDateString()}]: ${d.notes||''}${Array.isArray(d.parsed_values)&&d.parsed_values.length?` Key values: ${d.parsed_values.filter((v:any)=>v.status!=='normal').slice(0,8).map((v:any)=>`${v.name} ${v.value}${v.unit?' '+v.unit:''} (${v.status})`).join(', ')}`:''}`.trim()).filter(Boolean).join('\n')
  const SYS="You are KEY COACH, an elite health transformation advisor for "+pf.name+". Gender: "+(pf.gender||"not specified")+". Age "+(pf.age||"?")+", "+(pf.height_ft||"?")+"ft"+(pf.height_in||"?")+"in, "+(pf.weight||"?")+"lbs (goal "+(pf.goal_weight||"?")+"). BP "+(pf.bp_sys||"?")+"/"+(pf.bp_dia||"?")+". Blood sugar: "+pf.blood_sugar+". Diet: "+pf.diet_style+". Fasting: "+pf.fasting_plan+". Injuries: "+(pf.injuries||"none")+". Allergies: "+(pf.allergies||"none")+". Goals: "+(pf.goals||[]).join(", ")+". "+(pf.body_type?"Body type: "+pf.body_type+". ":"")+(pf.body_focus?.length?"Focus areas: "+(pf.body_focus||[]).join(", ")+". ":"")+(pf.body_description?"Body description: "+pf.body_description+". ":"")+(pf.gender==='female'?"Female health — PCOS: "+(pf.pcos?"yes":"no")+", Menopause: "+(pf.menopause_stage||"none")+(pf.hormone_concerns?", Hormone concerns: "+pf.hormone_concerns:"")+". ":"")+(pf.goals_own_words?"MOTIVATION: "+pf.goals_own_words+". ":"")+(pf.specific_concerns?"CONCERNS: "+pf.specific_concerns+". ":"")+(pf.additional_info?"CONTEXT: "+pf.additional_info+". ":"")+(labContext?"MEDICAL LAB RESULTS:\n"+labContext+"\n":"")+"YOUR EXPERTISE: health/fitness, fasting, keto/carnivore/mediterranean nutrition, bodybuilding, female hormonal health, natural medicine, supplements, lab result interpretation, red light therapy, biology, culinary arts, and The Bible. Style: direct, no-BS, specific numbers, reference lab values when relevant, scripture when natural, actionable. Tailor all advice to the user's gender and lab results. IMPORTANT: Chat history is automatically saved on the user's device. When asked to save or remember this conversation, confirm it is already saved automatically."

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
