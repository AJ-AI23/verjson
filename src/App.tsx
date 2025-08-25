
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
    </>
  );
}

export default App;
