import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './styles.css';

import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router';
import { Layout } from './components/Layout';
import { AppStateProvider } from './lib/state';
import { Home } from './pages/Home';
import { InstallPage } from './pages/InstallPage';
import { NotFound } from './pages/NotFound';
import { PluginPage } from './pages/PluginPage';
import { SecurityPage } from './pages/SecurityPage';

// New page: scroll to the #anchor if there is one, else to the top.
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const el = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (el) el.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppStateProvider>
        <ScrollToTop />
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="plugins/:name" element={<PluginPage />} />
            <Route path="install" element={<InstallPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AppStateProvider>
    </BrowserRouter>
  </StrictMode>,
);
