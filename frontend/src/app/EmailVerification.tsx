import {useEffect,useState,type FormEvent} from 'react';
import {request,type AuthUser} from './api';

export interface EmailChallenge {
  verification_required:true;
  ticket:string;
  email:string;
  expires_in:number;
  resend_after:number;
}

export function EmailVerification({initial,onContinue,onBack}:{initial:EmailChallenge;onContinue:(user:AuthUser)=>void;onBack:()=>void}) {
  const[challenge,setChallenge]=useState(initial),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false),[remaining,setRemaining]=useState(initial.resend_after);
  const[retryAt,setRetryAt]=useState(()=>Date.now()+initial.resend_after*1000);
  useEffect(()=>{const tick=()=>setRemaining(Math.max(0,Math.ceil((retryAt-Date.now())/1000)));tick();const timer=window.setInterval(tick,1000);return()=>window.clearInterval(timer);},[retryAt]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');
    try{onContinue(await request<AuthUser>('/auth/email/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:challenge.ticket,code})}));}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function resend(){
    setBusy(true);setError('');setSent(false);
    try{const next=await request<EmailChallenge>('/auth/email/resend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:challenge.ticket})});setChallenge(next);setCode('');setRemaining(next.resend_after);setRetryAt(Date.now()+next.resend_after*1000);setSent(true);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section aria-labelledby="verify-email-title">
    <h2 id="verify-email-title" className="text-2xl">Hochschuladresse bestätigen</h2>
    <p className="text-sm text-gray-600 mt-3">Wir haben einen sechsstelligen Code an <strong>{challenge.email}</strong> gesendet. Er ist 10 Minuten gültig. Erst nach der Bestätigung wird dein Zugang freigeschaltet.</p>
    <form onSubmit={e=>void submit(e)} className="space-y-4 mt-6"><label className="block text-sm">Bestätigungscode<input className="form-input mt-2 tracking-widest" required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/[^0-9]/g,''))} disabled={busy}/></label>
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
      {sent&&<p role="status" className="text-sm text-green-700">Ein neuer Code wurde gesendet. Bitte den neuesten Code verwenden.</p>}
      <button className="primary-button w-full justify-center" type="submit" disabled={busy||code.length!==6}>{busy?'Bitte warten …':'E-Mail bestätigen'}</button>
    </form>
    <p className="text-xs text-gray-500 mt-4">Bitte auch den Spam-Ordner prüfen. Nach einem Neuladen der Seite erneut anmelden, um einen neuen Code anzufordern.</p>
    <div className="flex flex-col items-start gap-3 mt-5 text-sm"><button type="button" className="text-blue-700 underline" disabled={busy||remaining>0} onClick={()=>void resend()}>{remaining>0?`Neuen Code senden (${remaining} s)`:'Neuen Code senden'}</button><button type="button" className="action-button" disabled={busy} onClick={onBack}>Zur Anmeldung</button></div>
  </section>;
}
