import { useState, useRef } from 'react';
import { verifyCode, setSession } from '@/lib/auth';

interface LoginPageProps {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const ok = await verifyCode(value);
    setLoading(false);

    if (ok) {
      setSession();
      onLogin();
    } else {
      setError(true);
      setValue('');
      setTimeout(() => {
        setError(false);
        inputRef.current?.focus();
      }, 600);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-10">
          <div className="text-4xl font-bold tracking-tight mb-1">MCM Panel</div>
          <p className="text-muted-foreground text-sm">Área restringida</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className={`space-y-4 transition-transform ${error ? 'animate-shake' : ''}`}
        >
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Introduce el códice secreto
            </label>
            <input
              ref={inputRef}
              type="password"
              autoFocus
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={loading}
              className={`w-full bg-muted border rounded-md px-4 py-3 text-sm outline-none transition-all
                focus:ring-2 focus:ring-primary focus:border-transparent
                ${error ? 'border-destructive ring-2 ring-destructive' : 'border-border'}
                disabled:opacity-50`}
              placeholder="••••••••"
            />
            {error && (
              <p className="text-destructive text-xs">Códice incorrecto. Inténtalo de nuevo.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || value.length === 0}
            className="w-full bg-primary text-primary-foreground rounded-md px-4 py-3 text-sm font-medium
              hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verificando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
