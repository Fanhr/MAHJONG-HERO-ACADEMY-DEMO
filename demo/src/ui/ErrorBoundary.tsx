import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** 顶层错误边界：捕获渲染期异常，避免整页白屏，并提供重开入口。 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 仅记录到控制台，便于排查（不上报）
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex min-h-full items-center justify-center bg-radial-table p-6">
          <div className="glass-strong max-w-md rounded-2xl p-6 text-center">
            <div className="mb-2 text-2xl font-black text-alert">出错了</div>
            <p className="mb-4 text-sm text-muted">界面发生了一个异常，可点击下方按钮刷新重开对局。</p>
            <pre className="mb-4 max-h-32 overflow-auto rounded bg-ink-900/60 p-2 text-left text-[11px] text-muted">
              {String(this.state.error?.message ?? this.state.error)}
            </pre>
            <button
              onClick={() => location.reload()}
              className="rounded-xl bg-gradient-to-r from-blood to-blood-light px-6 py-2.5 font-bold text-white shadow-neon transition active:scale-95"
            >
              刷新重开
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
