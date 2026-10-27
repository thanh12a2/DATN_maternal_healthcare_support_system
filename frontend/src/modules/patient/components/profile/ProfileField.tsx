import type { ReactNode } from 'react';
export function ProfileField({ id,label,error,optional,full,children,hint }: {id:string;label:string;error?:string;optional?:boolean;full?:boolean;children:ReactNode;hint?:string}) {
  const messageId=id+'-message';
  return <div className={`profile-field ${full?'is-full':''} ${error?'has-error':''}`}><label htmlFor={id}>{label}{optional&&<span>Không bắt buộc</span>}</label>{children}<p id={messageId} className="profile-field-message">{error||hint||''}</p></div>;
}
