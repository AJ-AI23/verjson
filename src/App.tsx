
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { EditorSettingsProvider } from '@/contexts/EditorSettingsContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { DebugProvider } from '@/contexts/DebugContext';
import Index from '@/pages/Index';
import Auth from '@/pages/Auth';
import NotFound from '@/pages/NotFound';

function App() {
  return (
    <>
      <AuthProvider>
        <EditorSettingsProvider>
          <DebugProvider>
            <Router>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Router>
          </DebugProvider>
        </EditorSettingsProvider>
      </AuthProvider>
    </>
  );
}

export default App;
