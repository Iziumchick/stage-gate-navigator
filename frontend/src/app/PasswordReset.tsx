import {useEffect,useState,type FormEvent} from 'react';
import {request} from './api';

interface ResetChallenge {
  reset_required:true;
  ticket:string;
  email:string;
  expires_in:number;
  resend_after:number;
  message:string;
}

export function PasswordReset({initialEmail,onBack}:{initialEmail:string;onBack:(email:string,changed:boolean)=>void}) {
  const[email,setEmail]=useState(initialEmail),[challenge,setChallenge]=useState<ResetChallenge|null>(null);
  const[code,setCode]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('');
  const[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false),[resent,setResent]=useState(false);
  const[retryAt,setRetryAt]=useState(0),[remaining,setRemaining]=useState(0);
  useEffect(()=>{const tick=()=>setRemaining(Math.max(0,Math.ceil((retryAt-Date.now())/1000)));tick();const timer=window.setInterval(tick,1000);return()=>window.clearInterval(timer);},[retryAt]);

  async function send(){
    setBusy(true);setError('');setResent(false);
    try{
      const next=await request<ResetChallenge>('/auth/password/reset/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:challenge?.email||email})});
      setResent(challenge!==null);setChallenge(next);setEmail(next.email);setCode('');
      setRemaining(next.resend_after);setRetryAt(Date.now()+next.resend_after*1000);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!challenge){await send();return;}
    if(password!==confirmation){setError('Die Passwörter stimmen nicht überein.');return;}
    setBusy(true);setError('');
    try{
      await request('/auth/password/reset/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:challenge.ticket,code,new_password:password})});
      setDone(true);setChallenge(null);setPassword('');setConfirmation('');setCode('');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  if(done)return <section aria-labelledby="password-reset-title">
    <h2 id="password-reset-title" className="text-2xl">Passwort geändert</h2>
    <p role="status" className="text-sm text-gray-600 mt-3">Dein neues Passwort ist gespeichert. Deine Leistungen und dein Studienplan bleiben erhalten. Melde dich jetzt mit deinem neuen Passwort an.</p>
    <button type="button" className="primary-button mt-6 w-full justify-center" onClick={()=>onBack(email,true)}>Zur Anmeldung</button>
  </section>;
  return <section aria-labelledby="password-reset-title">
    <h2 id="password-reset-title" className="text-2xl">Passwort zurücksetzen</h2>
    <p className="text-sm text-gray-600 mt-3">{challenge?challenge.message:'Gib die E-Mail-Adresse deines Study-Navigator-Kontos ein. Du erhältst einen Code und kannst ein neues Passwort festlegen.'}</p>
    {challenge&&<p className="text-sm text-gray-600 mt-3">Adresse: <strong>{challenge.email}</strong><br/>Der Code ist 10 Minuten gültig. Deine Leistungen und dein Studienplan bleiben erhalten.</p>}
    <form onSubmit={e=>void submit(e)} className="space-y-4 mt-6"><fieldset disabled={busy} className="space-y-4">
      {!challenge?<label className="block text-sm">E-Mail-Adresse<input className="form-input mt-2" type="email" autoComplete="username" autoFocus required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>:<>
        <label className="block text-sm">Code aus der E-Mail<input className="form-input mt-2 tracking-widest" required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/[^0-9]/g,''))}/></label>
        <label className="block text-sm">Neues Passwort<input className="form-input mt-2" type="password" autoComplete="new-password" required minLength={12} maxLength={200} value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <p className="text-xs text-gray-500">Mindestens 12 Zeichen. Bitte ein eigenes Passwort für Study Navigator verwenden.</p>
        <label className="block text-sm">Neues Passwort wiederholen<input className="form-input mt-2" type="password" autoComplete="new-password" required minLength={12} maxLength={200} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
      </>}
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
      {resent&&<p role="status" className="text-sm text-gray-600">Falls ein freigegebenes Konto besteht, erhältst du einen neuen Code. Bitte nur den neuesten Code verwenden.</p>}
      <button type="submit" className="primary-button w-full justify-center" disabled={busy||Boolean(challenge&&code.length!==6)}>{busy?'Bitte warten …':challenge?'Neues Passwort speichern':'Code anfordern'}</button>
    </fieldset></form>
    <div className="flex flex-col items-start gap-3 mt-5 text-sm">
      {challenge&&<button type="button" className="text-blue-700 underline" disabled={busy||remaining>0} onClick={()=>void send()}>{remaining>0?`Neuen Code senden (${remaining} s)`:'Neuen Code senden'}</button>}
      <button type="button" className="action-button" disabled={busy} onClick={()=>onBack(email,false)}>Zur Anmeldung</button>
    </div>
  </section>;
}
