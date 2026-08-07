import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Outil interne : pas d'inscription en libre-service. Les comptes se créent
// dans Supabase (Auth > Users) et doivent être listés dans app_admins.
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [success, setSuccess] = useState('');
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const { error } = await signIn(email, password);
    if (error) {
      setError('Email ou mot de passe incorrect');
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(`Un email de réinitialisation a été envoyé à ${email}`);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 px-6">
        <div className="text-center">
          <h1 className="font-heading text-2xl text-brand-logo">
            Nowad<span className="text-primary">a</span>ys Missions
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isForgot ? 'Réinitialisez votre mot de passe' : 'Connectez-vous à votre espace'}
          </p>
        </div>

        {isForgot ? (
          <form onSubmit={handleForgot} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-body text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                required
                className="font-body"
              />
            </div>

            {error && <p className="text-sm text-destructive font-body">{error}</p>}
            {success && <p className="text-sm text-primary font-body">{success}</p>}

            <Button type="submit" className="w-full font-body" disabled={loading}>
              {loading ? 'Envoi...' : 'Réinitialiser mon mot de passe'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-body text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                required
                className="font-body"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="font-body text-sm">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="font-body"
              />
            </div>

            {error && <p className="text-sm text-destructive font-body">{error}</p>}
            {success && <p className="text-sm text-primary font-body">{success}</p>}

            <Button type="submit" className="w-full font-body" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>

            <p className="text-center">
              <button
                type="button"
                onClick={() => { setIsForgot(true); setError(''); setSuccess(''); }}
                className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Mot de passe oublié ?
              </button>
            </p>
          </form>
        )}

        {isForgot && (
          <p className="text-center">
            <button
              type="button"
              onClick={() => { setIsForgot(false); setError(''); setSuccess(''); }}
              className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Retour à la connexion
            </button>
          </p>
        )}
      </div>
    </div>
  );
};
export default Login;
