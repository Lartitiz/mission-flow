import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Question {
  id: string;
  text: string;
  theme: string;
}

type Status = 'loading' | 'active' | 'completed' | 'error';

export default function QuestionnaireView() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [clientName, setClientName] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const savingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-questionnaire', {
          body: { token },
        });
        if (error || data?.error) {
          setErrorMsg(data?.error || "Ce lien n'est pas valide");
          setStatus('error');
          return;
        }
        if (data.status === 'completed') {
          setClientName(data.client_name);
          setCompletedAt(data.completed_at);
          setStatus('completed');
          return;
        }
        setClientName(data.client_name);
        setQuestions(data.questions ?? []);
        setResponses(data.responses ?? {});
        setStatus('active');
      } catch {
        setErrorMsg("Ce lien n'est pas valide");
        setStatus('error');
      }
    })();
  }, [token]);

  const saveResponse = useCallback(
    async (questionId: string, value: string) => {
      if (savingRef.current.has(questionId)) return;
      savingRef.current.add(questionId);
      try {
        await supabase.functions.invoke('save-questionnaire-response', {
          body: { token, responses: { [questionId]: value }, submit: false },
        });
      } catch (e) {
        console.error('Auto-save error:', e);
      } finally {
        savingRef.current.delete(questionId);
      }
    },
    [token]
  );

  const handleBlur = useCallback(
    (questionId: string) => {
      const val = responses[questionId];
      if (val !== undefined) {
        saveResponse(questionId, val);
      }
    },
    [responses, saveResponse]
  );

  const handleChange = useCallback((questionId: string, value: string) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const answeredCount = questions.filter((q) => (responses[q.id] ?? '').trim().length > 0).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('save-questionnaire-response', {
        body: { token, responses, submit: true },
      });
      if (error || data?.error) {
        toast({ title: 'Erreur', description: data?.error || 'Erreur lors de la soumission', variant: 'destructive' });
        return;
      }
      setStatus('completed');
      setCompletedAt(new Date().toISOString());
    } catch {
      toast({ title: 'Erreur', description: 'Erreur lors de la soumission', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group questions by theme
  const themes: { name: string; questions: Question[] }[] = [];
  for (const q of questions) {
    const existing = themes.find((t) => t.name === q.theme);
    if (existing) {
      existing.questions.push(q);
    } else {
      themes.push({ name: q.theme, questions: [q] });
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FFF4F8' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#91014b' }} />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FFF4F8' }}>
        <div className="bg-white rounded-xl shadow-md p-8 max-w-md text-center">
          <p style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '1.25rem' }}>
            {errorMsg}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#FFF4F8' }}>
        <header className="py-6 px-4 text-center">
          <p style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '1.5rem' }}>
            Nowadays
          </p>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-md p-8 max-w-lg text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto" style={{ color: '#FB3D80' }} />
            <h1 style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '1.5rem' }}>
              Merci {clientName} !
            </h1>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: '#555', fontSize: '1rem' }}>
              Tes réponses ont bien été enregistrées. Je reviens vers toi très vite !
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#FFF4F8' }}>
      {/* Header */}
      <header className="py-6 px-4 text-center space-y-1">
        <p style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '1.5rem' }}>
          Nowadays
        </p>
        <h1 style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '1.25rem' }}>
          Questionnaire de lancement
        </h1>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: '#555', fontSize: '0.9rem' }}>
          {clientName}
        </p>
      </header>

      {/* Progress */}
      <div className="max-w-2xl mx-auto w-full px-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.85rem', color: '#666' }}>
            {answeredCount} / {questions.length} questions répondues
          </span>
          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.85rem', color: '#FB3D80', fontWeight: 500 }}>
            {Math.round(progress)}%
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Questions by theme */}
      <div className="max-w-2xl mx-auto w-full px-4 space-y-6 pb-8">
        {themes.map((theme) => (
          <div key={theme.name} className="bg-white rounded-xl shadow-sm p-5 md:p-6 space-y-5">
            <h2 style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '1.1rem' }}>
              {theme.name}
            </h2>
            {theme.questions.map((q) => (
              <div key={q.id} className="space-y-2">
                <label
                  htmlFor={q.id}
                  style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '1rem', color: '#333', display: 'block' }}
                >
                  {q.text}
                </label>
                <Textarea
                  id={q.id}
                  value={responses[q.id] ?? ''}
                  onChange={(e) => handleChange(q.id, e.target.value)}
                  onBlur={() => handleBlur(q.id)}
                  placeholder="Ta réponse..."
                  className="min-h-[100px] resize-y border-gray-200 focus:border-[#FB3D80] focus:ring-[#FB3D80]/20"
                  style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.95rem' }}
                />
              </div>
            ))}
          </div>
        ))}

        {/* Submit */}
        <div className="pt-4 pb-8">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full h-12 text-base font-medium text-white gap-2"
            style={{ backgroundColor: '#FB3D80', fontFamily: "'IBM Plex Sans', sans-serif" }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                Envoyer mes réponses
              </>
            )}
          </Button>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="py-4 text-center mt-auto">
      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.75rem', color: '#999' }}>
        Powered by{' '}
        <a
          href="https://nowadaysagency.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#91014b' }}
        >
          Nowadays Agency
        </a>{' '}
        — nowadaysagency.com
      </p>
    </footer>
  );
}
