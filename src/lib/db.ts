import { supabase } from './supabase'

// ─── AUTH ────────────────────────────────────────────────
export async function signUp(email: string, password: string, name: string) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { name, profile_completed: false } }
  })
  if (error) return { user: null, error: error.message }
  // Also try to create profiles table row (for foreign keys), but this is non-critical
  if (data.user) {
    supabase.from('profiles').upsert({ id: data.user.id, name, profile_completed: false }, { onConflict: 'id' })
      .then(({ error: e }) => { if (e) console.warn('profiles table row (non-critical):', e.message) })
  }
  return { user: data.user, error: null }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { user: null, error: error.message }
  return { user: data.user, error: null }
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ─── PROFILE ─────────────────────────────────────────────
// Primary storage: Supabase auth user_metadata — no RLS required, always works
// Secondary: profiles table (used for foreign keys by other tables)
export async function getProfile(userId: string) {
  // Check both sources in parallel — use whichever says profile_completed: true
  const [tableResult, authResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.auth.getUser()
  ])
  const tableData = tableResult.data
  const metaData = authResult.data?.user?.user_metadata

  // Prefer whichever source has profile_completed: true to avoid false redirect to wizard
  if (tableData?.profile_completed) return tableData
  if (metaData?.profile_completed) return { id: userId, ...metaData }
  // Neither says completed — return whichever exists (new/incomplete user)
  if (tableData) return tableData
  if (metaData && Object.keys(metaData).length > 0) return { id: userId, ...metaData }
  return null
}

export async function updateProfile(userId: string, updates: any) {
  // Save to both stores in parallel so getProfile always finds profile_completed: true
  const [authResult, tableResult] = await Promise.all([
    supabase.auth.updateUser({ data: updates }),
    supabase.from('profiles').upsert({ id: userId, ...updates }, { onConflict: 'id' })
  ])
  if (authResult.error) console.error('updateProfile (metadata):', authResult.error.message)
  if (tableResult.error) console.warn('updateProfile (table):', tableResult.error.message)
  return !authResult.error || !tableResult.error
}

// ─── WEIGHT ──────────────────────────────────────────────
export async function getWeights(userId: string) {
  const { data } = await supabase.from('weight_log').select('*').eq('user_id', userId).order('date', { ascending: true })
  return (data || []).map((w: any) => ({ date: w.date, value: Number(w.value) }))
}
export async function addWeight(userId: string, date: string, value: number) {
  await supabase.from('weight_log').insert({ user_id: userId, date, value })
}

// ─── WAIST ───────────────────────────────────────────────
export async function getWaist(userId: string) {
  const { data } = await supabase.from('waist_log').select('*').eq('user_id', userId).order('date', { ascending: true })
  return (data || []).map((w: any) => ({ date: w.date, value: Number(w.value) }))
}
export async function addWaist(userId: string, date: string, value: number) {
  await supabase.from('waist_log').insert({ user_id: userId, date, value })
}

// ─── BLOOD PRESSURE ──────────────────────────────────────
export async function getBP(userId: string) {
  const { data } = await supabase.from('bp_log').select('*').eq('user_id', userId).order('date', { ascending: true })
  return (data || []).map((b: any) => ({ date: b.date, sys: b.systolic, dia: b.diastolic }))
}
export async function addBP(userId: string, date: string, sys: number, dia: number) {
  await supabase.from('bp_log').insert({ user_id: userId, date, systolic: sys, diastolic: dia })
}

// ─── FASTING ─────────────────────────────────────────────
export async function getFastLog(userId: string) {
  const { data } = await supabase.from('fast_log').select('*').eq('user_id', userId).order('created_at', { ascending: true })
  return (data || []).map((f: any) => ({ start: f.start_time, end: f.end_time, hours: Number(f.hours) }))
}
export async function addFast(userId: string, start: string, end: string, hours: number) {
  await supabase.from('fast_log').insert({ user_id: userId, start_time: start, end_time: end, hours })
}
export async function getCurrentFast(userId: string) {
  const { data } = await supabase.from('current_fast').select('*').eq('user_id', userId).single()
  return data ? new Date(data.started_at).getTime() : null
}
export async function startCurrentFast(userId: string) {
  await supabase.from('current_fast').upsert({ user_id: userId, started_at: new Date().toISOString() })
}
export async function endCurrentFast(userId: string) {
  await supabase.from('current_fast').delete().eq('user_id', userId)
}

