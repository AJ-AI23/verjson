
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { EditorSettingsProvider } from '@/contexts/EditorSettingsContext';
import Index from '@/pages/Index';
import NotFound from '@/pages/NotFound';

function App() {
  return (
    <>
      <EditorSettingsProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </EditorSettingsProvider>
      <Toaster />
      <SonnerToaster position="bottom-right" />
    </>
  );
}

export default App;
