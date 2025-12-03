import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#fff',
          background: 'rgba(0,0,0,0.9)',
          padding: '40px',
          borderRadius: '20px',
          maxWidth: '500px'
        }}>
          <h2 style={{ color: '#ff0066', marginBottom: '20px' }}>出错了 😢</h2>
          <p style={{ marginBottom: '10px' }}>请刷新页面重试，或检查以下问题：</p>
          <ul style={{ textAlign: 'left', lineHeight: '2' }}>
            <li>允许摄像头权限</li>
            <li>使用 Chrome/Edge 浏览器</li>
            <li>确保使用 HTTPS 连接</li>
          </ul>
          {this.state.error && (
            <details style={{ marginTop: '20px', textAlign: 'left', fontSize: '12px', color: '#999' }}>
              <summary>错误详情</summary>
              <pre style={{ marginTop: '10px', whiteSpace: 'pre-wrap' }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 30px',
              background: 'linear-gradient(135deg, #0ff, #f0f)',
              border: 'none',
              borderRadius: '25px',
              color: '#000',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

