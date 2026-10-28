import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { acceptInvite, previewInvite } from '../api/sharingApi';
import { InvitePreview } from '../types/sharing';

// Destino do link de convite. Fica na área que exige conta: quem ainda não entrou é mandado
// para o login e volta para cá em seguida.
export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!token) return;
    previewInvite(token)
      .then(setPreview)
      .catch((err) => setError(err instanceof Error ? err.message : 'Este convite não pôde ser aberto.'));
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    setJoining(true);
    setError(null);
    try {
      const result = await acceptInvite(token);
      navigate(`/sistemas/${result.system_id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar no sistema.');
      setJoining(false);
    }
  }

  if (error && !preview) {
    return (
      <div className="layout narrow">
        <h1>Convite</h1>
        <p className="error" role="alert">{error}</p>
        <p className="muted">Peça um link novo a quem convidou você.</p>
        <Link to="/">← voltar ao início</Link>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="layout narrow">
        <p className="muted">Abrindo o convite…</p>
      </div>
    );
  }

  const already = preview.relation !== 'new';

  return (
    <div className="layout narrow">
      <section className="card invite-card">
        <h1>{already ? 'Você já está neste sistema' : 'Você foi convidado(a)'}</h1>
        {preview.image_url && <img src={preview.image_url} alt="" className="system-cover-preview" />}
        <h2>{preview.system_name}</h2>
        {preview.owner_name && <p className="muted">Sistema criado por {preview.owner_name}</p>}
        {preview.description && <p>{preview.description}</p>}

        {!already && (
          <p className="muted">
            Ao entrar, você poderá consultar este sistema e criar personagens nele. Os seus personagens continuam
            privados, a menos que você os torne públicos.
          </p>
        )}

        {error && <p className="error" role="alert">{error}</p>}

        <div className="form-actions">
          {already ? (
            <Link to={`/sistemas/${preview.system_id}`} className="button-link">
              Abrir o sistema
            </Link>
          ) : (
            <button type="button" disabled={joining} onClick={handleAccept} title="Entra neste sistema e passa a poder criar personagens nele.">
              {joining ? 'Entrando…' : 'Entrar no sistema'}
            </button>
          )}
          <Link to="/" className="muted">
            Agora não
          </Link>
        </div>
      </section>
    </div>
  );
}
