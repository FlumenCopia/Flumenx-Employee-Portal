"use client";

import { FormEvent, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import gsap from "gsap";
import { FlumenxMark } from "@/components/icons";
import { api, ApiError, tokenStore } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const page = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [portalRole, setPortalRole] = useState<"HR" | "ADMIN" | "ACCOUNTANT" | "BDO" | "EMPLOYEE">("ADMIN");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.timeline({ delay: .15 })
        .from(".login-form-side", { y: 28, opacity: 0, scale: .985, duration: .7, ease: "power3.out" })
        .from(".login-form-side form>*", { y: 10, opacity: 0, stagger: .04, duration: .3 }, "-=.38");
    }, page);
    return () => ctx.revert();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(""); setFieldErrors({}); setLoading(true);
    try {
      const data = await api<{ access: string; refresh: string; user: { role: string; portal_role: string } }>("/auth/login/", { method: "POST", body: JSON.stringify({ username: email, password, portal_role: portalRole }) });
      tokenStore.set(data.access, data.refresh, data.user);
      const destinations: Record<string,string> = { ADMIN:"/admin/dashboard", HR:"/hr/dashboard", ACCOUNTANT:"/accountant/dashboard", BDO:"/bdo/dashboard", EMPLOYEE:"/employee/dashboard" };
      router.push(destinations[data.user.portal_role] || "/login");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign in.");
      if (error instanceof ApiError) setFieldErrors(error.fields);
    } finally { setLoading(false); }
  }

  async function signup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError(""); setFieldErrors({});
    const form = new FormData(e.currentTarget);
    try {
      await api("/auth/register/", { method: "POST", body: JSON.stringify({
        full_name: form.get("full_name"), email: form.get("email"), phone: form.get("phone"),
        portal_role: form.get("portal_role"), password: form.get("password"),
        confirm_password: form.get("confirm_password"),
      }) });
      setSignupComplete(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to create account.");
      if (error instanceof ApiError) setFieldErrors(error.fields);
    } finally { setLoading(false); }
  }

  function chooseRole(next: "HR" | "ADMIN" | "ACCOUNTANT" | "BDO" | "EMPLOYEE") {
    setPortalRole(next);
  }

  return <div className="simple-login-page" ref={page}>
    <div className="login-visual">
      <div className="login-grid" /><div className="login-glow" />
      <div className="orbit-system"><div className="orbit-ring one"><i /></div><div className="orbit-ring two"><i /></div><div className="orbit-core">FX</div></div>
      <div className="visual-brand"><FlumenxMark /><span>EMPLOYEE OS / 2026</span></div>
      <div className="visual-copy"><div className="eyebrow">THE WORKPLACE, IN MOTION</div><h1><span className="hero-line"><span>WORK</span></span><span className="hero-line"><span>WITH <em>FLOW.</em></span></span><span className="hero-line outline"><span>MOVE AS ONE.</span></span></h1><p>One intelligent space for people, attendance, payroll, communication, and momentum.</p></div>
      <div className="login-reel"><div className="login-reel-track"><span>PEOPLE</span><i/><span>CLARITY</span><i/><span>MOMENTUM</span><i/><span>FLUMENX</span><i/><span>PEOPLE</span><i/><span>CLARITY</span><i/><span>MOMENTUM</span><i/><span>FLUMENX</span></div></div>
      <div className="visual-foot"><span>FLUMENX SYSTEMS © 2026</span><span>FLOW · PEOPLE · FORWARD</span></div>
    </div>
    <div className="login-form-side">
      <div className="form-rail">SECURE ACCESS / FLX-01</div><div className="mobile-brand"><FlumenxMark /></div>
      <form onSubmit={submit} className={mode === "login" ? "" : "auth-form-hidden"}>
        <div className="form-index">ONE PORTAL · EVERY ROLE</div>
        <h2>Welcome <i>back.</i></h2>
        <p className="form-subtitle">Use your work account. We automatically open the correct workspace for your role.</p>
        <label>Work email<div className="input-wrap"><Mail size={18} /><input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="name@company.com" required /></div>{fieldErrors.username&&<span className="form-field-error">{fieldErrors.username}</span>}</label>
        <label>Password<div className="input-wrap"><LockKeyhole size={18} /><input value={password} onChange={e => setPassword(e.target.value)} type={show ? "text" : "password"} required /><button type="button" onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{fieldErrors.password&&<span className="form-field-error">{fieldErrors.password}</span>}</label>
        <label>Login role<div className="input-wrap role-select-wrap"><Building2 size={18}/><select value={portalRole} onChange={e => chooseRole(e.target.value as typeof portalRole)} required><option value="HR">HR</option><option value="ADMIN">ADMIN</option><option value="ACCOUNTANT">ACCOUNTANT</option><option value="BDO">BDO</option><option value="EMPLOYEE">EMPLOYEE</option></select></div>{fieldErrors.portal_role&&<span className="form-field-error">{fieldErrors.portal_role}</span>}</label>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="login-button" disabled={loading}>{loading ? "Signing in…" : "Login to FLUMENX"}<ArrowRight size={18} /></button>
        <div className="auth-switch"><span>Don’t have an account?</span><button type="button" onClick={() => { setMode("signup"); setSignupComplete(false); }}>Create account</button></div>
        <div className="demo-note"><span>SECURE ACCESS</span><p>Enter the email, password, and role used when the account was created.</p></div>
      </form>
      {mode === "signup" && (signupComplete ? <div className="signup-success"><CheckCircle2 /><div className="form-index">ACCOUNT CREATED</div><h2>Welcome to <i>FLUMENX.</i></h2><p>Your account is active. Return to login with the email, password, and role you just selected.</p><button className="login-button" onClick={() => { setMode("login"); setSignupComplete(false); }}>Return to login <ArrowRight size={18}/></button></div> : <form onSubmit={signup}>
        <button className="back-to-login" type="button" onClick={() => setMode("login")}><ArrowLeft size={15}/> Back to login</button>
        <div className="form-index">CREATE PORTAL ACCOUNT</div><h2>Join <i>FLUMENX.</i></h2><p className="form-subtitle">Choose the role for this account. Login must use the same role.</p>
        <label>Full name<div className="input-wrap"><UserRound size={18}/><input name="full_name" placeholder="Your full name" required/></div></label>
        <label>Work email<div className="input-wrap"><Mail size={18}/><input name="email" type="email" placeholder="name@company.com" required/></div>{fieldErrors.email&&<span className="form-field-error">{fieldErrors.email}</span>}</label>
        <label>Phone<div className="input-wrap"><UserRound size={18}/><input name="phone" placeholder="+91 98765 43210" required/></div></label>
        <label>Account role<div className="input-wrap role-select-wrap"><Building2 size={18}/><select name="portal_role" required><option value="ADMIN">ADMIN</option><option value="HR">HR</option><option value="ACCOUNTANT">ACCOUNTANT</option><option value="BDO">BDO</option><option value="EMPLOYEE">EMPLOYEE</option></select></div>{fieldErrors.portal_role&&<span className="form-field-error">{fieldErrors.portal_role}</span>}</label>
        <label>Create password<div className="input-wrap"><LockKeyhole size={18}/><input name="password" type={show ? "text" : "password"} minLength={8} placeholder="Minimum 8 characters" required/><button type="button" onClick={() => setShow(!show)}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{fieldErrors.password&&<span className="form-field-error">{fieldErrors.password}</span>}</label>
        <label>Confirm password<div className="input-wrap"><LockKeyhole size={18}/><input name="confirm_password" type={show ? "text" : "password"} minLength={8} placeholder="Repeat password" required/></div>{fieldErrors.confirm_password&&<span className="form-field-error">{fieldErrors.confirm_password}</span>}</label>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="login-button" disabled={loading}>{loading ? "Submitting..." : "Request account"}<ArrowRight size={18}/></button>
      </form>)}
    </div>
  </div>;
}
