import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CharacterDetail } from '../types/character';
import { deleteCharacter, getCharacter, updateCharacter } from '../api/charactersApi';
import { CharacterForm } from '../components/CharacterForm';
import { VisibilityToggle } from '../components/VisibilityToggle';
import { InventoryPanel } from '../components/InventoryPanel';
import { setVisibility } from '../api/charactersApi';
// o editor (ProseMirror) é pesado e só é preciso na aba da história: carrega sob demanda
const StoryPanel = lazy(() => import('../components/StoryPanel').then((m) => ({ default: m.StoryPanel })));

type Tab = 'ficha' | 'historia' | 'itens';

export function CharacterPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<CharacterDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // A página tem duas abas. As duas ficam montadas (a oculta só some da tela), para trocar de aba
  // não perder o que está sendo editado; a história só é carregada na primeira vez que a aba é aberta.
  const [tab, setTab] = useState<Tab>(() =>
    window.location.hash === '#historia' ? 'historia' : window.location.hash === '#itens' ? 'itens' : 'ficha',
  );
  const [storyOpened, setStoryOpened] = useState(tab === 'historia');
  const [itemsOpened, setItemsOpened] = useState(tab === 'itens');

  function selectTab(next: Tab) {
    setTab(next);
    if (next === 'historia') setStoryOpened(true);
    // guarda a aba na URL (#historia) sem criar um passo novo no histórico do navegador
    if (next === 'itens') setItemsOpened(true);
    window.history.replaceState(
      null,
      '',
      next === 'ficha' ? window.location.pathname + window.location.search : `#${next}`,
    );
  }

  // setas esquerda/direita, Home e End trocam de aba (padrão de abas acessíveis)
  function onTabKeyDown(event: React.KeyboardEvent) {
    const order: Tab[] = ['ficha', 'historia', 'itens'];
    const index = order.indexOf(tab);
    let next: Tab | null = null;
    if (event.key === 'ArrowRight') next = order[(index + 1) % order.length];
    if (event.key === 'ArrowLeft') next = order[(index + order.length - 1) % order.length];
    if (event.key === 'Home') next = order[0];
    if (event.key === 'End') next = order[order.length - 1];
    if (next) {
      event.preventDefault();
      selectTab(next);
      document.getElementById(`aba-${next}`)?.focus();
    }
  }

  useEffect(() => {
    if (!id) return;
    getCharacter(id)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'));
  }, [id]);

  async function handleDelete() {
    if (!id || !data || !confirm(`Excluir o personagem "${data.character.name}"?`)) return;
    try {
      await deleteCharacter(id);
      navigate(`/sistemas/${data.character.system_id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível excluir o personagem.');
    }
  }

  if (error) {
    return (
      <div className="layout">
        <p className="error">{error}</p>
        <Link to="/">← voltar</Link>
      </div>
    );
  }

  if (!data || !id) {
    return (
      <div className="layout">
        <p className="muted">Carregando...</p>
      </div>
    );
  }

  const canEdit = data.character.can_edit;

  return (
    <div className="layout narrow">
      <header>
        <Link to={`/sistemas/${data.character.system_id}`} className="muted">
          ← {data.character.system_name}
        </Link>
        <h1>{data.character.name}</h1>
      </header>

      {canEdit ? (
        <VisibilityToggle
          noun="personagem"
          isPublic={data.character.is_public}
          isPreconfiguredSystem={data.character.system_is_preconfigured}
          onSet={async (next) => setData(await setVisibility(id, next))}
        />
      ) : (
        <p className="readonly-banner" role="note">
          Personagem de <strong>{data.character.owner_name}</strong>, público neste sistema. Você pode ler a ficha e a
          história, mas não editar.
        </p>
      )}

      <div className="tabs" role="tablist" aria-label="Partes do personagem" onKeyDown={onTabKeyDown}>
        <button
          type="button"
          role="tab"
          id="aba-ficha"
          className="tab"
          aria-selected={tab === 'ficha'}
          aria-controls="painel-ficha"
          tabIndex={tab === 'ficha' ? 0 : -1}
          title="A ficha com os atributos do sistema."
          onClick={() => selectTab('ficha')}
        >
          Ficha
        </button>
        <button
          type="button"
          role="tab"
          id="aba-historia"
          className="tab"
          aria-selected={tab === 'historia'}
          aria-controls="painel-historia"
          tabIndex={tab === 'historia' ? 0 : -1}
          title="A história de origem do personagem, salva automaticamente."
          onClick={() => selectTab('historia')}
        >
          História de origem
        </button>
        <button
          type="button"
          role="tab"
          id="aba-itens"
          className="tab"
          aria-selected={tab === 'itens'}
          aria-controls="painel-itens"
          tabIndex={tab === 'itens' ? 0 : -1}
          title="Os itens e equipamentos que o personagem carrega."
          onClick={() => selectTab('itens')}
        >
          Itens
        </button>
      </div>

      <div role="tabpanel" id="painel-ficha" aria-labelledby="aba-ficha" hidden={tab !== 'ficha'}>
        <CharacterForm
          attributes={data.attributes}
          initialName={data.character.name}
          initialValues={data.values}
          readOnly={!canEdit}
          submitLabel="Salvar alterações"
          submittingLabel="Salvando..."
          onSubmit={async (input) => {
            setData(await updateCharacter(id, input));
          }}
        />
      </div>

      <div role="tabpanel" id="painel-historia" aria-labelledby="aba-historia" hidden={tab !== 'historia'}>
        {storyOpened && (
          <Suspense fallback={<p className="muted">Carregando o editor…</p>}>
            <StoryPanel characterId={id} readOnly={!canEdit} ownerName={data.character.owner_name} />
          </Suspense>
        )}
      </div>

      <div role="tabpanel" id="painel-itens" aria-labelledby="aba-itens" hidden={tab !== 'itens'}>
        {itemsOpened && <InventoryPanel characterId={id} systemId={data.character.system_id} canEdit={canEdit} />}
      </div>

      {actionError && <p className="error">{actionError}</p>}

      {canEdit && (
        <button type="button" className="danger" onClick={handleDelete}>
          Excluir personagem
        </button>
      )}
    </div>
  );
}
