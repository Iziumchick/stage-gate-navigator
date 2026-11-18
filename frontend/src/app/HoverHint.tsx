import {useId,type ReactNode} from 'react';
export function HoverHint({text,children,align='left',placement='top'}:{text:string;children:ReactNode;align?:'left'|'right';placement?:'top'|'bottom'}) {
 const id=useId();
 return <span tabIndex={0} className="relative inline-flex group/hint outline-blue-500 cursor-help" aria-describedby={id}>{children}<span id={id} role="tooltip" className={`hidden group-hover/hint:block group-focus-within/hint:block absolute ${align==='right'?'right-0':'left-0'} ${placement==='bottom'?'top-full mt-2':'bottom-full mb-2'} z-30 w-80 p-3 rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-normal shadow-lg whitespace-pre-line}`}>{text}</span></span>;
}
