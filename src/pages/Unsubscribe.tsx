import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type State = 'loading' | 'valid' | 'invalid' | 'already' | 'success' | 'error';

const SUPABASE_URL = 'https://xfotgssasntgrpributa.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmb3Rnc3Nhc250Z3JwcmlidXRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5OTkwNTQsImV4cCI6MjA4ODU3NTA1NH0.vEjZRZCrpOpuaZ3O0qwh4hNM4Ri89dunJGTHWDZzuBE';

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<State>('loading');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('invalid');
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const data = await res.json();
        if (data.valid) setState('valid');
        else if (data.reason === 'already_unsubscribed') setState('already');
        else setState('invalid');
      } catch {
        setState('error');
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('handle-email-unsubscribe', {
      body: { token },
    });
    setSubmitting(false);
    if (error) setState('error');
    else if (data?.success) setState('success');
    else if (data?.reason === 'already_unsubscribed') setState('already');
    else setState('error');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#FFF8FA' }}>
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
        {state === 'loading' && (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: '#91014b' }} />
            <p className="text-muted-foreground">Vérification…</p>
          </>
        )}
        {state === 'valid' && (
          <>
            <h1 className="font-heading text-2xl mb-3" style={{ color: '#91014b' }}>
              Se désinscrire ?
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Tu ne recevras plus d'emails de notre part.
            </p>
            <Button
              onClick={confirm}
              disabled={submitting}
              style={{ background: '#FB3D80', color: '#fff' }}
              className="hover:opacity-90"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmer la désinscription
            </Button>
          </>
        )}
        {state === 'success' && (
          <>
            <CheckCircle2 className="h-10 w-10 mx-auto mb-4 text-green-500" />
            <h1 className="font-heading text-2xl mb-2" style={{ color: '#91014b' }}>
              C'est fait
            </h1>
            <p className="text-sm text-muted-foreground">Tu es désinscrit·e. À bientôt 👋</p>
          </>
        )}
        {state === 'already' && (
          <>
            <CheckCircle2 className="h-10 w-10 mx-auto mb-4 text-green-500" />
            <h1 className="font-heading text-2xl mb-2" style={{ color: '#91014b' }}>
              Déjà désinscrit·e
            </h1>
            <p className="text-sm text-muted-foreground">Tu ne reçois plus nos emails.</p>
          </>
        )}
        {(state === 'invalid' || state === 'error') && (
          <>
            <XCircle className="h-10 w-10 mx-auto mb-4 text-red-500" />
            <h1 className="font-heading text-2xl mb-2" style={{ color: '#91014b' }}>
              Lien invalide
            </h1>
            <p className="text-sm text-muted-foreground">
              Ce lien de désinscription n'est plus valable.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
