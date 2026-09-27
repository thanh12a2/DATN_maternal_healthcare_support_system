import { useEffect, useRef, useState } from 'react';
import type { AuthMode, LoginFormValues, RegisterFormValues } from '../../schemas/auth';
import { BackgroundShapes } from './BackgroundShapes';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

interface Props { initialMode?:AuthMode; onModeChange?:(mode:AuthMode)=>void; onLogin?:(values:LoginFormValues,remember:boolean)=>Promise<void>; onRegister?:(values:RegisterFormValues)=>Promise<void>; }
export function AuthShell({initialMode='login',onModeChange,onLogin,onRegister}:Props){const[mode,setMode]=useState<AuthMode>(initialMode);const cardRef=useRef<HTMLDivElement>(null);useEffect(()=>setMode(initialMode),[initialMode]);useEffect(()=>{cardRef.current?.scrollTo?.({top:0});window.setTimeout(()=>cardRef.current?.querySelector<HTMLInputElement|HTMLSelectElement>('input, select')?.focus(),160);},[mode]);function change(next:AuthMode){setMode(next);onModeChange?.(next);}return <main className="auth-page" data-mode={mode}><BackgroundShapes/><section className="form-panel" aria-live="polite"><div className="auth-card" data-mode={mode} ref={cardRef}>{mode==='login'?<LoginForm onSwitchMode={()=>change('register')} onSubmit={onLogin}/>:<RegisterForm onSwitchMode={()=>change('login')} onSubmit={onRegister}/>}</div></section></main>;}
