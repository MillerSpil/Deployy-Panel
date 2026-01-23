import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { ServerPage } from './pages/ServerPage';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/servers/:id" element={<ServerPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
