import { useEffect, useRef, useState } from 'react';
import { GraduationCap, Upload, RefreshCw, Calendar, CircleHelp, Info, Settings, Shield, LogOut } from 'lucide-react';
import { LoginPage, ProfileDialog, WelcomeDashboard, type StudyProfile } from './FirstVisit';
import { validStudyStart } from './StudyStartField';
import { currentSemester } from './semesterClock';
import { InfoPopover } from './InfoPopover';
import { LeistungenInstructions } from './LeistungenHelp';
import { CatalogEditor } from './CatalogEditor';
import {AccountDataDialog,ConsentBanner,ResearchFooter,PRIVACY_VERSION} from './Privacy';
import DemoDashboard from './DemoDashboard';
import { GuestDemo } from './GuestDemo';
import { LegalPage } from './LegalPage';
import { LiveDashboard } from './LiveDashboard';
import { APIError, request, type AuthUser, type DashboardData, type ImportItem } from './api';

const preview = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('preview'):null;
// Explicit local diagnostics remain available to regression tests, never in a public build.
const examplePreview = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('example') : null;

const exampleOptions = [
  ['first', 'Studienstart · Abschnitt 1'],
  ['open', 'Abschnitt 2 · Praxis noch gesperrt'],
  ['practice', 'Praxis möglich · Abschnitt 3 gesperrt'],
  ['repeat-first', 'Pflichtwiederholung im aktuellen Semester'],
  ['thesis', 'Studienabschluss · Bachelorarbeit und Seminar'],
];
function savedExample(value:string) {
  const id=value.slice('example:'.length);
  if (exampleOptions.some(([key])=>key===id)) return value;
  if (id.startsWith('repeat-')) return 'example:repeat-first';
  return id==='thesis-seminar'?'example:thesis':'example:practice';
}

