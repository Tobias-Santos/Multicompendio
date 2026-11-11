import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  resetKey?: string; // ao mudar (por exemplo, ao trocar de tela), a proteção se desfaz e tenta mostrar a tela de novo
}
interface State {
  failed: boolean;
}

// Sem isto, qualquer erro de renderização desmonta o aplicativo inteiro e deixa só uma tela em branco.
// Aqui a pessoa vê o que aconteceu e tem como sair (recarregar ou voltar ao início).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('Erro ao desenhar a tela:', error);
  }

  componentDidUpdate(prev: Props): void {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="layout">
        <div className="card" role="alert" style={{ maxWidth: 560, margin: '2rem auto' }}>
          <h2>Algo deu errado ao mostrar esta tela</h2>
          <p>
            O que você fez até aqui no servidor está seguro. Recarregue a página para continuar. Se o problema se repetir, tente
            desligar extensões do navegador que alteram a página (como tradutores automáticos).
          </p>
          <div className="actions-row" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => window.location.reload()}>Recarregar a página</button>
            <a className="button-link" href="/">Ir para o início</a>
          </div>
        </div>
      </div>
    );
  }
}
