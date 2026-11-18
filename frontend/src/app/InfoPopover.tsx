import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function InfoPopover({label,trigger,children,title,align='left'}:{label:string;trigger:ReactNode;children:ReactNode;title?:string;align?:'left'|'right'}) {
 const ref=useRef<HTMLDetailsElement>(null),button=useRef<HTMLElement>(null);
 const close=()=>{if(ref.current)ref.current.open=false;button.current?.focus();};
 return <details ref={ref} className="relative" aria-label={label} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();close();}}}>
  <summary ref={button} title={title || label} className="list-none cursor-pointer flex items-center gap-1 rounded focus-visible:outline-blue-500">{trigger}</summary>
  <div className={`absolute ${align==='right'?'right-0':'left-0'} top-full mt-3 z-40 w-[440px] rounded-xl border border-gray-200 bg-white shadow-lg p-5 text-sm`}>
   <div className="flex justify-between gap-4 items-center mb-4"><h2 className="font-medium">{label}</h2><button type="button" className="action-button p-1" aria-label={`${label} schließen`} onClick={close}><X size={16}/></button></div>{children}
  </div>
 </details>;
}