// ─── FOOD LOG ────────────────────────────────────────────
export async function getFoodLog(userId: string) {
  const { data } = await supabase.from('food_log').select('*').eq('user_id', userId).order('created_at', { ascending: true })
  return (data || []).map((f: any) => ({ date: f.date, food: f.food, protein: Number(f.protein), fat: Number(f.fat), carbs: Number(f.carbs), cal: Number(f.calories) }))
}
export async function addFood(userId: string, date: string, food: string, protein: number, fat: number, carbs: number, cal: number) {
  await supabase.from('food_log').insert({ user_id: userId, date, food, protein, fat, carbs, calories: cal })
}

// ─── WORKOUTS ────────────────────────────────────────────
export async function getWorkoutLog(userId: string) {
  const { data } = await supabase.from('workout_log').select('*').eq('user_id', userId).order('date', { ascending: true })
  return (data || []).map((w: any) => ({ date: w.date, day: w.day_type, exercises: w.exercises }))
}
export async function addWorkout(userId: string, date: string, day: string, exercises: any) {
  await supabase.from('workout_log').insert({ user_id: userId, date, day_type: day, exercises })
}

// ─── SUPPLEMENTS ─────────────────────────────────────────
export async function getSuppChecks(userId: string) {
  const { data } = await supabase.from('supplement_checks').select('*').eq('user_id', userId)
  const checks: Record<string, number[]> = {}
  ;(data || []).forEach((s: any) => { checks[s.date] = s.checked_indexes || [] })
  return checks
}
export async function setSuppChecks(userId: string, date: string, indexes: number[]) {
  await supabase.from('supplement_checks').upsert({ user_id: userId, date, checked_indexes: indexes }, { onConflict: 'user_id,date' })
}

// ─── SEXUAL HEALTH ───────────────────────────────────────
export async function getSexLog(userId: string) {
  const { data } = await supabase.from('sex_log').select('*').eq('user_id', userId).order('date', { ascending: true })
  return (data || []).map((e: any) => ({
    date: e.date, morningWood: e.morning_wood, erectionQuality: e.erection_quality,
    libido: e.libido, hadSex: e.had_sex, volume: e.volume, stamina: e.stamina, notes: e.notes
  }))
}
export async function addSexEntry(userId: string, entry: any) {
  await supabase.from('sex_log').insert({
    user_id: userId, date: entry.date, morning_wood: entry.morningWood,
    erection_quality: entry.erectionQuality, libido: entry.libido,
    had_sex: entry.hadSex, volume: entry.volume, stamina: entry.stamina, notes: entry.notes
  })
}

// ─── CYCLE TRACKING ──────────────────────────────────────
export async function getCycleStart(userId: string) {
  const { data } = await supabase.from('cycle_tracking').select('*').eq('user_id', userId).single()
  return data?.cycle_start || null
}
export async function setCycleStart(userId: string, date: string) {
  await supabase.from('cycle_tracking').upsert({ user_id: userId, cycle_start: date })
}

// ─── LOAD ALL DATA ───────────────────────────────────────
export async function loadAllData(userId: string) {
  const [weights, waist, bp, fastLog, foodLog, workoutLog, suppChecks, sexLog, currentFast, cycleStart] = await Promise.all([
    getWeights(userId), getWaist(userId), getBP(userId), getFastLog(userId),
    getFoodLog(userId), getWorkoutLog(userId), getSuppChecks(userId), getSexLog(userId),
    getCurrentFast(userId), getCycleStart(userId),
  ])
  return { weights, waist, bp, fastLog, foodLog, workoutLog, suppChecks, sexLog, currentFast, cycleStart }
}
