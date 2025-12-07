
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { EditorSettingsProvider } from '@/contexts/EditorSettingsContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { DemoSessionProvider } from '@/contexts/DemoSessionContext';
import { DebugProvider } from '@/contexts/DebugContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { Toaster } from '@/components/ui/toaster';
import Index from '@/pages/Index';
import Auth from '@/pages/Auth';
import { PublicDiagram } from '@/pages/PublicDiagram';
import ApiDocs from '@/pages/ApiDocs';
import NotFound from '@/pages/NotFound';

function App() {
  return (
    <>
      <AuthProvider>
        <DemoSessionProvider>
          <DebugProvider>
            <EditorSettingsProvider>
              <NotificationsProvider>
                <Router>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/public/diagram/:documentId" element={<PublicDiagram />} />
                    <Route path="/api-docs" element={<ApiDocs />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Router>
              </NotificationsProvider>
            </EditorSettingsProvider>
          </DebugProvider>
        </DemoSessionProvider>
      </AuthProvider>
      <Toaster />
    </>
  );
}

export default App;
