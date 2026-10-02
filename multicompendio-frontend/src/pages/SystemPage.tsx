import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SystemWithAttributes } from '../types/system';
import { getSystem, deleteSystem } from '../api/systemsApi';
import { SystemPropertiesForm } from '../components/SystemPropertiesForm';
import { AttributesTable } from '../components/AttributesTable';
import { AddAttributeForm } from '../components/AddAttributeForm';

export function SystemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<SystemWithAttributes | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    if (!id) return;
    getSystem(id)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'));
  }

  useEffect(reload, [id]);

  async function handleDeleteSystem() {
    if (!id || !confirm('Excluir este sistema?')) return;
    try {
      await deleteSystem(id);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir');
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

  return (
    <div className="layout">
      <header>
        <Link to="/" className="muted">
          ← voltar
        </Link>
        <h1>{data.system.name}</h1>
      </header>

      <div className="columns-2">
        <div className="column">
          <SystemPropertiesForm
            system={data.system}
            onUpdated={(system) => setData((prev) => (prev ? { ...prev, system } : prev))}
          />

          <button type="button" onClick={handleDeleteSystem} className="danger">
            Excluir sistema
          </button>
        </div>

        <div className="column">
          <div className="card">
            <h2>Atributos</h2>
            <AttributesTable
              systemId={id}
              attributes={data.attributes}
              onChanged={(updated) =>
                setData((prev) =>
                  prev
                    ? {
                        ...prev,
                        attributes: prev.attributes.map((a) => (a.id === updated.id ? updated : a)),
                      }
                    : prev,
                )
              }
              onDeleted={(attributeId) =>
                setData((prev) =>
                  prev
                    ? { ...prev, attributes: prev.attributes.filter((a) => a.id !== attributeId) }
                    : prev,
                )
              }
            />
            <h3>Adicionar atributo</h3>
            <AddAttributeForm systemId={id} onAdded={reload} />
          </div>
        </div>
      </div>
    </div>
  );
}
