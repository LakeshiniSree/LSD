import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Stethoscope, ArrowRight } from 'lucide-react';
import {
  loginUser,
  signupUser,
  requestPasswordReset,
  resetPassword,
} from '../api.js';

// Convert backend and network errors into messages people can understand.
function getReadableError(error) {
  const raw = error?.message ?? error;

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => {
          const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : '';
          const message = item.msg || 'Invalid value';
          return field ? `${String(field)}: ${message}` : message;
        }).join(' ');
      }
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed.detail || parsed.message || 'Please check your details and try again.';
      }
    } catch {
      // The message was ordinary text, so use it below.
    }
    return raw;
  }

  if (Array.isArray(raw)) {
    return raw.map((item) => item?.msg || item?.message || String(item)).join(' ');
  }

  if (raw && typeof raw === 'object') {
    return raw.detail || raw.message || 'Please check your details and try again.';
  }

  return 'Something went wrong. Please try again.';
}

function Frame({ title, sub, children, foot }) {
  return (
    <div className="auth">
      <aside className="auth-art">
        <div className="brand">
          <span className="brand-icon"><Stethoscope /></span>
          <span>LSD <b>Care</b></span>
        </div>
        <div>
          <span className="eyebrow">SMARTER HERD HEALTH</span>
          <h1>Care starts with<br /><em>early attention.</em></h1>
          <p>Organise cattle image screenings, review results and find practical guidance for the next step.</p>
        </div>
        <small>PRELIMINARY SCREENING · NOT A DIAGNOSIS</small>
      </aside>
      <section className="auth-panel">
        <div className="auth-inner">
          <Link className="auth-brand" to="/">✚ LSD <b>Care</b></Link>
          <span className="eyebrow">WELCOME TO LSD CARE</span>
          <h2>{title}</h2>
          <p>{sub}</p>
          {children}
          <div className="auth-foot">{foot}</div>
        </div>
      </section>
    </div>
  );
}

function Pass({ value, onChange, label }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <div className="pass">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          required
          minLength={6}
          placeholder="At least 6 characters"
          autoComplete="new-password"
        />
        <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}>
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </label>
  );
}

// Accept common international phone formats, but never an email address.
// The number must contain 8–15 digits after punctuation is removed.
function validatePhone(value) {
  const phone = value.trim();
  const digits = phone.replace(/\D/g, '');

  if (!phone) return 'Please enter your phone number.';
  if (phone.includes('@') || !/^[0-9+() -]+$/.test(phone)) {
    return 'This looks like an email address or contains invalid characters. Enter a phone number instead.';
  }
  if (digits.length < 8 || digits.length > 15) {
    return 'Enter a valid phone number with 8 to 15 digits, including your country code if needed.';
  }
  return '';
}

export function Login({ login }) {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const user = await loginUser(id.trim(), pw);
      login(user);
      nav('/app/home');
    } catch (error) {
      setErr(getReadableError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame
      title="Welcome back"
      sub="Sign in to continue to your cattle health workspace."
      foot={<>New here? <Link to="/signup">Create an account →</Link></>}
    >
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Email or phone number</span>
          <input value={id} onChange={(e) => setId(e.target.value)} required placeholder="you@example.com or phone" autoComplete="username" />
        </label>
        <Pass label="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <div className="between">
          <label><input type="checkbox" /> Remember me</label>
          <Link to="/forgot">Forgot password?</Link>
        </div>
        {err && <div className="error" role="alert">{err}</div>}
        <button className="btn primary full" disabled={busy}>
          {busy ? 'Signing in...' : <>Sign in <ArrowRight size={17} /></>}
        </button>
      </form>
      <small className="demo">Demo login only. Do not use a real password.</small>
    </Frame>
  );
}

