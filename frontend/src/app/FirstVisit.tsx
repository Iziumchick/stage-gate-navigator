import { useEffect, useRef, useState, type FormEvent } from 'react';
import { request, type AuthUser } from './api';
import { StudyStartField, validStudyStart } from './StudyStartField';
import { currentSemester } from './semesterClock';
import { LeistungenHelp } from './LeistungenHelp';
import {PrivacyDialog,ResearchFooter} from './Privacy';
import {EmailVerification,type EmailChallenge} from './EmailVerification';
import { ArrowRight, Check, GraduationCap, Upload, X } from 'lucide-react';

export interface StudyProfile {
  name: string;
  program: string;
  startTerm: string;
  referenceTerm: string;
  fachsemester?: number;
}

export function LoginPage({ onContinue }: { onContinue: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<'register' | 'login'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted,setAccepted]=useState(false),[privacyOpen,setPrivacyOpen]=useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [challenge,setChallenge]=useState<EmailChallenge|null>(null);
  const [institutional,setInstitutional]=useState(false);
  useEffect(()=>{const controller=new AbortController();request<{institutional_email_required:boolean}>('/auth/options',{signal:controller.signal}).then(value=>setInstitutional(value.institutional_email_required)).catch(()=>{});return()=>controller.abort();},[]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await request<AuthUser|EmailChallenge>(`/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, ...(mode === 'register' ? { name,privacy_accepted:accepted } : {}) }) });
      if('verification_required' in result){setChallenge(result);setPassword('');}
      else onContinue(result);
    } catch (error) { setError(error instanceof Error ? error.message : 'Anmeldung fehlgeschlagen'); }
    finally { setBusy(false); }
  }
  return <div className="min-h-screen min-w-[1280px] bg-gray-50">
    <header className="px-12 py-7 border-b bg-white"><Brand /></header>
    <main className="max-w-[1360px] mx-auto grid grid-cols-2 gap-24 px-12 py-20 items-center">
      <section><span className="inline-flex items-center gap-2 text-blue-700 bg-blue-50 rounded-full px-3 py-1.5 text-sm"><GraduationCap size={17} />Dein Studium im Überblick</span><h1 className="text-5xl leading-tight mt-6 mb-5 font-medium">Ein klarer Blick auf<br />deinen nächsten Schritt.</h1><p className="text-gray-500 text-lg max-w-lg leading-relaxed">Deine Leistungen, offene Module und Studienplanung an einem Ort. Starte mit deinem Studiengang und deinen Leistungen aus HISinOne.</p></section>
      <section className="bg-white rounded-2xl border border-gray-200 p-9 shadow-sm max-w-[460px] w-full">{challenge?<EmailVerification key={challenge.ticket} initial={challenge} onContinue={onContinue} onBack={()=>{setChallenge(null);setMode('login');setError('');setPassword('');}}/>:<><div className="grid grid-cols-2 bg-gray-100 rounded-lg p-1 mb-8">{(['login', 'register'] as const).map(tab => <button key={tab} disabled={busy} onClick={() => { setMode(tab); setError(''); }} className={`py-2 rounded-md text-sm ${mode === tab ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>{tab === 'register' ? 'Registrieren' : 'Anmelden'}</button>)}</div><h2 className="text-2xl">{mode === 'register' ? 'Dein Studienkonto erstellen' : 'Willkommen zurück'}</h2><p className="text-sm text-gray-500 mt-2 mb-6">{mode === 'register' ? 'Danach fügst du direkt dein Studium hinzu.' : 'Melde dich mit deiner E-Mail-Adresse und deinem Passwort an.'}</p>
        {institutional&&<p className="rounded-lg bg-blue-50 p-3 mb-5 text-sm text-blue-950">Zugang mit @st.oth-regensburg.de oder @oth-regensburg.de. Bei der ersten Anmeldung bestätigen wir deine Adresse per E-Mail. Bitte ein eigenes Passwort für Study Navigator verwenden.</p>}
        <form onSubmit={event => void submit(event)} className="space-y-4"><fieldset disabled={busy} className="space-y-4">
          {mode === 'register' && <label className="block text-sm">Anzeigename (Pseudonym möglich)<input className="form-input mt-2" required maxLength={100} value={name} onChange={event => setName(event.target.value)} autoComplete="name" /></label>}
          <label className="block text-sm">E-Mail-Adresse<input className="form-input mt-2" type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" /></label>
          <label className="block text-sm">Passwort<input className="form-input mt-2" type="password" required minLength={mode === 'register' ? 12 : 1} maxLength={200} value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /></label>
          {mode === 'register' && <p className="text-xs text-gray-500">Mindestens 12 Zeichen.</p>}
          {mode==='register'&&<div className="text-sm"><button type="button" className="text-blue-700 underline" onClick={()=>setPrivacyOpen(true)}>Datenschutzinformation lesen</button><label className="flex gap-2 mt-3"><input type="checkbox" required checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>Ich willige freiwillig in die beschriebene Verarbeitung meiner Daten für den Test im Rahmen der Bachelorarbeit ein.</label></div>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="submit" className="w-full primary-button justify-center">{busy ? 'Bitte warten …' : mode === 'register' ? 'Konto erstellen' : 'Einloggen'}<ArrowRight size={17} /></button>
        </fieldset></form><div className="mt-6 border-t border-gray-100 pt-5 text-center"><a href="?demo=first" className="action-button w-full justify-center">Demo ohne Anmeldung ansehen<ArrowRight size={16}/></a><p className="text-xs text-gray-500 mt-2">Mit vorbereiteten Beispielen ausprobieren.</p></div></>}
      </section>
    </main><ResearchFooter/>{privacyOpen&&<PrivacyDialog onClose={()=>setPrivacyOpen(false)}/>}
  </div>;
}
export function Brand() {
  return <div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center"><GraduationCap size={24} className="text-white" /></div><span className="font-medium">Study Navigator <span className="text-gray-400 font-normal">/ Forschungsprototyp</span></span></div>;
}
export function WelcomeDashboard({ name, profile, uploading, onUpload, onSave, onManual }: { name: string; profile: StudyProfile | null; uploading: boolean; onUpload: (file: File, profile: StudyProfile) => void; onSave: (profile: StudyProfile, showCatalog?: boolean) => void; onManual: () => void }) {
  const [program, setProgram] = useState(profile?.program || '');
  const [start, setStart] = useState(profile?.startTerm || '');
  const [file, setFile] = useState<File | null>(null);
  const term = currentSemester();
  useEffect(() => { if (profile) { setProgram(profile.program); setStart(profile.startTerm); } }, [profile]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validStudyStart(start)) return;
    const value = { name, program, referenceTerm:term, startTerm:start };
    onSave(value, !file);
    if (file) onUpload(file, value);
  }
  return <main className="max-w-[1640px] mx-auto px-10 py-10">
    <div className="mb-8"><p className="text-sm text-gray-500 mb-2">DEINE STUDIENÜBERSICHT</p><h1 className="text-3xl">Hallo {name}, {profile ? 'dein Studienprofil ist bereit.' : 'hier beginnt dein Überblick.'}</h1><p className="text-gray-500 mt-3">Dein Studiengang und eine PDF aus HISinOne — daraus entsteht dein persönlicher Überblick.</p></div>
    <section className="bg-white rounded-xl border border-gray-200 p-8 mb-7">
      <h2 className="text-2xl mb-2">Füge dein Studium hinzu</h2><p className="text-gray-500 mb-7">Wähle deinen Studiengang und Studienbeginn. Das aktuelle Semester wird automatisch ermittelt.</p>
      <form onSubmit={submit} className="grid grid-cols-[1fr_1.15fr] gap-12 items-start">
        <div className="space-y-5"><label className="block text-sm">Studiengang<select aria-label="Studiengang" className="form-input mt-2" required value={program} onChange={e => setProgram(e.target.value)}><option value="">Bitte auswählen</option><option>Wirtschaftsinformatik (B.Sc.)</option></select></label>
          <StudyStartField value={start} onChange={setStart} />
          <div className="rounded-lg bg-gray-50 p-4 text-sm space-y-3"><p>Abschluss <span className="font-medium block mt-1">Bachelor of Science</span></p><p>Aktuelles Semester <span data-testid="current-semester" className="font-medium block mt-1">{term}</span></p></div>
          <p className="text-sm text-gray-500">Dein Name stammt aus deinem Konto. Fachsemester und Lehrplansemester musst du für diesen Überblick nicht angeben.</p>
        </div>
        <div className="space-y-4"><label className="block rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 px-7 py-6 text-center cursor-pointer"><Upload size={26} className="mx-auto text-blue-600 mb-3" /><span className="block text-lg font-medium">Leistungen aus HISinOne hochladen</span><span className="block text-sm text-gray-500 mt-2 mb-4">Eine PDF · bis zu 10 MB · Ergebnisse und Prüfungsversuche</span><input aria-label="Leistungen PDF" type="file" accept="application/pdf,.pdf" className="block w-full text-sm" onChange={e => setFile(e.target.files?.[0] || null)} disabled={uploading} />{file && <span className="block text-sm text-blue-700 mt-3">{file.name}</span>}</label>
          <LeistungenHelp open />
          <button type="submit" className="primary-button w-full justify-center" disabled={uploading}>{uploading ? 'PDF wird geprüft …' : file ? 'Mein Dashboard anzeigen' : 'Studienplan ohne PDF öffnen'}<ArrowRight size={17} /></button>
          {profile && <button type="button" className="text-sm text-blue-700" onClick={onManual}>Studienangaben bearbeiten</button>}
        </div>
      </form>
    </section>
    <div className="grid grid-cols-3 gap-6">{['Mein Status', 'Aktuelles Semester', 'Dein Studienplan'].map(title => <section key={title} className="bg-white rounded-xl border p-6"><h2 className="text-lg mb-5">{title}</h2><p className="text-gray-400 text-xl mb-3">{title === 'Mein Status' ? '— / 210 ECTS' : title === 'Aktuelles Semester' ? term : 'Deine SPO und ihre Module'}</p><p className="text-sm text-gray-500">{profile ? profile.program : 'Wähle deine Studienangaben, um zu starten.'}</p></section>)}</div>
  </main>;
}
export function ProfileDialog({ open, name, profile, suggestedProgram, onClose, onSave }: { open: boolean; name: string; profile: StudyProfile | null; suggestedProgram: string | null; onClose: () => void; onSave: (profile: StudyProfile) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [start, setStart] = useState('');
  const [program, setProgram] = useState('');
  useEffect(() => {
    if (open) { setStart(profile?.startTerm || ''); setProgram(profile?.program || (suggestedProgram?.toLowerCase().includes('wirtschaftsinformatik') ? 'Wirtschaftsinformatik (B.Sc.)' : '')); dialog.current?.showModal(); }
    else dialog.current?.close();
  }, [open, profile, suggestedProgram]);
  function save(event: FormEvent) { event.preventDefault(); if (!validStudyStart(start)) return; onSave({ name, program, startTerm:start, referenceTerm:currentSemester() }); }
  return <dialog ref={dialog} onCancel={onClose} onClose={onClose} className="m-auto w-[560px] max-h-[85vh] overflow-auto rounded-2xl p-8 shadow-xl backdrop:bg-slate-900/30" aria-labelledby="profile-title"><div className="flex justify-between items-start gap-4"><div><h2 id="profile-title" className="text-2xl">{profile ? 'Studienangaben bearbeiten' : 'Deine Studienangaben'}</h2><p className="text-sm text-gray-500 mt-2">Beim nächsten Upload wiederverwenden.</p></div><button className="action-button" aria-label="Studienangaben schließen" onClick={onClose}><X size={18} /></button></div><form onSubmit={save} className="mt-6 space-y-4"><div className="rounded-lg bg-gray-50 p-4 text-sm">OTH Regensburg · Bachelor of Science<br/>Aktuelles Semester: {currentSemester()}</div><label className="block text-sm">Studiengang<select aria-label="Studiengang" className="form-input mt-2" required value={program} onChange={e => setProgram(e.target.value)}><option value="">Bitte auswählen</option><option>Wirtschaftsinformatik (B.Sc.)</option></select></label><StudyStartField value={start} onChange={setStart} /><p className="text-xs text-gray-500">Der Studienbeginn bestimmt deine SPO. Bei einem PO-Wechsel muss die Zuordnung gesondert geprüft werden.</p><div className="flex justify-end gap-3 pt-4"><button type="button" className="action-button" onClick={onClose}>Abbrechen</button><button type="submit" className="primary-button">Angaben speichern<Check size={17} /></button></div></form></dialog>;
}
