import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import '../../assets/globals.css';

// App.tsxで定義されたコンポーネントをレンダリングし，root要素にマウントする
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
