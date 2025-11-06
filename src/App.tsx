
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { EditorSettingsProvider } from '@/contexts/EditorSettingsContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { DebugProvider } from '@/contexts/DebugContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { Toaster } from '@/components/ui/toaster';
import Index from '@/pages/Index';
import Auth from '@/pages/Auth';
import { PublicDiagram } from '@/pages/PublicDiagram';
import NotFound from '@/pages/NotFound';

function App() {
  return (
    <>
      <AuthProvider>
        <DebugProvider>
          <EditorSettingsProvider>
            <NotificationsProvider>
              <Router>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/public/diagram/:documentId" element={<PublicDiagram />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Router>
            </NotificationsProvider>
          </EditorSettingsProvider>
        </DebugProvider>
      </AuthProvider>
      <Toaster />
    </>
  );
}

export default App;
