import { useEffect, useRef, useState } from 'react';
import { createInvite, disableInvite, getSharing } from '../api/sharingApi';
import { SharingInfo } from '../types/sharing';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

// Painel do dono do sistema: gera o link de convite e mostra quem já entrou.
export function SharePanel({ systemId }: { systemId: string }) {
  const [info, setInfo] = useState<SharingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);

  function load() {
    getSharing(systemId)
      .then(setInfo)
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar o compartilhamento.'));
  }
  useEffect(load, [systemId]);

  const link = info?.invite_token ? `${window.location.origin}/convite/${info.invite_token}` : null;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      await action();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a ação.');
    } finally {
      setBusy(false);
    }
  }

  function generate() {
    if (
      info?.invite_token &&
      !confirm('Gerar um novo link faz o link atual parar de funcionar. Quem já entrou continua no sistema. Continuar?')
    ) {
      return;
    }
    void run(() => createInvite(systemId));
  }

  function disable() {
    if (!confirm('Desativar o link? Ninguém novo poderá entrar, mas quem já entrou continua no sistema.')) return;
    void run(() => disableInvite(systemId));
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // navegador sem permissão de área de transferência: deixa o link selecionado para copiar à mão
      linkRef.current?.select();
    }
  }

  return (
    <section className="card share-panel" aria-labelledby="titulo-compartilhar">
      <h2 id="titulo-compartilhar">Compartilhar</h2>
      <p className="muted">
        Quem abrir o link e entrar na própria conta poderá consultar este sistema e criar personagens nele. Só você altera
        o sistema, e cada pessoa decide se deixa os próprios personagens públicos ou privados.
      </p>

      {error && <p className="error" role="alert">{error}</p>}

      {link ? (
        <>
          <label className="share-link">
            <span className="share-link-label">Link de convite</span>
            <input
              ref={linkRef}
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              title="Envie este link a quem você quer convidar."
            />
          </label>
          <div className="share-actions">
            <button type="button" onClick={copy} title="Copia o link para a área de transferência.">
              {copied ? 'Link copiado' : 'Copiar link'}
            </button>
            <button type="button" className="ghost" disabled={busy} onClick={generate} title="Troca o link; o atual deixa de funcionar.">
              Gerar novo link
            </button>
            <button type="button" className="ghost" disabled={busy} onClick={disable} title="Desativa o link: ninguém novo poderá entrar.">
              Desativar link
            </button>
          </div>
        </>
      ) : (
        <div className="share-actions">
          <button type="button" disabled={busy || !info} onClick={generate} title="Cria um link para convidar outras pessoas para este sistema.">
            Gerar link de convite
          </button>
          {info && <span className="muted">Nenhum link ativo no momento.</span>}
        </div>
      )}

      <h3>Quem está neste sistema</h3>
      {info && info.members.length === 0 ? (
        <p className="muted">Ninguém além de você, por enquanto.</p>
      ) : (
        <ul className="share-members">
          {info?.members.map((member) => (
            <li key={member.user_id}>
              <strong>{member.name}</strong>
              <span className="muted">
                {' '}
                · entrou em {formatDate(member.joined_at)} · {member.characters}{' '}
                {member.characters === 1 ? 'personagem' : 'personagens'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