export function Signup({ login }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', pw: '', confirm: '', role: 'Farmer' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const upd = (e) => setF((current) => ({ ...current, [e.target.name]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setErr('');

    if (!f.name.trim()) {
      setErr('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) {
      setErr('Please enter a valid email address, such as name@example.com.');
      return;
    }

    const phoneError = validatePhone(f.phone);
    if (phoneError) {
      setErr(phoneError);
      return;
    }
    if (f.pw.length < 6) {
      setErr('Your password must contain at least 6 characters.');
      return;
    }
    if (f.pw !== f.confirm) {
      setErr('Passwords do not match. Please check both password fields.');
      return;
    }

    setBusy(true);
    try {
      const user = await signupUser({
        name: f.name.trim(),
        email: f.email.trim(),
        phone: f.phone.trim(),
        password: f.pw,
        role: f.role,
      });
      login(user);
      nav('/app/home');
    } catch (error) {
      setErr(getReadableError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame
      title="Create your account"
      sub="Set up a profile to start organising cattle screenings."
      foot={<>Already registered? <Link to="/login">Sign in →</Link></>}
    >
      <form className="form compact-form" onSubmit={submit} noValidate>
        <label className="field">
          <span>Full name</span>
          <input name="name" value={f.name} onChange={upd} required placeholder="Your full name" autoComplete="name" />
        </label>
        <label className="field">
          <span>Email address</span>
          <input name="email" type="email" value={f.email} onChange={upd} required placeholder="you@example.com" autoComplete="email" />
        </label>
        <label className="field">
          <span>Phone number</span>
          <input
            name="phone"
            type="tel"
            value={f.phone}
            onChange={upd}
            required
            placeholder="+91 98765 43210"
            autoComplete="tel"
            aria-describedby="phone-help"
          />
          <small id="phone-help">Enter a phone number, including country code if applicable. Do not enter your email address here.</small>
        </label>
        <Pass label="Password" value={f.pw} onChange={(e) => setF((current) => ({ ...current, pw: e.target.value }))} />
        <Pass label="Confirm password" value={f.confirm} onChange={(e) => setF((current) => ({ ...current, confirm: e.target.value }))} />
        <label className="field">
          <span>Role</span>
          <select name="role" value={f.role} onChange={upd}>
            <option>Farmer</option>
            <option>Veterinary Doctor</option>
          </select>
        </label>
        <label className="terms">
          <input type="checkbox" required />
          I understand results are preliminary and do not replace a veterinarian.
        </label>
        {err && <div className="error" role="alert">{err}</div>}
        <button className="btn primary full" disabled={busy}>
          {busy ? 'Creating account...' : <>Create account <ArrowRight size={17} /></>}
        </button>
        <small className="demo">Demo account details are stored in this browser only.</small>
      </form>
    </Frame>
  );
}

export function Forgot() {
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
      setDone(true);
    } catch (error) {
      setErr(getReadableError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame
      title="Password recovery"
      sub="Enter your registered email address and we will send you a secure reset link."
      foot={<Link to="/login">Back to sign in</Link>}
    >
      {done ? (
        <p className="notice">If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.</p>
      ) : (
        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>Email address</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
          </label>
          {err && <div className="error" role="alert">{err}</div>}
          <button className="btn primary full" disabled={busy}>{busy ? 'Sending...' : 'Send reset link'}</button>
        </form>
      )}
    </Frame>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const token = params.get('token') || '';

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (pw !== confirm) {
      setErr('Passwords do not match. Please check both password fields.');
      return;
    }
    setBusy(true);
    try {
      await resetPassword(token, pw);
      setDone(true);
    } catch (error) {
      setErr(getReadableError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame
      title="Create a new password"
      sub="Choose a new password for your LSD Care account."
      foot={<Link to="/login">Back to sign in</Link>}
    >
      {done ? (
        <p className="notice">Your password has been updated successfully. You can now sign in with your new password.</p>
      ) : !token ? (
        <p className="notice">This reset link is missing or invalid. Please request a new password reset link.</p>
      ) : (
        <form className="form" onSubmit={submit}>
          <Pass label="New password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Pass label="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {err && <div className="error" role="alert">{err}</div>}
          <button className="btn primary full" disabled={busy}>{busy ? 'Updating...' : 'Update password'}</button>
        </form>
      )}
    </Frame>
  );
}