function readProfile(profileKey: string): StudyProfile | null {

  try {
    const value = JSON.parse(localStorage.getItem(profileKey) || 'null');
    return value && typeof value.name === 'string' && typeof value.program === 'string'
      && typeof value.startTerm === 'string' && typeof value.referenceTerm === 'string'
      ? { ...value, referenceTerm:currentSemester() } : null;
  } catch { return null; }
}
export default function App() {
  if (['/impressum','/datenschutz'].includes(window.location.pathname)) return <LegalPage/>;
  if (new URLSearchParams(window.location.search).has('demo')) return <GuestDemo/>;
  return <AuthenticatedApp/>;
}
function AuthenticatedApp() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setChecking(true); setError('');
    request<AuthUser>('/auth/me', { signal: controller.signal }).then(setUser).catch(error => {
      if (!controller.signal.aborted && !(error instanceof APIError && error.status === 401)) setError(error.message);
    }).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => { const expire = () => {setUser(null);}; window.addEventListener('auth-expired', expire); return () => window.removeEventListener('auth-expired', expire); }, [user?.id]);
  async function logout() {
    try { await request('/auth/logout', { method: 'POST' }); setUser(null); }
    catch (error) { window.alert(error instanceof Error ? error.message : 'Abmeldung fehlgeschlagen'); }
  }
  if (checking) return <p role="status" className="p-10">Sitzung wird geprüft …</p>;
  if (error) return <div className="p-10"><p role="alert">{error}</p><button className="action-button mt-4" onClick={() => setAttempt(value => value + 1)}>Erneut versuchen</button></div>;
  if (!user) return <LoginPage onContinue={setUser} />;
  if (user.role === 'admin') return <><CatalogEditor onLogout={() => void logout()} /><ResearchFooter/></>;
  return <DashboardWorkspace key={user.id} user={user} name={user.name} onUserChanged={setUser} onDeleted={()=>setUser(null)} onLogout={() => void logout()} />;
}
function DashboardWorkspace({ user, name, onLogout,onUserChanged,onDeleted }: { user: AuthUser; name: string; onLogout: () => void;onUserChanged:(user:AuthUser)=>void;onDeleted:()=>void }) {
  const profileKey = `stage-gate.profile:${user.id}`;
  const selectionKey = `stage-gate.selection:${user.id}`;
  const [profile, setProfile] = useState<StudyProfile | null>(() => readProfile(profileKey));
  const [dataOpen,setDataOpen]=useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [imports, setImports] = useState<ImportItem[]>([]);
  const [selection, setSelection] = useState(() => {
    if (examplePreview && ['first','open','practice','third','practice-seminar','thesis','thesis-seminar','repeat-first','repeat-later','repeat-due','repeat-no-course','repeat-review','repeat-unknown'].includes(examplePreview)) return `example:${examplePreview}`;
    if (preview === 'dashboard') return 'demo';
    if (preview === 'welcome' || !profile || !validStudyStart(profile.startTerm)) return 'welcome';
    try { const saved = localStorage.getItem(selectionKey); return saved && (/^[0-9]+$/.test(saved) || saved === 'catalog' || !!examplePreview && /^example:(first|open|practice|third|practice-seminar|thesis|thesis-seminar|repeat-first|repeat-later|repeat-due|repeat-no-course|repeat-review|repeat-unknown)$/.test(saved)) ? (saved.startsWith('example:')?savedExample(saved):saved) : saved?.startsWith('example:') ? 'catalog' : 'welcome'; }
    catch { return 'welcome'; }
  });
  useEffect(() => {
    if (profile && !preview && selection !== 'demo') {
      try { localStorage.setItem(selectionKey, selection); } catch { /* In-memory fallback. */ }
    }
  }, [selection, profile]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setListLoading(true);
    request<ImportItem[]>('/imports', { signal: controller.signal })
      .then(items => { setImports(items.filter(item => item.status === 'success')); setListError(''); })
      .catch(e => { if (!controller.signal.aborted) setListError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setListLoading(false); });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    setData(null);
    setError('');
    if (selection === 'demo' || selection === 'welcome') { setLoading(false); return; }
    const example=selection.startsWith('example:');
    if (!example && (!profile || !validStudyStart(profile.startTerm))) { setSelection('welcome'); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    request<DashboardData>(`${selection.startsWith('example:') ? `/programs/wi/examples/${selection.slice(8)}` : selection === 'catalog' ? '/programs/wi/dashboard' : `/imports/${selection}/dashboard`}?term=${encodeURIComponent(profile?.referenceTerm || currentSemester())}${example?'':`&start_term=${encodeURIComponent(profile!.startTerm)}`}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selection, revision, profile?.referenceTerm, profile?.startTerm]);

  async function upload(file: File, confirmedProfile?: StudyProfile) {
    setError('');
    if(user.privacy_version!==PRIVACY_VERSION){setError('Bitte zuerst die Datenschutzinformation bestätigen.');return;}
    if (!file.name.toLowerCase().endsWith('.pdf')) { setError('Bitte eine PDF-Datei auswählen.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Die PDF darf höchstens 10 MB groß sein.'); return; }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const result = await request<{ import_id: number }>('/imports/upload', { method: 'POST', body });
      // Upload already stores styled module groups; no destructive re-parse is needed.
      setNeedsConfirmation(!(confirmedProfile || profile));
      setSelection(String(result.import_id));
      setRevision(value => value + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload fehlgeschlagen.'); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ''; }
  }

  useEffect(() => {
    if (data && needsConfirmation) { setProfileOpen(true); setNeedsConfirmation(false); }
  }, [data, needsConfirmation]);
  function saveProfile(value: StudyProfile, showCatalog = false) {
    setProfile(value);
    if (showCatalog) setSelection('catalog');
    setProfileOpen(false);
    try { localStorage.setItem(profileKey, JSON.stringify(value)); setStorageError(''); }
    catch { setStorageError('Deine Angaben gelten für diese Sitzung. Der Browser konnte sie nicht dauerhaft speichern.'); }
  }
  const contextProfile = selection.startsWith('example:')
    ? {name,program:'Wirtschaftsinformatik (B.Sc.)',startTerm:data?.example_start_term || profile?.startTerm || 'WiSe 2023/24',referenceTerm:currentSemester()}
    : profile;
  const knownSelection = imports.some(item => String(item.id) === selection);
  return (
    <div className="min-h-screen bg-gray-50 min-w-[1280px]">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-[1920px] mx-auto px-8 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center"><GraduationCap className="w-6 h-6 text-white" /></div><div><span className="text-sm font-medium">Study Navigator <span className="text-gray-400 font-normal">· Forschungsprototyp</span></span>{contextProfile && <div className="mt-1 text-xs text-gray-500"><InfoPopover label="Studieninformationen" title={`Studienbeginn ${contextProfile.startTerm} · ${data?.spo_version || 'SPO anhand des Studienbeginns'}`} trigger={<>{contextProfile.program.replace(' (B.Sc.)','')} · Start {contextProfile.startTerm}<Info size={12}/></>}><div className="space-y-3"><p className="font-medium">Dein Studienplan</p><p>{data?.spo_version || 'Die Studienordnung wird anhand deines Studienbeginns zugeordnet.'}</p><p className="text-gray-500">Die Ergebnisse werden mit den Anforderungen dieser SPO abgeglichen. Ein fehlender Nachweis bedeutet noch keinen Fehlversuch. Einplanen ersetzt keine Anmeldung.</p>{data?.semester_data_configured===false && <p>Semesterangebote werden für diese SPO noch eingerichtet.</p>}{data?.import_report?.warnings?.map(w=><p key={w} className="text-amber-800">{w}</p>)}</div></InfoPopover></div>}</div></div>
          <div className="flex items-center gap-2 mr-auto">
            <div className="min-w-0 max-w-64">
            <p className="text-sm font-medium truncate" title={name} data-testid="personal-report-owner">{name}<span className="font-normal text-gray-500 text-xs"> · Mein Studienstand</span></p>
            <label htmlFor="import-select" className="sr-only">Datenquelle</label>
            <select id="import-select" value={selection} disabled={uploading} onChange={event => setSelection(event.target.value)} className="border rounded-md px-3 py-2 mt-1 max-w-64 w-full bg-white text-sm">
              <option value="welcome">Meine Übersicht</option>
              <option value="catalog">Studienplan ohne PDF</option>
              {selection==='demo' && <option value="demo">Designvorschau</option>}
              {examplePreview&&<optgroup label="Beispiele">{exampleOptions.map(([id,label])=><option key={id} value={`example:${id}`}>{label}</option>)}</optgroup>}
              {selection.startsWith('example:')&&!exampleOptions.some(([id])=>selection===`example:${id}`)&&<option hidden value={selection}>{data?.example_label||'Testbeispiel'}</option>}
              {selection !== 'demo' && selection !== 'welcome' && selection !== 'catalog' && !selection.startsWith('example:') && !knownSelection && <option value={selection}>Notenstand #{selection}</option>}
              {imports.map(item => <option key={item.id} value={item.id}>Notenstand · {item.created_at ? new Date(item.created_at).toLocaleDateString('de-DE') : 'Datum unbekannt'}</option>)}
            </select>
            </div>
            <button className="action-button" title="Importe aktualisieren" aria-label="Importe aktualisieren" disabled={uploading || listLoading || loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={17} /></button>
            <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Leistungen PDF aktualisieren" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
            <button className="action-button bg-blue-600 text-white border-blue-600" disabled={uploading} onClick={() => profile && validStudyStart(profile.startTerm) ? fileInput.current?.click() : setSelection('welcome')}><Upload size={17} />{uploading ? 'PDF wird verarbeitet …' : profile ? 'Leistungen aktualisieren' : 'PDF importieren'}</button>
            <InfoPopover align="right" label="PDF aus HISinOne erstellen" trigger={<span className="action-button" aria-label="PDF-Anleitung öffnen"><CircleHelp size={17}/></span>}><LeistungenInstructions/></InfoPopover>
          </div><div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 flex items-center gap-2"><Calendar size={16}/>{new Date().toLocaleDateString('de-DE',{timeZone:'Europe/Berlin'})}</span>
            <button className="action-button" aria-label="Datenschutz & Daten" onClick={()=>setDataOpen(true)}><Shield size={17}/></button>
            <button className="action-button" aria-label="Studienangaben bearbeiten" onClick={() => setProfileOpen(true)}><Settings size={17} /></button>
            <button className="action-button" aria-label="Abmelden" onClick={onLogout}><LogOut size={17} /></button>
          </div>
        </div>
      </header>
      {user.privacy_version!==PRIVACY_VERSION&&<ConsentBanner onAccepted={onUserChanged}/>}
      <div className="max-w-[1920px] mx-auto px-8 pt-4 space-y-2" aria-live="polite">
        {storageError && <p role="status" className="text-amber-700 text-sm">{storageError}</p>}
        {selection === 'demo' && <p className="rounded border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">Designvorschau mit fiktiven Daten. Für deinen Studienstand eine Leistungen-PDF importieren oder einen Import auswählen.</p>}
        {(error || listError) && <div role="alert" className="border border-red-200 bg-red-50 text-red-800 rounded px-4 py-3 flex justify-between gap-4"><span>{error || listError}</span><button className="underline" onClick={() => setRevision(value => value + 1)}>Erneut versuchen</button></div>}
        {data?.example_scenario && <p className="text-xs text-blue-800">Beispiel · {data.example_label} · Fiktive Ergebnisse, getrennt von deinen Noten und deinem Semesterplan.</p>}
      </div>
      {selection === 'welcome' ? <WelcomeDashboard name={name} profile={profile} uploading={uploading} onUpload={(file, value) => void upload(file, value)} onSave={saveProfile} onManual={() => setProfileOpen(true)} /> : selection === 'demo' ? <DemoDashboard /> : loading ? <p role="status" className="p-8 text-gray-600">Notenübersicht wird geladen …</p> : data ? <LiveDashboard data={data} profile={contextProfile} ownerKey={selection.startsWith('example:') ? `${user.id}:${selection}` : String(user.id)} /> : <p className="p-8 text-gray-600">Für diesen Import sind zurzeit keine Daten verfügbar.</p>}
      <ResearchFooter/>
      {dataOpen&&<AccountDataDialog user={user} imports={imports} onClose={()=>setDataOpen(false)} onDeleted={onDeleted} onChanged={()=>{setProfile(readProfile(profileKey));setSelection('welcome');setRevision(v=>v+1);void request<AuthUser>('/auth/me').then(onUserChanged).catch(()=>{});}}/>}
      {profileOpen && <ProfileDialog open={profileOpen} name={name} profile={profile} suggestedProgram={data?.program || null} onClose={() => setProfileOpen(false)} onSave={saveProfile} />}
    </div>
  );
}
